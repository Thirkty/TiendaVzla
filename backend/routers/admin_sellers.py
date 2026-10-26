"""Administración de vendedores: revisar registros, aprobar y suspender tiendas."""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from auth import require_admin
from database import get_db
from models import Product, Seller, SellerStatus
from schemas import AdminSellerOut, SellerStatusIn

router = APIRouter(
    prefix="/api/admin/sellers",
    tags=["Admin · Vendedores"],
    dependencies=[Depends(require_admin)],
)

DbSession = Annotated[Session, Depends(get_db)]


def _to_out(seller: Seller, products_count: int) -> AdminSellerOut:
    out = AdminSellerOut.model_validate(seller)
    out.email = seller.user.email if seller.user else None
    out.products_count = products_count
    return out


@router.get("", response_model=list[AdminSellerOut])
def list_sellers(
    db: DbSession,
    status_filter: Annotated[SellerStatus | None, Query(alias="status")] = None,
) -> list[AdminSellerOut]:
    counts = (
        select(Product.seller_id, func.count().label("n")).group_by(Product.seller_id).subquery()
    )
    stmt = (
        select(Seller, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.seller_id == Seller.id)
        .options(joinedload(Seller.user))
        .order_by(Seller.created_at.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(Seller.status == status_filter)
    return [_to_out(seller, n) for seller, n in db.execute(stmt).all()]


@router.patch("/{seller_id}/status", response_model=AdminSellerOut)
def update_seller_status(
    seller_id: Annotated[uuid.UUID, Path()],
    payload: SellerStatusIn,
    db: DbSession,
) -> AdminSellerOut:
    """Aprobar (ACTIVE), suspender (SUSPENDED) o devolver a revisión (PENDING)."""
    seller = db.get(Seller, seller_id)
    if seller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendedor no encontrado")
    seller.status = payload.status
    seller.status_note = payload.note
    if payload.status == SellerStatus.ACTIVE and seller.approved_at is None:
        seller.approved_at = datetime.now(timezone.utc)
    db.commit()
    count = db.scalar(
        select(func.count()).select_from(Product).where(Product.seller_id == seller.id)
    )
    return _to_out(seller, count or 0)
