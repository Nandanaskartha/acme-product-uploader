from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    event_type = Column(String(100), nullable=False)  # product.created, product.updated, product.deleted, csv.completed
    enabled = Column(Boolean, default=True)
    secret = Column(String(255), nullable=True)  # Optional webhook secret for signing
    headers = Column(Text, nullable=True)  # JSON string of custom headers
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Statistics
    last_triggered_at = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)

    def __repr__(self):
        return f"<Webhook {self.name} - {self.event_type}>"