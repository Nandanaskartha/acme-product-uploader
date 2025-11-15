import os
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Query, Depends
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse
import redis
import json
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.webhook import Webhook, Base as WebhookBase
from app.schemas.webhook import WebhookCreate, WebhookUpdate, WebhookResponse, WebhookTestResponse
from app.webhook_tasks import test_webhook_sync, trigger_webhooks_for_event

from app.database import SessionLocal
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.tasks import process_csv_task
from app.progress import redis_client

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#Webhook routes

@app.get("/webhooks", response_model=list[WebhookResponse])
def list_webhooks(db: Session = Depends(get_db)):
    """List all webhooks"""
    webhooks = db.query(Webhook).order_by(Webhook.created_at.desc()).all()
    return webhooks

@app.post("/webhooks", response_model=WebhookResponse)
def create_webhook(webhook: WebhookCreate, db: Session = Depends(get_db)):
    """Create a new webhook"""
    db_webhook = Webhook(**webhook.dict())
    db.add(db_webhook)
    db.commit()
    db.refresh(db_webhook)
    return db_webhook

@app.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
def get_webhook(webhook_id: int, db: Session = Depends(get_db)):
    """Get a single webhook by ID"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return webhook

@app.put("/webhooks/{webhook_id}", response_model=WebhookResponse)
def update_webhook(
    webhook_id: int,
    webhook_update: WebhookUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing webhook"""
    db_webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not db_webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Update fields
    for field, value in webhook_update.dict(exclude_unset=True).items():
        setattr(db_webhook, field, value)
    
    db.commit()
    db.refresh(db_webhook)
    return db_webhook

@app.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: int, db: Session = Depends(get_db)):
    """Delete a webhook"""
    db_webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not db_webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(db_webhook)
    db.commit()
    return {"message": "Webhook deleted successfully"}

@app.post("/webhooks/{webhook_id}/test", response_model=WebhookTestResponse)
def test_webhook(webhook_id: int, db: Session = Depends(get_db)):
    """Test a webhook by sending a sample event"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Test webhook synchronously to return immediate results
    result = test_webhook_sync(webhook_id)
    return result

@app.post("/webhooks/{webhook_id}/toggle")
def toggle_webhook(webhook_id: int, db: Session = Depends(get_db)):
    """Enable/disable a webhook"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    webhook.enabled = not webhook.enabled
    db.commit()
    db.refresh(webhook)
    
    return {
        "message": f"Webhook {'enabled' if webhook.enabled else 'disabled'}",
        "enabled": webhook.enabled
    }

#Product routes

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

# ==================== PRODUCT CRUD ENDPOINTS ====================

@app.delete("/products/bulk-delete")
def bulk_delete_products(db: Session = Depends(get_db)):
    """Delete all products (Story 3)"""
    try:
        count = db.query(Product).count()
        if count == 0:
            return {
                "success": True,
                "message": "No products to delete",
                "deleted_count": 0
            }
        
        db.query(Product).delete()
        db.commit()
        
        return {
            "success": True,
            "message": f"Successfully deleted {count} product(s)",
            "deleted_count": count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete products: {str(e)}"
        )

@app.get("/products")
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    active: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List products with pagination and filtering"""
    query = db.query(Product)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (func.lower(Product.sku).like(func.lower(search_term))) |
            (func.lower(Product.name).like(func.lower(search_term))) |
            (func.lower(Product.description).like(func.lower(search_term)))
        )
    
    if active and active != "all":
        is_active = active.lower() == "true"
        query = query.filter(Product.active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()
    
    return {
        "products": [ProductResponse.from_orm(p) for p in products],
        "total": total,
        "page": page,
        "limit": limit
    }

@app.post("/products", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    existing = db.query(Product).filter(
        func.lower(Product.sku) == func.lower(product.sku)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Product with SKU '{product.sku}' already exists"
        )
    
    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    trigger_webhooks_for_event.delay('product.created', {
        "product_id": db_product.id,
        "sku": db_product.sku,
        "name": db_product.name,
        "price": str(db_product.price)
    })
    
    return db_product

@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a single product by ID"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int, 
    product_update: ProductUpdate, 
    db: Session = Depends(get_db)
):
    """Update an existing product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check for SKU conflict if SKU is being updated
    if product_update.sku and product_update.sku.lower() != db_product.sku.lower():
        existing = db.query(Product).filter(
            func.lower(Product.sku) == func.lower(product_update.sku),
            Product.id != product_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Product with SKU '{product_update.sku}' already exists"
            )
    
    # Update fields
    for field, value in product_update.dict(exclude_unset=True).items():
        setattr(db_product, field, value)
    
    db.commit()
    db.refresh(db_product)

    trigger_webhooks_for_event.delay('product.updated', {
        "product_id": db_product.id,
        "sku": db_product.sku,
        "name": db_product.name,
        "price": str(db_product.price)
    })
    return db_product

@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product_data = {
        "product_id": db_product.id,
        "sku": db_product.sku,
        "name": db_product.name
    }

    db.delete(db_product)
    db.commit()
    trigger_webhooks_for_event.delay('product.deleted', product_data)
    return {"message": "Product deleted successfully"}

#Health checks

@app.get("/")
def root():
    return {"message": "Acme Product Manager API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}