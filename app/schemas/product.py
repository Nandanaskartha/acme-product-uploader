# app/schemas/product.py
from typing import Optional
from pydantic import BaseModel

class ProductCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    price: float
    active: bool = True

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str]
    price: float
    active: bool

    class Config:
        from_attributes = True 

