# app/main.py
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

# Import from local modules
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

# ==================== DATABASE DEPENDENCY ====================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================== CSV UPLOAD & PROGRESS ====================

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
    # Check for duplicate SKU (case-insensitive)
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
    return db_product

@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted successfully"}

@app.delete("/products/bulk-delete")
def bulk_delete_products(db: Session = Depends(get_db)):
    """Delete all products (Story 3)"""
    count = db.query(Product).count()
    db.query(Product).delete()
    db.commit()
    return {"message": f"Deleted {count} products"}

# ==================== HEALTH CHECK ====================

@app.get("/")
def root():
    return {"message": "Acme Product Manager API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}