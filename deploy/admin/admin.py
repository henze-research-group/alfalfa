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
    maximumCount = 950
    queueSize = 0
    jobsRunningCount = 0

    redis_client.set('scaling:workers-running-count', runningCount)
    redis_client.set('scaling:workers-desired-count', desiredCount)

    if redis_client.exists('scaling:queue-size'):
        queueSize = int(redis_client.get('scaling:queue-size'))
    if redis_client.exists('scaling:jobs-running-count'):
        jobsRunningCount = int(redis_client.get('scaling:jobs-running-count'))
    if redis_client.exists('scaling:minimum-count'):
        minimumCount = int(redis_client.get('scaling:minimum-count'))

    newDesiredCount = queueSize + jobsRunningCount
    if newDesiredCount > maximumCount:
        newDesiredCount = maximumCount

    if newDesiredCount < minimumCount:
        newDesiredCount = minimumCount

    if newDesiredCount != desiredCount:
        ecsclient.update_service(cluster='worker_ecs_cluster',
            service='worker-service',
            desiredCount=(newDesiredCount))

    time.sleep(10)
