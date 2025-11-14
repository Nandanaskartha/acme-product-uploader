from sqlalchemy import Column, Integer, String, Numeric, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import validates

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    price = Column(Numeric(10, 2), nullable=False)
    active = Column(Boolean, default=True)

    # Case sensitive uniqueness on SKU
    __table_args__ = (
        Index("ix_unique_sku_lower", "sku", unique=True, postgresql_using="btree", postgresql_ops={"sku": "varchar_pattern_ops"}),
    )

    @validates("sku")
    def normalize_sku(self, key, value):
        return value.lower()
