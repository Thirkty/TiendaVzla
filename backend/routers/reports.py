"""Reportes para el admin: cuánto se vendió y cuánto se ganó."""
from datetime import timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from auth import require_admin
from database import get_db
from models import Order, OrderStatus
from schemas import SalesSummaryOut
from services.orders import now

router = APIRouter(prefix="/api/admin/reports", tags=["Admin · Reportes"], dependencies=[Depends(require_admin)])

# Pedidos que cuentan como venta: pago verificado en adelante.
SOLD = (OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED)


@router.get("/summary", response_model=SalesSummaryOut)
def sales_summary(
    db: Annotated[Session, Depends(get_db)],
    days: Annotated[int, Query(ge=1, le=366)] = 30,
) -> SalesSummaryOut:
    """Ventas de los últimos `days` días (por fecha de pago). El margen se calcula solo con
    los items que tienen costo; los que no, se cuentan aparte para que se completen."""
    orders = db.scalars(
        select(Order)
        .where(Order.status.in_(SOLD), Order.paid_at >= now() - timedelta(days=days))
        .options(selectinload(Order.items))
    ).all()

    zero = Decimal("0")
    revenue = sum((o.subtotal_usd for o in orders), zero)
    shipping = sum((o.shipping_usd for o in orders), zero)
    costed_items = [i for o in orders for i in o.items if i.cost_at_purchase is not None]
    costed_revenue = sum((i.price_at_purchase * i.quantity for i in costed_items), zero)
    cost = sum((i.cost_at_purchase * i.quantity for i in costed_items), zero)
    profit = costed_revenue - cost
    missing = sum(i.quantity for o in orders for i in o.items if i.cost_at_purchase is None)

    return SalesSummaryOut(
        days=days,
        orders=len(orders),
        revenue_usd=revenue,
        shipping_usd=shipping,
        cost_usd=cost,
        profit_usd=profit,
        margin_pct=round(float(profit / costed_revenue * 100), 1) if costed_revenue else None,
        items_without_cost=missing,
    )
