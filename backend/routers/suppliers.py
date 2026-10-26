"""Proveedores (dropshipping) y los costos de cada producto con cada proveedor."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from auth import require_admin
from database import get_db
from models import Product, ProductSupplier, Supplier
from schemas import ProductOffersIn, SellerProductOut, SupplierIn, SupplierOut

router = APIRouter(prefix="/api/admin", tags=["Admin · Proveedores"], dependencies=[Depends(require_admin)])

DbSession = Annotated[Session, Depends(get_db)]


def _to_out(supplier: Supplier, products_count: int) -> SupplierOut:
    out = SupplierOut.model_validate(supplier)
    out.products_count = products_count
    return out


def _count(db: Session, supplier_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(ProductSupplier).where(ProductSupplier.supplier_id == supplier_id)
    ) or 0


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(db: DbSession) -> list[SupplierOut]:
    counts = (
        select(ProductSupplier.supplier_id, func.count().label("n"))
        .group_by(ProductSupplier.supplier_id)
        .subquery()
    )
    rows = db.execute(
        select(Supplier, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.supplier_id == Supplier.id)
        .order_by(Supplier.is_active.desc(), Supplier.name)
    ).all()
    return [_to_out(s, n) for s, n in rows]


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierIn, db: DbSession) -> SupplierOut:
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return _to_out(supplier, 0)


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: Annotated[uuid.UUID, Path()], payload: SupplierIn, db: DbSession
) -> SupplierOut:
    """Edita los datos. Para "borrarlo" se desactiva (isActive=false): los pedidos viejos lo
    siguen referenciando."""
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    for field, value in payload.model_dump().items():
        setattr(supplier, field, value)
    db.commit()
    return _to_out(supplier, _count(db, supplier.id))


@router.put("/products/{product_id}/suppliers", response_model=SellerProductOut)
def set_product_offers(
    product_id: Annotated[uuid.UUID, Path()], payload: ProductOffersIn, db: DbSession
) -> SellerProductOut:
    """Reemplaza los proveedores del producto con sus costos. Como mucho uno preferido;
    si hay ofertas y ninguna es preferida, queda preferida la más barata."""
    product = db.scalar(
        select(Product).where(Product.id == product_id).options(selectinload(Product.offers))
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    offers = payload.offers
    ids = [o.supplier_id for o in offers]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un proveedor aparece dos veces")
    if sum(o.is_preferred for o in offers) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo puede haber un proveedor preferido")
    found = set(db.scalars(select(Supplier.id).where(Supplier.id.in_(ids))).all())
    if found != set(ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Algún proveedor no existe")

    product.offers.clear()
    db.flush()  # borra las ofertas viejas antes de insertar (restricción única)
    new = [ProductSupplier(**o.model_dump()) for o in offers]
    if new and not any(o.is_preferred for o in new):
        min(new, key=lambda o: o.cost_usd).is_preferred = True
    product.offers.extend(new)
    db.commit()

    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.offers).selectinload(ProductSupplier.supplier))
        .execution_options(populate_existing=True)
    )
    return SellerProductOut.model_validate(product)
