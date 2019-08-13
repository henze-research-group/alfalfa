// The purpose of this file is to consolidate operations to the database
// in a single place. Clients may transform the data into and out of 
// these functions for their own api purposes. ie Haystack api, GraphQL api.

class WriteArray {
  constructor() {
    this.val = [];
    this.who = [];

    for (var i = 0; i < 17; ++i) {
      this.val[i] = null;
      this.who[i] = null;
    }
  }
}

function currentWinningValue(array) {
  for (var i = 0; i < array.val.length; ++i) {
    const v = array.val[i];
    if (v || (v == 0)) {
      return {
        val: v,
        level: i + 1
      }
    }
  }

  return null;
}

function setOrNullArray(array, val, level, who) {
  if (val || (val == 0) ) {
    array.val[level - 1] = val;
    array.who[level - 1] = who;
  } else {
    array.val[level - 1] = null;
    array.who[level - 1] = null;
  }
}

// Get a point by siteRef and display name
function getPoint(siteRef, name, db) {
  let mrecs = db.collection('recs');
  return mrecs.findOne({site_ref: siteRef, "rec.dis": `s:${name}`});
}

function writePoint(id, siteRef, level, val, who, dur, db) {
  return new Promise( (resolve,reject) => {
    let writearrays = db.collection('writearrays');
    let mrecs = db.collection('recs');

    if (! level) { level = 1; }
  
    writearrays.findOne({_id: id}).then((array) => {
      if( array ) {
        // In this case the array already exists because it has been written to before
        setOrNullArray(array, val, level, who);
        writearrays.updateOne(
          { "_id": array._id },
          { $set: { "val": array.val, "who": array.who } }
        ).then( () => {
          const current = currentWinningValue(array);
          if( current ) {
            return mrecs.updateOne(
              { "_id": array._id },
              { $set: { "rec.writeStatus": "s:ok", "rec.writeVal": `s:${current.val}`, "rec.writeLevel": `n:${current.level}` }, $unset: { writeErr: "" } }
            )
          } else {
            return mrecs.updateOne(
              { "_id": array._id },
              { $set: { "rec.writeStatus": "s:disabled" }, $unset: { "rec.writeVal": "", "rec.writeLevel": "", "rec.writeErr": ""} }
            )
          }
        }).then( () => {
          resolve(array);
        }).catch( (err) => {
          reject(err)
        });
      } else {
        // In this case the point has never been written to and there is no
        // existing write array in the db so we create a new one
        let array = new WriteArray();
        array._id = id;
        array.siteRef = siteRef;
        setOrNullArray(array, val, level, who);
        writearrays.insertOne(array).then( () => {
          const current = currentWinningValue(array);
          if( current ) {
            return mrecs.updateOne(
              { "_id": array._id },
              { $set: { "rec.writeStatus": "s:ok", "rec.writeVal": `s:${current.val}`, "rec.writeLevel": `n:${current.level}` }, $unset: { writeErr: "" } }
            )
          } else {
            return mrecs.updateOne(
              { "_id": array._id },
              { $set: { "rec.writeStatus": "s:disabled" }, $unset: { "rec.writeVal": "", "rec.writeLevel": "", "rec.writeErr": ""} }
            )
          }
        }).then(() => {
          resolve(array);
        }).catch((err) => {
          reject(err);
        });
      }
    }).catch((err) => {
      reject(err);
    });
  });
}

function addSite(args, context) {
  //args: {
  //  osmName : { type: new GraphQLNonNull(GraphQLString) },
  //  uploadID : { type: new GraphQLNonNull(GraphQLString) },
  //},
  const redis = context.redis;
  const db = context.db;
  const queue = context.queue;

  var params = {
   MessageBody: `{"op": "InvokeAction", 
      "action": "addSite", 
      "osm_name": "${args.osmName}", 
      "upload_id": "${args.uploadID}"
    }`,
   QueueUrl: process.env.JOB_QUEUE_URL,
   MessageGroupId: "Alfalfa"
  };
  
  queue.sendMessage(params, (err, data) => {
    if (err) throw err;
    redis.eval("redis.call('incr', KEYS[1])", 1, 'scaling:queue-size')
  });
}

function runSite(args, context) {
  //args: {
  //  siteRef : { type: new GraphQLNonNull(GraphQLString) },
  //  startDatetime : { type: GraphQLString },
  //  endDatetime : { type: GraphQLString },
  //  timescale : { type: GraphQLFloat },
  //  realtime : { type: GraphQLBoolean },
  //  externalClock : { type: GraphQLBoolean },
  //},

  const redis = context.redis;
  const db = context.db;
  const queue = context.queue;
  const key = `site#${args.siteRef}`;

  const sendMessage = () => {
    let body = {
      "op": "InvokeAction",
      "action": "runSite",
    };

    body = Object.assign(body, args);
    
    const params = {
     MessageBody: JSON.stringify(body),
     QueueUrl: process.env.JOB_QUEUE_URL,
     MessageGroupId: "Alfalfa"
    };

    queue.sendMessage(params, function(err, data) {
      if (err) throw err;
    });
  };

  redis.watch(key, (err) => {
    if (err) throw err;

    redis.hget(key, 'state', (err, reply) => {
      if (err) throw err;

      if ((reply == 'Stopped') || (reply == null)) {
        redis.multi()
          .hset(key, 'state', 'Queued')
          .eval("redis.call('incr', KEYS[1])", 1, 'scaling:queue-size')
          .exec((err, reply) => {
            if (err) throw err;
            sendMessage();
          });
      } else {
        return;
      }
    });
  });
}

function stopSite(args, context) {
  // TODO: Consider providing a response,
  // also check if the simulation is running before stopping
  const key = `site#${args.siteRef}`;
  const channel = `site#${args.siteRef}:notify`;
  context.redis.hmset(key, {'state': 'Stopping', 'action': 'Stop'});
  context.pub.publish(channel, "Stop");
}

module.exports = { writePoint, getPoint, runSite, stopSite, addSite };

