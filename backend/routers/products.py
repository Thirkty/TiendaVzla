"""Endpoints del catálogo de productos."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Product, Seller, SellerStatus
from schemas import ProductOut

router = APIRouter(prefix="/api/products", tags=["Productos"])

DbSession = Annotated[Session, Depends(get_db)]


def _public_products():
    """Productos visibles: publicados por su vendedor y de tiendas aprobadas."""
    return (
        select(Product)
        .join(Product.seller)
        .where(Product.is_active.is_(True), Seller.status == SellerStatus.ACTIVE)
        .options(joinedload(Product.seller))
    )


@router.get("", response_model=list[ProductOut])
def list_products(
    db: DbSession,
    category: Annotated[str | None, Query(max_length=80)] = None,
) -> list[ProductOut]:
    """Lista los productos visibles (opcionalmente filtrados por categoría)."""
    stmt = _public_products().order_by(Product.created_at.desc(), Product.name)
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
    product = db.scalar(_public_products().where(Product.slug == slug))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return ProductOut.model_validate(product)
