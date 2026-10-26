"""Reglas de negocio de las órdenes: transiciones de estado, cancelación y vencimiento."""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import ORDER_TTL_MINUTES
from models import Order, OrderItem, OrderStatus, Product

log = logging.getLogger("tiendavzla.orders")

S = OrderStatus

# Estados a los que el vendedor de la orden (o el admin) puede moverla desde cada estado.
TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    S.PENDING: {S.CANCELLED},
    # Aprobar el pago, rechazar la referencia (vuelve a PENDING) o cancelar.
    S.PAYMENT_SUBMITTED: {S.PAID, S.PENDING, S.CANCELLED},
    S.PAID: {S.PROCESSING, S.CANCELLED},
    S.PROCESSING: {S.SHIPPED, S.CANCELLED},
    S.SHIPPED: {S.DELIVERED},
    S.DELIVERED: set(),
    S.CANCELLED: set(),
}


def now() -> datetime:
    return datetime.now(timezone.utc)


def is_expired(order: Order) -> bool:
    return (
        order.status == S.PENDING
        and order.expires_at is not None
        and order.expires_at <= now()
    )


def cancel_order(order: Order, reason: str) -> None:
    """Cancela la orden y devuelve el stock. Usar sobre una orden obtenida con lock_order."""
    for item in order.items:
        item.product.stock += item.quantity
    order.status = S.CANCELLED
    order.cancelled_at = now()
    order.cancel_reason = reason[:200]
    order.expires_at = None


# Agencias con las que se puede despachar (el vendedor elige al marcar "enviado").
CARRIERS = (
    "MRW",
    "Zoom",
    "Tealca",
    "Domesa",
    "Liberty Express",
    "Delivery propio",
    "Retiro en persona",
    "Otro",
)


class TransitionError(ValueError):
    """Cambio de estado no permitido o con datos faltantes (el mensaje es para el usuario)."""


def change_status(
    order: Order,
    target: OrderStatus,
    *,
    reason: str | None = None,
    carrier: str | None = None,
    tracking_number: str | None = None,
    cancelled_by: str = "el vendedor",
) -> None:
    """Aplica un cambio de estado validado. Usar sobre una orden obtenida con lock_order.

    - PAYMENT_SUBMITTED -> PAID: pago verificado en el banco.
    - PAYMENT_SUBMITTED -> PENDING: referencia rechazada; el cliente tiene otro plazo.
    - -> SHIPPED exige agencia y número de guía.
    - Cualquier cancelación devuelve el stock.
    """
    if target not in TRANSITIONS[order.status]:
        raise TransitionError(f"No se puede pasar de {order.status.value} a {target.value}")

    if target == S.CANCELLED:
        cancel_order(order, reason or f"Cancelada por {cancelled_by}")
    elif target == S.PENDING:
        order.status = S.PENDING
        order.payment_reference = None
        order.payment_submitted_at = None
        order.expires_at = now() + timedelta(minutes=ORDER_TTL_MINUTES)
    elif target == S.SHIPPED:
        if carrier not in CARRIERS:
            raise TransitionError("Elige la agencia de envío")
        if not tracking_number:
            raise TransitionError("Escribe el número de guía (o una referencia del envío)")
        order.status = S.SHIPPED
        order.carrier = carrier
        order.tracking_number = tracking_number
        order.shipped_at = now()
    else:
        order.status = target
        if target == S.PAID:
            order.paid_at = now()
        elif target == S.DELIVERED:
            order.delivered_at = now()


def lock_order(db: Session, order_id: uuid.UUID) -> Order | None:
    """Carga la orden (con items y productos) bloqueando la orden y sus productos.

    Los productos se bloquean en orden fijo por id, igual que en el checkout, para
    no pisar el stock de una compra concurrente ni provocar deadlocks.
    """
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .with_for_update(of=Order)
        .execution_options(populate_existing=True)
    )
    if order is not None and order.items:
        # populate_existing refresca el stock con el valor leído ya bajo el bloqueo.
        db.scalars(
            select(Product)
            .where(Product.id.in_([i.product_id for i in order.items]))
            .order_by(Product.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()
    return order


def expire_pending_orders(db: Session) -> int:
    """Cancela las órdenes PENDING vencidas y libera su stock. Devuelve cuántas canceló."""
    expired_ids = db.scalars(
        select(Order.id)
        .where(Order.status == S.PENDING, Order.expires_at <= now())
        .with_for_update(skip_locked=True)  # seguro con varios workers
    ).all()
    count = 0
    for order_id in expired_ids:
        order = lock_order(db, order_id)
        if order is not None and is_expired(order):
            cancel_order(order, "Venció el tiempo para pagar")
            count += 1
    db.commit()
    if count:
        log.info("Órdenes vencidas canceladas: %d", count)
    return count
