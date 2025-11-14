# app/tasks.py
import csv
import os
import io
from decimal import Decimal
from app.celery_app import celery
from app.database import SessionLocal, engine
from app.models.product import Product, Base
from app.progress import publish_progress
from sqlalchemy.dialects.postgresql import insert as pg_insert

BATCH_SIZE = 1000

from app.celery_app import celery


@celery.task(bind=True, max_retries=3, default_retry_delay=10)
def process_csv_task(self, job_id: str, filepath: str):
    try:
        # Count total lines first
        with open(filepath, "r", encoding="utf-8") as fh:
            total_lines = sum(1 for _ in fh) - 1  # Subtract header
        
        if total_lines <= 0:
            publish_progress(job_id, {"status": "error", "message": "Empty CSV file"})
            return
        
        processed_lines = 0
        rows_buffer = []

        # Ensure tables exist
        Base.metadata.create_all(bind=engine)

        with open(filepath, "r", newline='', encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            
            for row in reader:
                # Normalizing and validating row fields
                sku = (row.get("sku") or "").strip().lower()
                name = (row.get("name") or "").strip()
                description = (row.get("description") or "").strip()
                price_raw = (row.get("price") or "0").strip()
                
                try:
                    price = Decimal(price_raw)
                except Exception:
                    price = Decimal("0.00")

                rows_buffer.append({
                    "sku": sku,
                    "name": name,
                    "description": description,
                    "price": price,
                    "active": True
                })

                processed_lines += 1

                # Batch insert and report progress
                if len(rows_buffer) >= BATCH_SIZE:
                    _bulk_upsert(rows_buffer)
                    rows_buffer = []

                    percent = round((processed_lines / total_lines) * 100, 2)
                    publish_progress(job_id, {
                        "status": "processing",
                        "processed": processed_lines,
                        "total": total_lines,
                        "percent": percent
                    })

            # Flush remaining rows
            if rows_buffer:
                _bulk_upsert(rows_buffer)

        # Final completion message
        publish_progress(job_id, {
            "status": "complete",
            "processed": processed_lines,
            "total": total_lines,
            "percent": 100
        })
        
    except Exception as exc:
        publish_progress(job_id, {"status": "error", "message": str(exc)})
        raise self.retry(exc=exc)
    
def _bulk_upsert(rows: list):
    """
    Perform bulk upsert using PostgreSQL insert ... on_conflict_do_update
    """
    if not rows:
        return

    db = SessionLocal()
    try:
        products_table = Product.__table__
        insert_stmt = pg_insert(products_table).values(rows)
        update_cols = {
            "name": insert_stmt.excluded.name,
            "description": insert_stmt.excluded.description,
            "price": insert_stmt.excluded.price,
            "active": insert_stmt.excluded.active,
        }
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=["sku"],  # since we store sku as lowercase and unique
            set_=update_cols
        )
        db.execute(upsert_stmt)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
