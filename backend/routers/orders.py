"""Endpoints del checkout, pago simulado y administración de órdenes."""
import secrets
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import ADMIN_API_KEY, BCV_RATE, get_db
from models import Customer, Order, OrderItem, OrderStatus, Product
from schemas import AdminOrderOut, CheckoutIn, OrderOut, PaymentIn

router = APIRouter(prefix="/api", tags=["Órdenes"])

DbSession = Annotated[Session, Depends(get_db)]
CENTS = Decimal("0.01")


# ---------- Helpers ----------


def require_admin(x_admin_key: Annotated[str | None, Header()] = None) -> None:
    """Protege los endpoints de admin con el header X-Admin-Key."""
    if not x_admin_key or not secrets.compare_digest(
        x_admin_key.encode(), ADMIN_API_KEY.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado",
        )


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

    El stock se descuenta al crear la orden (queda reservado para el cliente).
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
    total_ves = (total_usd * BCV_RATE).quantize(CENTS, rounding=ROUND_HALF_UP)

    # 4. Crear o actualizar el cliente (la cédula es la clave única).
    data = payload.customer
    customer = db.scalar(select(Customer).where(Customer.cedula == data.cedula))
    if customer is None:
        customer = Customer(cedula=data.cedula)
        db.add(customer)
    customer.name = data.name
    customer.phone = data.phone
    customer.address_state = data.address_state
    customer.address_city = data.address_city
    customer.address_street = data.address_street
    customer.address_reference = data.address_reference

    # 5. Crear la orden y descontar stock.
    order = Order(
        customer=customer,
        total_usd=total_usd,
        total_ves=total_ves,
        bcv_rate=BCV_RATE,
        status=OrderStatus.PENDING,
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


# ---------- Pago (simulado) ----------


@router.post("/orders/{order_id}/pay", response_model=OrderOut)
def confirm_payment(
    order_id: Annotated[uuid.UUID, Path()],
    payload: PaymentIn,
    db: DbSession,
) -> OrderOut:
    """Simula la confirmación del Pago Móvil: PENDING -> PAID."""
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    if order.status != OrderStatus.PENDING:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La orden no está pendiente de pago (estado actual: {order.status.value})",
        )

    order.status = OrderStatus.PAID
    order.payment_reference = payload.reference
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
