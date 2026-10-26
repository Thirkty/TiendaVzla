"""Panel del vendedor: su tienda, sus productos y la subida de imágenes."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_current_seller
from database import get_db
from models import Product, Seller, SellerStatus
from schemas import (
    SellerOut,
    SellerProductIn,
    SellerProductOut,
    SellerProductPatch,
    SellerProfileIn,
    UploadOut,
)
from services.catalog import MAX_UPLOAD_BYTES, save_product_image, unique_slug

router = APIRouter(prefix="/api/seller", tags=["Vendedor"])

DbSession = Annotated[Session, Depends(get_db)]
CurrentSeller = Annotated[Seller, Depends(get_current_seller)]

# Campos que una edición no puede dejar vacíos.
REQUIRED_FIELDS = {"name", "price_usd", "shipping_cost_usd", "stock", "image_url", "is_active"}


def _writable(seller: Seller) -> Seller:
    """Una tienda suspendida no puede editar su catálogo."""
    if seller.status == SellerStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu tienda está suspendida. Escríbenos para revisarlo.",
        )
    return seller


def _own_product(db: Session, seller: Seller, product_id: uuid.UUID) -> Product:
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.seller_id == seller.id)
    )
    if product is None:  # tampoco se revela si existe en otra tienda
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return product


# ---------- Tienda ----------


@router.get("/me", response_model=SellerOut)
def my_store(seller: CurrentSeller) -> SellerOut:
    return SellerOut.model_validate(seller)


@router.put("/me", response_model=SellerOut)
def update_my_store(payload: SellerProfileIn, seller: CurrentSeller, db: DbSession) -> SellerOut:
    """Edita nombre, WhatsApp y datos de Pago Móvil (el enlace de la tienda no cambia)."""
    _writable(seller)
    for field, value in payload.model_dump().items():
        setattr(seller, field, value)
    db.commit()
    return SellerOut.model_validate(seller)


# ---------- Productos ----------


@router.get("/products", response_model=list[SellerProductOut])
def my_products(seller: CurrentSeller, db: DbSession) -> list[SellerProductOut]:
    """Todos los productos de la tienda, publicados u ocultos."""
    products = db.scalars(
        select(Product).where(Product.seller_id == seller.id).order_by(Product.created_at.desc())
    ).all()
    return [SellerProductOut.model_validate(p) for p in products]


@router.post("/products", response_model=SellerProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: SellerProductIn, seller: CurrentSeller, db: DbSession
) -> SellerProductOut:
    _writable(seller)
    product = Product(
        seller=seller,
        slug=unique_slug(db, Product.slug, payload.name),
        **payload.model_dump(),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return SellerProductOut.model_validate(product)


@router.patch("/products/{product_id}", response_model=SellerProductOut)
def update_product(
    product_id: Annotated[uuid.UUID, Path()],
    payload: SellerProductPatch,
    seller: CurrentSeller,
    db: DbSession,
) -> SellerProductOut:
    """Cambia solo los campos enviados. Para "borrar" un producto se oculta
    (isActive=false), porque las órdenes viejas lo siguen referenciando."""
    _writable(seller)
    product = _own_product(db, seller, product_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in REQUIRED_FIELDS:
            continue
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return SellerProductOut.model_validate(product)


# ---------- Imágenes ----------


@router.post("/uploads", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    seller: CurrentSeller,
    file: Annotated[UploadFile, File(description="Imagen JPG, PNG o WebP de hasta 5 MB")],
) -> UploadOut:
    _writable(seller)
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        url = save_product_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UploadOut(url=url)
