
# Redis Structure

## These are the conventions used in the documentation 

The ```::``` separates keys and fields of a hash
The ```:``` is a naming convention to separate parts of a key
The ```#``` is a naming convention to separate parts of a key when there is a type followed by instance id
The ```[ ]``` denotes options in a set of possible values
The ```{ }``` denotes a name that is a placeholder for a specific key

## keys

model#{id}::action [Start | Advance | Stop]
model#{id}::state [Submitted | Queued | Starting | Running | Stopping | Stopped]
model#{id}::cur#{pointid}
model#{id}::name#{pointid}
model#{id}::time
model#{id}::step

scaling:minimum-count
scaling:jobs-running-count
scaling:workers-running-count
scaling:queue-size"
scaling:workers-desired-count

## channels

site#{siteid}:notify
Message formate for notify is
{notification: [advance | done], [step: <int>]}

# Mongo 

# recs stores records in the haystack sense
# this is "everything" in a flat structure, including
# haystack sites at the top level, down to points
recs [
  {
    _id,
    site_ref,
    rec { <-- change this to tags
      id,
      dis,
      ...other tags
    }
  }
]

# models are analogous to haystack sites,
# and there is some duplication of data with the recs collection,
# but this is a more efficient means of storing
# for realtime simulation. Here we strip out 
# the meta data of tags, and also the records,
# between site and point, which communicate the model
# structure in Haystack are stripped away.

# The input/output current values are stored in redis
models [
  {
    _id,
    dis,
    type,
    inputs [
      {id, dis},
      ...
    ],
    outputs [
      {id, dis},
      ...
    ]
  }
]


