"""Endpoints del checkout, envío de la referencia de pago y administración de órdenes."""
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from auth import require_admin
from database import ORDER_TTL_MINUTES, get_db
from models import Customer, Order, OrderItem, OrderStatus, Product
from schemas import AdminOrderOut, CheckoutIn, OrderOut, OrderStatusUpdateIn, PaymentIn
from services.orders import ADMIN_TRANSITIONS, cancel_order, is_expired, lock_order, now
from services.rates import get_current_rate

router = APIRouter(prefix="/api", tags=["Órdenes"])

DbSession = Annotated[Session, Depends(get_db)]
CENTS = Decimal("0.01")


# ---------- Helpers ----------


def _order_query():
    """Consulta de órdenes con items, productos y cliente precargados."""
    return select(Order).options(
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.customer),
    )


def _load_order(db: Session, order_id: uuid.UUID) -> Order:
    order = db.scalar(
        _order_query()
        .where(Order.id == order_id)
        .execution_options(populate_existing=True)  # refresca datos tras el commit
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    return order


# ---------- Checkout ----------


@router.post("/checkout", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutIn, db: DbSession) -> OrderOut:
    """Valida stock, calcula totales con precios de la BD y crea la orden en PENDING.

    El stock se descuenta al crear la orden y queda apartado ORDER_TTL_MINUTES;
    si en ese tiempo no llega la referencia de pago, la orden se cancela sola.
    """
    # 1. Agrupar cantidades por producto (por si el carrito trae duplicados).
    quantities: dict[uuid.UUID, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    # 2. Bloquear las filas de los productos para evitar sobreventa concurrente.
    products = db.scalars(
        select(Product)
        .where(Product.id.in_(list(quantities)))
        .order_by(Product.id)  # orden fijo para evitar deadlocks
        .with_for_update()
    ).all()
    by_id = {p.id: p for p in products}

    missing = [str(pid) for pid in quantities if pid not in by_id]
    if missing:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Algunos productos no existen", "productIds": missing},
        )

    out_of_stock = [
        {
            "productId": str(pid),
            "name": by_id[pid].name,
            "requested": qty,
            "available": by_id[pid].stock,
        }
        for pid, qty in quantities.items()
        if qty > by_id[pid].stock
    ]
    if out_of_stock:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Stock insuficiente", "items": out_of_stock},
        )

    # 3. Totales (siempre con el precio de la BD, nunca el que manda el cliente).
    total_usd = sum(
        (by_id[pid].price_usd * qty for pid, qty in quantities.items()), Decimal("0")
    ).quantize(CENTS, rounding=ROUND_HALF_UP)
    bcv_rate = get_current_rate(db).rate
    total_ves = (total_usd * bcv_rate).quantize(CENTS, rounding=ROUND_HALF_UP)

    # 4. Vincular al cliente por cédula. Si ya existe NO se tocan sus datos: cualquiera
    #    puede escribir una cédula ajena, así que eso no puede cambiar datos de otro.
    data = payload.customer
    customer = db.scalar(select(Customer).where(Customer.cedula == data.cedula))
    if customer is None:
        customer = Customer(
            cedula=data.cedula,
            name=data.name,
            phone=data.phone,
            address_state=data.address_state,
            address_city=data.address_city,
            address_street=data.address_street,
            address_reference=data.address_reference,
        )
        db.add(customer)

    # 5. Crear la orden y descontar stock.
    order = Order(
        customer=customer,
        # Los datos de este envío se guardan en la orden, tal como los escribió el cliente.
        shipping_name=data.name,
        shipping_cedula=data.cedula,
        shipping_phone=data.phone,
        shipping_state=data.address_state,
        shipping_city=data.address_city,
        shipping_street=data.address_street,
        shipping_reference=data.address_reference,
        total_usd=total_usd,
        total_ves=total_ves,
        bcv_rate=bcv_rate,
        status=OrderStatus.PENDING,
        expires_at=now() + timedelta(minutes=ORDER_TTL_MINUTES),
        items=[
            OrderItem(product_id=pid, quantity=qty, price_at_purchase=by_id[pid].price_usd)
            for pid, qty in quantities.items()
        ],
    )
    for pid, qty in quantities.items():
        by_id[pid].stock -= qty
    db.add(order)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar la orden. Intenta de nuevo.",
        ) from exc

    return OrderOut.model_validate(_load_order(db, order.id))


# ---------- Pago ----------


@router.post("/orders/{order_id}/pay", response_model=OrderOut)
def submit_payment(
    order_id: Annotated[uuid.UUID, Path()],
    payload: PaymentIn,
    db: DbSession,
) -> OrderOut:
    """El cliente envía la referencia del Pago Móvil: PENDING -> PAYMENT_SUBMITTED.

    El pago NO queda confirmado: el admin lo verifica en el banco y lo aprueba.
    """
    order = lock_order(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    if is_expired(order):
        cancel_order(order, "Venció el tiempo para pagar")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta orden venció y los productos se liberaron. Haz el pedido de nuevo.",
        )
    if order.status != OrderStatus.PENDING:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La orden no está pendiente de pago (estado actual: {order.status.value})",
        )

    order.status = OrderStatus.PAYMENT_SUBMITTED
    order.payment_reference = payload.reference
    order.payment_submitted_at = now()
    order.expires_at = None  # ya no vence: queda esperando la verificación
    db.commit()

    return OrderOut.model_validate(_load_order(db, order_id))


# ---------- Admin ----------


@router.get(
    "/admin/orders",
    response_model=list[AdminOrderOut],
    dependencies=[Depends(require_admin)],
)
def list_orders(
    db: DbSession,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AdminOrderOut]:
    """Lista los pedidos (más recientes primero). Requiere el header X-Admin-Key."""
    stmt = _order_query().order_by(Order.created_at.desc()).limit(limit).offset(offset)
    if status_filter is not None:
        stmt = stmt.where(Order.status == status_filter)
    orders = db.scalars(stmt).all()
    return [AdminOrderOut.model_validate(o) for o in orders]


@router.get(
    "/admin/orders/summary",
    response_model=dict[OrderStatus, int],
    dependencies=[Depends(require_admin)],
)
def orders_summary(db: DbSession) -> dict[OrderStatus, int]:
    """Cantidad de órdenes por estado (para los contadores del panel)."""
    rows = db.execute(select(Order.status, func.count()).group_by(Order.status)).all()
    counts = {s: 0 for s in OrderStatus}
    counts.update({status_: count for status_, count in rows})
    return counts


@router.patch(
    "/admin/orders/{order_id}/status",
    response_model=AdminOrderOut,
    dependencies=[Depends(require_admin)],
)
def update_order_status(
    order_id: Annotated[uuid.UUID, Path()],
    payload: OrderStatusUpdateIn,
    db: DbSession,
) -> AdminOrderOut:
    """Cambia el estado de una orden respetando el flujo permitido.

    - PAYMENT_SUBMITTED -> PAID: pago verificado en el banco.
    - PAYMENT_SUBMITTED -> PENDING: referencia rechazada; el cliente puede reenviarla.
    - Cualquier cancelación devuelve el stock.
    """
    order = lock_order(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    target = payload.status
    if target not in ADMIN_TRANSITIONS[order.status]:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede pasar de {order.status.value} a {target.value}",
        )

    if target == OrderStatus.CANCELLED:
        cancel_order(order, payload.reason or "Cancelada por el administrador")
    elif target == OrderStatus.PENDING:
        # Referencia rechazada: se limpia y el cliente tiene otro plazo para pagar.
        order.status = OrderStatus.PENDING
        order.payment_reference = None
        order.payment_submitted_at = None
        order.expires_at = now() + timedelta(minutes=ORDER_TTL_MINUTES)
    else:
        order.status = target
        if target == OrderStatus.PAID:
            order.paid_at = now()

    db.commit()
    return AdminOrderOut.model_validate(_load_order(db, order_id))
