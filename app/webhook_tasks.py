import json
import time
import requests
import hmac
import hashlib
from datetime import datetime
from app.celery_app import celery
from app.database import SessionLocal
from app.models.webhook import Webhook

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def trigger_webhook(self, webhook_id: int, event_type: str, payload: dict):
    """
    Asynchronously trigger a webhook with the given payload
    """
    db = SessionLocal()
    try:
        webhook = db.query(Webhook).filter(
            Webhook.id == webhook_id,
            Webhook.enabled == True
        ).first()
        
        if not webhook:
            return {"success": False, "error": "Webhook not found or disabled"}
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event_type,
            "X-Webhook-ID": str(webhook_id),
            "User-Agent": "AcmeProductManager/1.0"
        }
        
        # Add custom headers if provided
        if webhook.headers:
            try:
                custom_headers = json.loads(webhook.headers)
                headers.update(custom_headers)
            except:
                pass
        
        # Sign payload if secret is provided
        if webhook.secret:
            payload_str = json.dumps(payload, sort_keys=True)
            signature = hmac.new(
                webhook.secret.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        # Send webhook request
        start_time = time.time()
        response = requests.post(
            webhook.url,
            json=payload,
            headers=headers,
            timeout=10
        )
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        # Update webhook statistics
        webhook.last_triggered_at = datetime.utcnow()
        if response.status_code >= 200 and response.status_code < 300:
            webhook.success_count += 1
            db.commit()
            return {
                "success": True,
                "status_code": response.status_code,
                "response_time_ms": response_time
            }
        else:
            webhook.failure_count += 1
            db.commit()
            return {
                "success": False,
                "status_code": response.status_code,
                "response_time_ms": response_time,
                "error": f"HTTP {response.status_code}"
            }
            
    except requests.exceptions.Timeout:
        webhook.failure_count += 1
        db.commit()
        raise self.retry(exc=Exception("Webhook timeout"))
    
    except Exception as exc:
        webhook.failure_count += 1
        db.commit()
        raise self.retry(exc=exc)
    
    finally:
        db.close()

@celery.task
def trigger_webhooks_for_event(event_type: str, payload: dict):
    """
    Trigger all enabled webhooks for a specific event type
    """
    db = SessionLocal()
    try:
        webhooks = db.query(Webhook).filter(
            Webhook.event_type == event_type,
            Webhook.enabled == True
        ).all()
        
        for webhook in webhooks:
            # Dispatch each webhook asynchronously
            trigger_webhook.delay(webhook.id, event_type, payload)
        
        return {"triggered": len(webhooks)}
    
    finally:
        db.close()

def test_webhook_sync(webhook_id: int):
    """
    Synchronously test a webhook and return results immediately
    Used by the test endpoint
    """
    db = SessionLocal()
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        
        if not webhook:
            return {"success": False, "error": "Webhook not found"}
        
        # Prepare test payload
        test_payload = {
            "event": "test",
            "webhook_id": webhook_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "message": "This is a test webhook call",
                "test": True
            }
        }
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": "test",
            "X-Webhook-ID": str(webhook_id),
            "User-Agent": "AcmeProductManager/1.0"
        }
        
        # Add custom headers
        if webhook.headers:
            try:
                custom_headers = json.loads(webhook.headers)
                headers.update(custom_headers)
            except:
                pass
        
        # Sign payload if secret is provided
        if webhook.secret:
            payload_str = json.dumps(test_payload, sort_keys=True)
            signature = hmac.new(
                webhook.secret.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        # Send test request
        start_time = time.time()
        try:
            response = requests.post(
                webhook.url,
                json=test_payload,
                headers=headers,
                timeout=10
            )
            response_time = (time.time() - start_time) * 1000
            
            return {
                "success": response.status_code >= 200 and response.status_code < 300,
                "status_code": response.status_code,
                "response_time_ms": round(response_time, 2),
                "response_body": response.text[:500] if response.text else None
            }
        
        except requests.exceptions.Timeout:
            response_time = (time.time() - start_time) * 1000
            return {
                "success": False,
                "error": "Request timeout (10s)",
                "response_time_ms": round(response_time, 2)
            }
        
        except requests.exceptions.ConnectionError:
            response_time = (time.time() - start_time) * 1000
            return {
                "success": False,
                "error": "Connection failed",
                "response_time_ms": round(response_time, 2)
            }
        
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return {
                "success": False,
                "error": str(e),
                "response_time_ms": round(response_time, 2)
            }
    
    finally:
        db.close()