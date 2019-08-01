
# The following is the structure of the redis database

## These are the conventions used in the documentation 

The ```::``` separates keys and fields of a hash
The ```:``` is a naming convention to separate parts of a key
The ```#``` is a naming convention to separate parts of a key when there is a type followed by instance id
The ```[ ]``` denotes options in a set of possible values
The ```{ }``` denotes a name that is a placeholder for a specific key

## Structure

# keys

stite#{siteid}::action [Start | Advance | Stop]
stite#{siteid}::state [Queued | Starting | Running | Stopped]
stite#{siteid}::cur#{pointid}
stite#{siteid}::name#{pointid}
stite#{siteid}::time

scaling::queue-size
scaling::running-count

# channels

site#{siteid}:advancer
Possible messages are: [Advance | Complete]

