"""Administración de la tienda: productos, fotos y configuración (Pago Móvil, WhatsApp).

TiendaVzla vende con una sola tienda, la de la casa (slug "tiendavzla"). Por dentro sigue
siendo un Seller: así los pedidos llevan sus datos de Pago Móvil y, si algún día se abre
a otros vendedores, no hay que rehacer el modelo.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from auth import require_admin
from database import get_db
from models import Product, ProductSupplier, Seller
from schemas import (
    SellerProductIn,
    SellerProductOut,
    SellerProductPatch,
    StoreSettingsIn,
    StoreSettingsOut,
    UploadOut,
)
from services.catalog import MAX_UPLOAD_BYTES, save_product_image, unique_slug

HOUSE_STORE_SLUG = "tiendavzla"

router = APIRouter(prefix="/api/admin", tags=["Admin · Tienda"], dependencies=[Depends(require_admin)])

DbSession = Annotated[Session, Depends(get_db)]

# Campos que una edición no puede dejar vacíos.
REQUIRED_FIELDS = {"name", "price_usd", "shipping_cost_usd", "stock", "image_url", "is_active"}


def get_store(db: DbSession) -> Seller:
    store = db.scalar(select(Seller).where(Seller.slug == HOUSE_STORE_SLUG))
    if store is None:  # la crea la migración 0005; si falta, la base está incompleta
        raise HTTPException(status_code=500, detail="Falta la tienda principal. Corre `alembic upgrade head`.")
    return store


Store = Annotated[Seller, Depends(get_store)]


# ---------- Configuración ----------


@router.get("/store", response_model=StoreSettingsOut)
def store_settings(store: Store) -> StoreSettingsOut:
    return StoreSettingsOut.model_validate(store)


@router.put("/store", response_model=StoreSettingsOut)
def update_store_settings(payload: StoreSettingsIn, store: Store, db: DbSession) -> StoreSettingsOut:
    """Nombre, WhatsApp y datos de Pago Móvil que ven los clientes al pagar."""
    for field, value in payload.model_dump().items():
        setattr(store, field, value)
    db.commit()
    return StoreSettingsOut.model_validate(store)


# ---------- Productos ----------


@router.get("/products", response_model=list[SellerProductOut])
def list_products(store: Store, db: DbSession) -> list[SellerProductOut]:
    """Todos los productos, publicados u ocultos."""
    products = db.scalars(
        select(Product)
        .where(Product.seller_id == store.id)
        .options(selectinload(Product.offers).selectinload(ProductSupplier.supplier))
        .order_by(Product.created_at.desc())
    ).all()
    return [SellerProductOut.model_validate(p) for p in products]


@router.post("/products", response_model=SellerProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: SellerProductIn, store: Store, db: DbSession) -> SellerProductOut:
    product = Product(
        seller=store,
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
    db: DbSession,
) -> SellerProductOut:
    """Cambia solo los campos enviados. Para "borrar" un producto se oculta
    (isActive=false), porque las órdenes viejas lo siguen referenciando."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
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
    file: Annotated[UploadFile, File(description="Imagen JPG, PNG o WebP de hasta 5 MB")],
) -> UploadOut:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        url = save_product_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UploadOut(url=url)
