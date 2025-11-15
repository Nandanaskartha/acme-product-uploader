import csv
import os
import io
from decimal import Decimal
from app.celery_app import celery
from app.database import SessionLocal, engine
from app.models.product import Product, Base
from app.progress import publish_progress
from sqlalchemy.dialects.postgresql import insert as pg_insert
from datetime import datetime

BATCH_SIZE = 1000


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
                if not sku:
                    processed_lines += 1
                    continue
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
        try:
            from app.webhook_tasks import trigger_webhooks_for_event
            trigger_webhooks_for_event.delay('csv.completed', {
                "job_id": job_id,
                "total_imported": processed_lines,
                "timestamp": datetime.utcnow().isoformat()
            })
        except ImportError:
            # Webhook tasks not available, skip
            pass
        
    except Exception as exc:
        publish_progress(job_id, {"status": "error", "message": str(exc)})
        raise self.retry(exc=exc)
    
def _bulk_upsert(rows: list):
    """
    Perform bulk upsert using PostgreSQL insert ... on_conflict_do_update
    """
    if not rows:
        return

    # Deduplicate rows by SKU - keep the last occurrence of each SKU
    seen_skus = {}
    for row in rows:
        sku = row['sku']
        if sku:  # Only process non-empty SKUs
            seen_skus[sku] = row
    
    unique_rows = list(seen_skus.values())
    if not unique_rows:
        return

    db = SessionLocal()
    try:
        products_table = Product.__table__
        insert_stmt = pg_insert(products_table).values(unique_rows)
        update_cols = {
            "name": insert_stmt.excluded.name,
            "description": insert_stmt.excluded.description,
            "price": insert_stmt.excluded.price,
            "active": insert_stmt.excluded.active,
        }
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=["sku"], 
            set_=update_cols
        )
        db.execute(upsert_stmt)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error during bulk upsert: {str(e)}")
        raise
    finally:
        db.close()
