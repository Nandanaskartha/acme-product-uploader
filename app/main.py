# app/main.py
import os
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse
import redis
import json
from app.tasks import process_csv_task
from app.progress import redis_client  

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV allowed")
    job_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{job_id}.csv")
    # Save streaming to disk to avoid memory blow
    with open(save_path, "wb") as fh:
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB
            if not chunk:
                break
            fh.write(chunk)

    # publish initial status
    redis_client.publish(f"progress:{job_id}", json.dumps({"status": "uploaded", "percent": 0}))

    # enqueue celery task
    process_csv_task.delay(job_id, save_path)

    return JSONResponse({"job_id": job_id})

@app.get("/progress/{job_id}")
def progress_sse(job_id: str):
    """
    Returns Server-Sent Events that stream progress messages from Redis pub/sub
    """
    pubsub = redis_client.pubsub()
    channel = f"progress:{job_id}"
    pubsub.subscribe(channel)

    def event_stream():
        try:
            for message in pubsub.listen():
                # message example: {'type': 'message', 'pattern': None, 'channel': b'progress:abc', 'data': b'...'}
                if message is None:
                    continue
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                # Redis returns bytes; ensure decode
                if isinstance(data, bytes):
                    payload = data.decode("utf-8")
                else:
                    payload = str(data)
                yield f"data: {payload}\n\n"
        finally:
            pubsub.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
