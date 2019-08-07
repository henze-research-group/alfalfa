import json
import uuid
import re

#replace_ids.replace_siteid(upload_id, points_jsonpath, mapping_jsonpath)
def replace_siteid(uploadid, points_jsonpath, mapping_jsonpath):
    #step-1: find the siteid from jsonfile
    with open(points_jsonpath, 'r') as jsonfile:
        data = json.load(jsonfile)
        for x in data:
            for y in x.keys():
                if 'site' == y:
                    siteref = x['id']
                else:
                    pass

    #step-2: replace the siteid with uploadid
    for x in data:
        for y in x.keys():
            if 'siteRef'== y:
                x['siteRef'] = 'r:' + uploadid
            elif 'site' == y:
                x['id'] = 'r:' + uploadid
            else:
                pass

    #step-3: replace the old json file with updated jsonfile
    with open(points_jsonpath,'w') as jsonfile:
        json.dump(data, jsonfile)

def make_ids_unique(uploadid, points_jsonpath, mapping_jsonpath):
    # map of old id to new id
    idmap = {}

    with open(points_jsonpath, 'r') as jsonfile:
        points = json.load(jsonfile)

        # iterate all points and make a map of old id to new id
        for point in points:
            if "id" in point:
                oldid = point["id"]
                newid = "r:%s" % str(uuid.uuid1())
                idmap[oldid] = newid

        # now use map to update all references to old id
        for point in points:
            for tag,oldvalue in point.items():
                if oldvalue in idmap:
                    point[tag] = idmap[oldvalue]

    with open(points_jsonpath, 'w') as jsonfile:
        json.dump(points, jsonfile)

    with open(mapping_jsonpath, 'r') as jsonfile:
        points = json.load(jsonfile)
        for point in points:
            if "id" in point:
                oldid = point["id"]
                if oldid in idmap:
                    point["id"] = idmap[oldid]

    with open(mapping_jsonpath, 'w') as jsonfile:
        json.dump(points, jsonfile)

def add_recs(json_file, site_ref, db):
    recs = db.recs
    sites = db.sites

    with open(json_file) as f:
        items = json.load(f)
        for item in items:
            recid = re.sub(r'^r:', '', item['id'])
            rec = {
              '_id': recid,
              'site_ref': site_ref,
              'rec': item
            }
            recs.insert_one(rec)

        # {
        #   _id,
        #   dis
        #   points [
        #     {id, dis},
        #     ...
        #   ]
        # }

