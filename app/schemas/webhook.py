from pydantic import BaseModel, HttpUrl, validator
from typing import Optional
from datetime import datetime

class WebhookBase(BaseModel):
    name: str
    url: str
    event_type: str
    enabled: bool = True
    secret: Optional[str] = None
    headers: Optional[str] = None  # JSON string

    @validator('event_type')
    def validate_event_type(cls, v):
        allowed_events = ['product.created', 'product.updated', 'product.deleted', 'csv.completed']
        if v not in allowed_events:
            raise ValueError(f'event_type must be one of {allowed_events}')
        return v

class WebhookCreate(WebhookBase):
    pass

class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    event_type: Optional[str] = None
    enabled: Optional[bool] = None
    secret: Optional[str] = None
    headers: Optional[str] = None

    @validator('event_type')
    def validate_event_type(cls, v):
        if v is not None:
            allowed_events = ['product.created', 'product.updated', 'product.deleted', 'csv.completed']
            if v not in allowed_events:
                raise ValueError(f'event_type must be one of {allowed_events}')
        return v

class WebhookResponse(WebhookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    success_count: int
    failure_count: int

    class Config:
        orm_mode = True

class WebhookTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error: Optional[str] = None
    response_body: Optional[str] = None