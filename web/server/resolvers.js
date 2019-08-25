/***********************************************************************************************************************
*  Copyright (c) 2008-2018, Alliance for Sustainable Energy, LLC, and other contributors. All rights reserved.
*
*  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
*  following conditions are met:
*
*  (1) Redistributions of source code must retain the above copyright notice, this list of conditions and the following
*  disclaimer.
*
*  (2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
*  disclaimer in the documentation and/or other materials provided with the distribution.
*
*  (3) Neither the name of the copyright holder nor the names of any contributors may be used to endorse or promote products
*  derived from this software without specific prior written permission from the respective party.
*
*  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER(S) AND ANY CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
*  INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
*  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER(S), ANY CONTRIBUTORS, THE UNITED STATES GOVERNMENT, OR THE UNITED
*  STATES DEPARTMENT OF ENERGY, NOR ANY OF THEIR EMPLOYEES, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
*  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF
*  USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
*  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
*  ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
***********************************************************************************************************************/

import AWS from 'aws-sdk';
import request from 'superagent';
import {MongoClient} from 'mongodb';
import path from 'path';
import dbops from './lib/dbops';

AWS.config.update({region: process.env.REGION});
var sqs = new AWS.SQS();
var s3client = new AWS.S3({endpoint: process.env.S3_URL});

function addSiteResolver(osmName, uploadID) {
  var params = {
   MessageBody: `{"op": "InvokeAction", 
      "action": "addSite", 
      "osm_name": "${osmName}", 
      "upload_id": "${uploadID}"
    }`,
   QueueUrl: process.env.JOB_QUEUE_URL,
   MessageGroupId: "Alfalfa"
  };
  
  sqs.sendMessage(params, (err, data) => {
    if (err) {
      console.log(err);
      callback(err);
    }
  });
}

function runSimResolver(uploadFilename, uploadID, context) {
  var params = {
   MessageBody: `{"op": "InvokeAction", 
    "action": "runSim", 
    "upload_filename": "${uploadFilename}", 
    "upload_id": "${uploadID}"
   }`,
   QueueUrl: process.env.JOB_QUEUE_URL,
   MessageGroupId: "Alfalfa"
  };
  
  sqs.sendMessage(params, (err, data) => {
    if (err) {
      callback(err);
    } else {
      const simcollection = context.db.collection('sims');
      simcollection.insert( {_id: uploadID, siteRef: uploadID, simStatus: "Queued", name: path.parse(uploadFilename).name.replace(".tar","") } );
    }
  });
}

function removeSiteResolver(obj, args, context) {
  const id = args.id;
  let ids = args.ids;
  const models = context.db.collection('models');
  const recs = context.db.collection('recs');
  const redis = context.redis;

  return new Promise( (resolve,reject) => {
    if (id && ! ids && (id != "")) {
      ids = [id];
    }

    try {
      const query = {'_id': {$in: ids}};
      models.deleteMany(query);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function simsResolver(user,args,context) {
  return new Promise( (resolve,reject) => {
      let sims = [];
      const simcollection = context.db.collection('sims');
      simcollection.find(args).toArray().then((array) => {
        array.map( (sim) => {
          sim = (Object.assign(sim, {"simRef": sim._id}));
          if ( sim.s3Key ) {
            var params = {Bucket: process.env.S3_BUCKET, Key: sim.s3Key, Expires: 86400};
            var url = s3client.getSignedUrl('getObject', params);
            sim = (Object.assign(sim, {"url": url}));
          }
          sims.push(sim)
        })
        resolve(sims);
      }).catch((err) => {
        reject(err);
      });
    });
};

function modelsResolver(obj, args, context) {
  const id = args.id;
  const models = context.db.collection('models');
  const redis = context.redis;
  let ids = args.ids;

  const toModels = (ids) => {
    return ids.map((id) => {
      return {'id': id};
    });
  };

  return new Promise( (resolve,reject) => {
    // Check that the ids given, actually exist
    // if no id or ids are given then return all models from db
    let found = [];

    if (id && ! ids && (id != "")) {
      ids = [id];
    }

    if (ids) {
      // If explicit ids are given, then search redis first
      let multi = redis.multi();
      for (const theid of ids) {
        const key = `model#${theid}`;
        multi.exists(key);
      }
      multi.exec((err, cachedModels) => {
        if (err) { reject(err); return; }
        for (let i = 0; i < cachedModels.length; i++) {
          if (cachedModels[i]) {
            found.push(ids[i]);
          }
        }

        if (found.length != ids.length) {
          // if some ids are missing in redis then look in persistent db
          let missing = []
          // Identify the ids not in redis
          for (const theid of ids) {
            if (found.indexOf(theid) == -1) {
              missing.push(theid);
            }
          }
          const query = {'_id': {$in: missing}};
          models.find(query).toArray().then((array) => {
            for (const model of array) {
              found.push(model['_id']);
            }
            resolve(toModels(found));
          });
        } else {
          resolve(toModels(found));
        }
      });
    } else {
      // If no explicit ids were requested then just find all from persisted storage
      models.find().toArray().then((array) => {
        for (const model of array) {
          found.push(model['_id']);
        }
        resolve(toModels(found));
      });
    }
  });
}

function modelInfoResolver(obj, args, context) {
  const id = obj['id'];
  const models = context.db.collection('models');

  return new Promise( (resolve,reject) => {
    models.findOne({'_id': id}).then((model) => {
      if (model) {
        const info = {'name': model['name'], 'type': model['type']};
        resolve(info);
      } else {
        resolve(null);
      }
    });
  });
}

function modelSimResolver(obj, args, context) {
  const id = obj['id'];
  const redis = context.redis;
  const key = `model#${id}`;

  return new Promise( (resolve,reject) => {
    redis.hgetall(key, (err, sim) => {
      if (err) reject(err);
      if (sim) {
        resolve(sim);
      } else {
        resolve({'state': 'Stopped'});
      }
    })
  });
}

function sitePointResolver(siteRef, args, context) {
  return new Promise((resolve, reject) => {
    const recs = context.db.collection('recs');
    let query = {site_ref: siteRef, "rec.point": "m:"};
    if (args.writable) {query["rec.writable"] = "m:"};
    if (args.cur) {query["rec.cur"] = "m:"};
    recs.find(query).toArray().then((array) => {
      let points = [];
      array.map( (rec) => {
        let point = {};
        point.tags = [];
        point.dis = rec.rec.dis
        for (const reckey in rec.rec) {
            const tag = {key: reckey, value: rec.rec[reckey]};
            point.tags.push(tag);
        }
        points.push(point);
      });
      resolve(points)
    }).catch((err) => {
      reject(err);
    });
  });
}

function advanceResolver(advancer, siteRef) {
  return advancer.advance(siteRef);
}

function writePointResolver(context,siteRef, pointName, value, level) {
  return dbops.getPoint(siteRef, pointName, context.db).then( point => {
    return dbops.writePoint(point._id, siteRef, level, value, null, null, context.db);
  }).then( array => {
    return array;
  });
};

module.exports = { 
  runSimResolver, 
  addSiteResolver, 
  removeSiteResolver, 
  advanceResolver,
  sitePointResolver, 
  writePointResolver,
  modelsResolver, 
  modelInfoResolver, 
  modelSimResolver, 
  simsResolver, 
};

