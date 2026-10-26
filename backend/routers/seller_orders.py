"""Pedidos del vendedor: ver los suyos, verificar pagos y despachar con número de guía."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_current_seller
from database import get_db
from models import Order, OrderStatus, Seller
from routers.orders import apply_status_change, load_order, order_query
from schemas import OrderStatusUpdateIn, SellerOrderOut
from services.orders import CARRIERS, lock_order

router = APIRouter(prefix="/api/seller/orders", tags=["Vendedor · Pedidos"])

DbSession = Annotated[Session, Depends(get_db)]
CurrentSeller = Annotated[Seller, Depends(get_current_seller)]


@router.get("", response_model=list[SellerOrderOut])
def my_orders(
    seller: CurrentSeller,
    db: DbSession,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[SellerOrderOut]:
    stmt = (
        order_query()
        .where(Order.seller_id == seller.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter is not None:
        stmt = stmt.where(Order.status == status_filter)
    return [SellerOrderOut.model_validate(o) for o in db.scalars(stmt).all()]


@router.get("/summary", response_model=dict[OrderStatus, int])
def my_orders_summary(seller: CurrentSeller, db: DbSession) -> dict[OrderStatus, int]:
    rows = db.execute(
        select(Order.status, func.count())
        .where(Order.seller_id == seller.id)
        .group_by(Order.status)
    ).all()
    counts = {s: 0 for s in OrderStatus}
    counts.update({status_: count for status_, count in rows})
    return counts


@router.get("/carriers", response_model=list[str])
def carriers() -> list[str]:
    """Agencias que se pueden elegir al despachar."""
    return list(CARRIERS)


@router.patch("/{order_id}/status", response_model=SellerOrderOut)
def update_my_order_status(
    order_id: Annotated[uuid.UUID, Path()],
    payload: OrderStatusUpdateIn,
    seller: CurrentSeller,
    db: DbSession,
) -> SellerOrderOut:
    """Aprobar o rechazar el pago, preparar, despachar (con agencia y guía), entregar o
    cancelar un pedido propio. Funciona aunque la tienda esté suspendida, para no dejar
    pedidos pagados sin atender."""
    order = lock_order(db, order_id)
    if order is None or order.seller_id != seller.id:  # no se revela si es de otra tienda
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    apply_status_change(db, order, payload, cancelled_by="el vendedor")
    return SellerOrderOut.model_validate(load_order(db, order_id))
