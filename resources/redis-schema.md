
# Redis Structure

## These are the conventions used in the documentation 

The ```::``` separates keys and fields of a hash
The ```:``` is a naming convention to separate parts of a key
The ```#``` is a naming convention to separate parts of a key when there is a type followed by instance id
The ```[ ]``` denotes options in a set of possible values
The ```{ }``` denotes a name that is a placeholder for a specific key

## keys

stite#{siteid}::action [Start | Advance | Stop]
stite#{siteid}::state [Submitted | Queued | Starting | Running | Stopping | Stopped]
stite#{siteid}::cur#{pointid}
stite#{siteid}::name#{pointid}
stite#{siteid}::time
stite#{siteid}::step

scaling:queue-size
scaling::jobs-running-count

## channels

site#{siteid}:notify
Possible messages are: [Advance | Complete | Stop]

# Mongo 

recs [
  {
    _id,
    site_ref,
    rec {
      id,
      dis,
      ...other tags
    }
  }
]

sites [
  {
    _id,
    dis
    points [
      {id, dis},
      ...
    ]
  }
]


