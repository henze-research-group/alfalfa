########################################################################################################################
#  Copyright (c) 2008-2020, Alliance for Sustainable Energy, LLC, and other contributors. All rights reserved.
#
#  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
#  following conditions are met:
#
#  (1) Redistributions of source code must retain the above copyright notice, this list of conditions and the following
#  disclaimer.
#
#  (2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
#  disclaimer in the documentation and/or other materials provided with the distribution.
#
#  (3) Neither the name of the copyright holder nor the names of any contributors may be used to endorse or promote products
#  derived from this software without specific prior written permission from the respective party.
#
#  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER(S) AND ANY CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
#  INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
#  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER(S), ANY CONTRIBUTORS, THE UNITED STATES GOVERNMENT, OR THE UNITED
#  STATES DEPARTMENT OF ENERGY, NOR ANY OF THEIR EMPLOYEES, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
#  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF
#  USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
#  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
#  ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
########################################################################################################################

import json
import os
import shutil
import tarfile
import time
import uuid
import zipfile
from datetime import datetime, timedelta

import lib
import lib.testcase
import pytz

from lib.alfalfa_connections import AlfalfaConnections
from step_sim_utils import step_sim_arg_parser


class RunFMUSite:

    def __init__(self, **kwargs):
        # Setup connections
        self.ac = AlfalfaConnections()

        # get arguments from calling program
        # which is the processMessage program
        self.site_id = kwargs['site_id']
        self.real_time_flag = kwargs['real_time_flag']
        self.time_scale = kwargs['time_scale']
        self.startTime = kwargs['startTime']
        self.endTime = kwargs['endTime']
        self.externalClock = kwargs['externalClock']

        # Use arbitrary start datetime for now
        self.current_datetime = datetime(1970, 1, 1, 0, 0, 0)

        self.site = self.ac.mongo_db_recs.find_one({"_id": self.site_id})

        # build the path for zipped-file, fmu, json
        sim_path = '/simulate'
        self.directory = os.path.join(sim_path, self.site_id)
        tar_name = "%s.tar.gz" % self.site_id
        key = "parsed/%s" % tar_name
        tarpath = os.path.join(self.directory, tar_name)
        fmupath = os.path.join(self.directory, 'model.fmu')
        tagpath = os.path.join(self.directory, 'tags.json')

        if not os.path.exists(self.directory):
            os.makedirs(self.directory)

        # download the tar file and tag file
        # self.s3_bucket = self.s3.Bucket('alfalfa')
        self.ac.s3_bucket.download_file(key, tarpath)

        tar = tarfile.open(tarpath)
        tar.extractall(sim_path)
        tar.close()

        zzip = zipfile.ZipFile(fmupath)
        zzip.extract('resources/kpis.json', self.directory)

        # this shouldn't be hard coded.
        # step_size in seconds
        self.step_size = 300

        # Load fmu
        config = {
            'fmupath': fmupath,
            'start_time': self.startTime,
            'step': self.step_size,
            'kpipath': self.directory + '/resources/kpis.json'
        }

        (self.tagid_and_outputs, self.id_and_dis, self.default_input) = self.create_tag_dictionaries(tagpath)

        # initiate the testcase -- NL make sure to flatten the config options to pass to kwargs correctly
        self.tc = lib.testcase.TestCase(**config)

        # run the FMU simulation
        self.kstep = 0
        self.stop = False
        self.simtime = 0

        if self.externalClock:
            self.ac.redis_pubsub.subscribe(self.site_id)

        if self.ac.historian_enabled:
            print("Historian enabled")

    def create_tag_dictionaries(self, tag_filepath):
        '''
        Purpose: matching the haystack display-name and IDs
        Inputs:  a json file containing all the tagged data
        Returns: a dictionary matching all outputs and IDs
                 a dictionary matching all IDs and display-names
                 a dictionary for every _enable input, set to value 0
        '''
        outputs_and_ID = {}
        id_and_dis = {}
        # default_input is a dictionay
        # with keys for every "_enable" input, set to value 0
        # in other words, disable everything
        default_input = {}

        # Get Haystack tag data, from tag_filepath
        tag_data = {}
        with open(tag_filepath) as json_data:
            tag_data = json.load(json_data)

        for point in tag_data:
            var_name = point['dis'].replace('s:', '')
            var_id = point['id'].replace('r:', '')

            id_and_dis[var_id] = var_name

            if 'writable' in point.keys():
                default_input[var_name.replace('_u', '_activate')] = 0

            if 'writable' not in point.keys() and 'point' in point.keys():
                outputs_and_ID[var_name] = var_id

        return (outputs_and_ID, id_and_dis, default_input)

    def run(self):
        self.init_sim_status()

        if self.externalClock:
            while True:
                message = self.ac.redis_pubsub.get_message()
                if message:
                    data = message['data']
                    if data == 'advance':
                        self.step()
                        self.ac.redis.publish(self.site_id, 'complete')
                        self.set_idle_state()
                    elif data == 'stop':
                        self.set_idle_state()
                        break
        else:
            while self.simtime < self.endTime:
                if self.db_stop_set():
                    break
                self.step()
                # TODO: Make this respect time scale provided by user
                time.sleep(5)

        self.cleanup()

    # Check the database for a stop signal
    # and return true if stop is requested
    def db_stop_set(self):
        # A client may have requested that the simulation stop early,
        # look for a signal to stop from the database
        self.site = self.ac.mongo_db_recs.find_one({"_id": self.site_id})
        if self.site and (self.site.get("rec", {}).get("simStatus") == "s:Stopping"):
            self.stop = True
        return self.stop

    def reset(self, tarinfo):
        tarinfo.uid = tarinfo.gid = 0
        tarinfo.uname = tarinfo.gname = "root"
        return tarinfo

    # cleanup after the simulation is stopped
    def cleanup(self):
        # Clear all current values from the database when the simulation is no longer running
        self.ac.mongo_db_recs.update_one({"_id": self.site_id},
                                         {"$set": {"rec.simStatus": "s:Stopped"}, "$unset": {"rec.datetime": ""}},
                                         False)
        self.ac.mongo_db_recs.update_many({"site_ref": self.site_id, "rec.cur": "m:"},
                                          {"$unset": {"rec.curVal": "", "rec.curErr": ""},
                                           "$set": {"rec.curStatus": "s:disabled"}}, False)
        self.ac.mongo_db_recs.update_many({"site_ref": self.site_id, "rec.writable": "m:"},
                                          {"$unset": {"rec.writeLevel": "", "rec.writeVal": ""},
                                           "$set": {"rec.writeStatus": "s:disabled"}}, False)

        self.sim_id = str(uuid.uuid4())
        tarname = "%s.tar.gz" % self.sim_id
        tar = tarfile.open(tarname, "w:gz")
        tar.add(self.directory, filter=self.reset, arcname=self.sim_id)
        tar.close()

        uploadkey = "simulated/%s" % tarname
        self.ac.s3_bucket.upload_file(tarname, uploadkey)
        os.remove(tarname)

        time = str(datetime.now(tz=pytz.UTC))
        name = self.site.get("rec", {}).get("dis", "Test Case").replace('s:', '')
        kpis = json.dumps(self.tc.get_kpis())
        self.ac.mongo_db_sims.insert_one(
            {"_id": self.sim_id, "name": name, "siteRef": self.site_id, "simStatus": "Complete", "timeCompleted": time,
             "s3Key": uploadkey, "results": str(kpis)})

        shutil.rmtree(self.directory)

    def set_idle_state(self):
        self.ac.redis.hset(self.site_id, 'control', 'idle')

    def init_sim_status(self):
        self.set_idle_state()
        output_time_string = 's:%s' % (self.simtime)
        self.ac.mongo_db_recs.update_one({"_id": self.site_id},
                                         {"$set": {"rec.datetime": output_time_string, "rec.simStatus": "s:Running"}})

    def update_sim_status(self):
        self.simtime = self.tc.final_time
        output_time_string = 's:%s' % (self.simtime)
        self.ac.mongo_db_recs.update_one({"_id": self.site_id},
                                         {"$set": {"rec.datetime": output_time_string, "rec.simStatus": "s:Running"}})

    def step(self):
        # u represents simulation input values
        u = self.default_input.copy()
        # look in the database for current write arrays
        # for each write array there is an array of controller
        # input values, the first element in the array with a value
        # is what should be applied to the simulation according to Project Haystack
        # convention
        for array in self.ac.mongo_db_write_arrays.find({"siteRef": self.site_id}):
            _id = array.get('_id')
            for val in array.get('val'):
                if val is not None:
                    dis = self.id_and_dis.get(_id)
                    if dis:
                        u[dis] = val
                        u[dis.replace('_u', '_activate')] = 1
                        break

        y_output = self.tc.advance(u)
        self.update_sim_status()
        self.increment_datetime()

        # get each of the simulation output values and feed to the database
        for key in y_output.keys():
            if key != 'time':
                output_id = self.tagid_and_outputs[key]
                value_y = y_output[key]
                self.ac.mongo_db_recs.update_one({"_id": output_id}, {
                    "$set": {"rec.curVal": "n:%s" % value_y, "rec.curStatus": "s:ok", "rec.cur": "m:"}})

        if self.ac.historian_enabled:
            self.write_outputs_to_influx(y_output)

    def increment_datetime(self):
        """
        The current datetime is incremented.
        :return:
        """
        self.current_datetime += timedelta(seconds=self.step_size)

    def write_outputs_to_influx(self, outputs):
        """
        Write output data to influx
        :return:
        """
        json_body = []
        base = {
            "measurement": self.site_id,
            "time": "%s" % self.current_datetime,
        }
        response = False
        # get each of the simulation output values and feed to the database
        for key in outputs.keys():
            if key != 'time':
                output_id = self.tagid_and_outputs[key]
                value = outputs[key]
                dis = self.id_and_dis[output_id]
                base["fields"] = {
                    "value": value
                }
                base["tags"] = {
                    "id": output_id,
                    "dis": dis,
                    "siteRef": self.site_id,
                    "point": True,
                    "source": 'alfalfa'
                }
                json_body.append(base.copy())
        try:
            print("Trying to write to influx")
            response = self.ac.influx_client.write_points(points=json_body,
                                                          time_precision='s',
                                                          database=self.ac.influx_db_name)
            if response:
                print("Influx response received %s" % response)
        except ConnectionError as e:
            print("Unable to write to influx: %s" % e)


# Main Program Entry

args = step_sim_arg_parser()
site_id = args.site_id
externalClock = (args.step_sim_type == 'external_clock')
real_time_flag = False
if args.step_sim_type == 'timescale':
    time_scale = args.step_sim_value
elif args.step_sim_type == 'realtime':
    real_time_flag = True
    time_scale = 1
else:
    time_scale = 5
startTime = float(args.start_datetime)
endTime = float(args.end_datetime)

runFMUSite = RunFMUSite(site_id=site_id, real_time_flag=real_time_flag, time_scale=time_scale, startTime=startTime,
                        endTime=endTime, externalClock=externalClock)
runFMUSite.run()
