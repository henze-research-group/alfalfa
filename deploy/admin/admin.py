import boto3
import time
import os
import redis

sqs = boto3.resource('sqs', region_name=os.environ['REGION'], endpoint_url=os.environ['JOB_QUEUE_URL'])
ecsclient = boto3.client('ecs', region_name=os.environ['REGION'])
redis_client = redis.Redis(host=os.environ['REDIS_HOST'])

while True:
    response = ecsclient.describe_services(cluster='worker_ecs_cluster',services=['worker-service'])['services'][0]
    desiredCount = int(response['desiredCount'])
    runningCount = int(response['runningCount'])
    pendingCount = int(response['pendingCount'])
    minimumCount = 1
    maximumCount = 200
    queueSize = 0
    jobsRunningCount = 0

    if redis_client.exists('scaling:queue-size'):
        queueSize = int(redis_client.get('scaling:queue-size'))
    if redis_client.exists('scaling:jobs-running-count'):
        jobsRunningCount = int(redis_client.get('scaling:jobs-running-count'))

    newDesiredCount = queueSize + jobsRunningCount + minimumCount
    if newDesiredCount > maximumCount:
        newDesiredCount = maximumCount

    if newDesiredCount < 0:
        newDesiredCount = minimumCount

    if newDesiredCount != desiredCount:
        ecsclient.update_service(cluster='worker_ecs_cluster',
            service='worker-service',
            desiredCount=(newDesiredCount))

    time.sleep(30)
