#!/bin/bash

# Start Celery worker in background with limited concurrency
celery -A app.celery_app worker --loglevel=info --concurrency=1 &

# Give celery a moment to start
sleep 2

# Start FastAPI with uvicorn
uvicorn app.main:app --host 0.0.0.0 --port $PORT