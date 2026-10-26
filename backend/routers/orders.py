"""Endpoints del checkout (un pedido por vendedor), envío de la referencia de pago y
administración de órdenes."""
import uuid
from collections import defaultdict
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from auth import require_admin
from database import ORDER_TTL_MINUTES, get_db
from models import Customer, Order, OrderItem, OrderStatus, Product, SellerStatus
from schemas import (
    AdminOrderOut,
    CheckoutIn,
    CheckoutOut,
    OrderOut,
    OrderStatusUpdateIn,
    PaymentIn,
)
from services.orders import (
    TransitionError,
    cancel_order,
    change_status,
    is_expired,
    lock_order,
    now,
)
from services.rates import get_current_rate

router = APIRouter(prefix="/api", tags=["Órdenes"])

DbSession = Annotated[Session, Depends(get_db)]
CENTS = Decimal("0.01")


# ---------- Helpers ----------


def order_query():
    """Consulta de órdenes con items, productos, vendedor y cliente precargados."""
    return select(Order).options(
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.customer),
        joinedload(Order.seller),
    )


def load_order(db: Session, order_id: uuid.UUID) -> Order:
    order = db.scalar(
        order_query()
        .where(Order.id == order_id)
        .execution_options(populate_existing=True)  # refresca datos tras el commit
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    return order


def money(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def apply_status_change(
    db: Session, order: Order, payload: OrderStatusUpdateIn, *, cancelled_by: str
) -> None:
    """Aplica el cambio pedido o responde 400 con el motivo."""
    try:
        change_status(
            order,
            payload.status,
            reason=payload.reason,
            carrier=payload.carrier,
            tracking_number=payload.tracking_number,
            cancelled_by=cancelled_by,
        )
    except TransitionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()


# ---------- Checkout ----------


@router.post("/checkout", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def checkout(payload: CheckoutIn, db: DbSession) -> CheckoutOut:
    """Valida stock y crea UNA orden PENDING por vendedor (todas con el mismo checkoutId).

    Cada orden se paga por separado al Pago Móvil de su vendedor. Precios y envío salen
    de la BD, nunca del cliente. El envío de cada vendedor es el mayor costo de envío de
    sus productos en el carrito (se despacha en un solo paquete).
    El stock queda apartado ORDER_TTL_MINUTES; si no llega la referencia, se libera.
    """
    # 1. Agrupar cantidades por producto (por si el carrito trae duplicados).
    quantities: dict[uuid.UUID, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    # 2. Bloquear las filas de los productos para evitar sobreventa concurrente.
    products = db.scalars(
        select(Product)
        .where(Product.id.in_(list(quantities)))
        .options(joinedload(Product.seller))
        .order_by(Product.id)  # orden fijo para evitar deadlocks
        .with_for_update(of=Product)
    ).all()
    by_id = {p.id: p for p in products}

    missing = [str(pid) for pid in quantities if pid not in by_id]
    if missing:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Algunos productos no existen", "productIds": missing},
        )

    unavailable = [
        by_id[pid].name
        for pid in quantities
        if not by_id[pid].is_active or by_id[pid].seller.status != SellerStatus.ACTIVE
    ]
    if unavailable:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Ya no están disponibles: " + ", ".join(unavailable), "items": []},
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

    # 3. Vincular al cliente por cédula. Si ya existe NO se tocan sus datos: cualquiera
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

    # 4. Una orden por vendedor.
    by_seller: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for pid in quantities:
        by_seller[by_id[pid].seller_id].append(pid)

    bcv_rate = get_current_rate(db).rate
    checkout_id = uuid.uuid4()
    expires_at = now() + timedelta(minutes=ORDER_TTL_MINUTES)
    for seller_id, product_ids in by_seller.items():
        subtotal = money(
            sum((by_id[pid].price_usd * quantities[pid] for pid in product_ids), Decimal("0"))
        )
        shipping = money(max(by_id[pid].shipping_cost_usd for pid in product_ids))
        total = subtotal + shipping
        db.add(
            Order(
                customer=customer,
                seller_id=seller_id,
                checkout_id=checkout_id,
                # Los datos de este envío se guardan en la orden, tal como los escribió el cliente.
                shipping_name=data.name,
                shipping_cedula=data.cedula,
                shipping_phone=data.phone,
                shipping_state=data.address_state,
                shipping_city=data.address_city,
                shipping_street=data.address_street,
                shipping_reference=data.address_reference,
                subtotal_usd=subtotal,
                shipping_usd=shipping,
                total_usd=total,
                total_ves=money(total * bcv_rate),
                bcv_rate=bcv_rate,
                status=OrderStatus.PENDING,
                expires_at=expires_at,
                items=[
                    OrderItem(
                        product_id=pid,
                        quantity=quantities[pid],
                        price_at_purchase=by_id[pid].price_usd,
                    )
                    for pid in product_ids
                ],
            )
        )

    for pid, qty in quantities.items():
        by_id[pid].stock -= qty

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar el pedido. Intenta de nuevo.",
        ) from exc

    orders = db.scalars(
        order_query().where(Order.checkout_id == checkout_id).order_by(Order.total_usd.desc())
    ).all()
    return CheckoutOut(checkout_id=checkout_id, orders=[OrderOut.model_validate(o) for o in orders])


# ---------- Pago ----------


@router.post("/orders/{order_id}/pay", response_model=OrderOut)
def submit_payment(
    order_id: Annotated[uuid.UUID, Path()],
    payload: PaymentIn,
    db: DbSession,
) -> OrderOut:
    """El cliente envía la referencia del Pago Móvil: PENDING -> PAYMENT_SUBMITTED.

    El pago NO queda confirmado: el vendedor lo verifica en su banco y lo aprueba.
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

    return OrderOut.model_validate(load_order(db, order_id))


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
    """Lista los pedidos de todos los vendedores (más recientes primero)."""
    stmt = order_query().order_by(Order.created_at.desc()).limit(limit).offset(offset)
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
    """Cambia el estado de cualquier orden (soporte y disputas), con las mismas reglas
    que el vendedor."""
    order = lock_order(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    apply_status_change(db, order, payload, cancelled_by="el administrador")
    return AdminOrderOut.model_validate(load_order(db, order_id))
