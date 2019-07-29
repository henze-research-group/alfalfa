import boto3
import time
import os

sqs = boto3.resource('sqs', region_name=os.environ['REGION'], endpoint_url=os.environ['JOB_QUEUE_URL'])
queue = sqs.Queue(url=os.environ['JOB_QUEUE_URL'])
ecsclient = boto3.client('ecs', region_name=os.environ['REGION'])

while True:
    # Check for the message_count to be staying the same 
    # or increasing for three consecutive points in time
    count = 0
    attempts = 0
    while attempts < 3:
        message_count = int(queue.attributes.get('ApproximateNumberOfMessages'))
        # Check if the message count is going up
        if message_count >= count:
            count = message_count
            attempts = attempts + 1
        else:
            # else the queue is going down so restart the attempts
            count = 0
            attempts = 0
        time.sleep(1)

    response = ecsclient.describe_services(cluster='worker_ecs_cluster',services=['worker-service'])['services'][0]
    desiredCount = int(response['desiredCount'])
    runningCount = int(response['runningCount'])
    pendingCount = int(response['pendingCount'])
    minimumCount = 1

    if (count > 0):
        adjustment = runningCount + count
        if adjustment > minimumCount:
            ecsclient.update_service(cluster='worker_ecs_cluster',
                service='worker-service',
                desiredCount=(adjustment))
            # cool down period
            time.sleep(30)
