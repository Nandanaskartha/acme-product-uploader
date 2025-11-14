import os
import json
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL)

def publish_progress(job_id: str, payload: dict):
    channel = f"progress:{job_id}"
    redis_client.publish(channel, json.dumps(payload))
