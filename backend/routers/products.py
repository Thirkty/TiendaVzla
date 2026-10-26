"""Endpoints del catálogo de productos."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Product
from schemas import ProductOut

router = APIRouter(prefix="/api/products", tags=["Productos"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[ProductOut])
def list_products(
    db: DbSession,
    category: Annotated[str | None, Query(max_length=80)] = None,
) -> list[ProductOut]:
    """Lista todos los productos (opcionalmente filtrados por categoría)."""
    stmt = select(Product).order_by(Product.created_at.desc(), Product.name)
    if category:
        stmt = stmt.where(Product.category == category)
    products = db.scalars(stmt).all()
    return [ProductOut.model_validate(p) for p in products]


@router.get("/{slug}", response_model=ProductOut)
def get_product(
    slug: Annotated[str, Path(max_length=160)],
    db: DbSession,
) -> ProductOut:
    """Devuelve un producto por su slug o 404 si no existe."""
    product = db.scalar(select(Product).where(Product.slug == slug))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return ProductOut.model_validate(product)
