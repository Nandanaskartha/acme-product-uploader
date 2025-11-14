from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
# DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = "postgresql+psycopg2://postgres:manayathu@localhost:5432/acme_products"

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
