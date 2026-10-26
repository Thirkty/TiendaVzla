"""Modelos de la base de datos (SQLAlchemy 2.0, PostgreSQL)."""
import enum
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"  # orden creada, esperando el Pago Móvil (vence en ORDER_TTL_MINUTES)
    PAYMENT_SUBMITTED = "PAYMENT_SUBMITTED"  # el cliente envió la referencia; falta verificarla
    PAID = "PAID"  # el admin verificó el pago en el banco
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_products_stock_non_negative"),
        CheckConstraint("price_usd >= 0", name="ck_products_price_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    price_usd: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    original_price_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    badge: Mapped[str | None] = mapped_column(String(40))
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Customer(Base):
    """Cliente identificado por su cédula.

    Guarda los datos con los que compró por primera vez y NUNCA se modifica desde el
    checkout: cualquiera puede escribir una cédula, así que no puede servir para
    cambiar los datos de otra persona. Los datos de cada envío viven en la orden.
    """

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cedula: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(11))
    address_state: Mapped[str] = mapped_column(String(60))
    address_city: Mapped[str] = mapped_column(String(80))
    address_street: Mapped[str] = mapped_column(String(255))
    address_reference: Mapped[str | None] = mapped_column(String(255))

    orders: Mapped[list["Order"]] = relationship(back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), index=True
    )
    total_usd: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_ves: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    # Extras útiles: la tasa usada al comprar y la referencia del Pago Móvil.
    bcv_rate: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    payment_reference: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), default=OrderStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Mientras está en PENDING, si pasa esta fecha la orden se cancela y se libera el stock.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    payment_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(String(200))

    # Datos de contacto y envío tal como los escribió el cliente en ESTE pedido.
    shipping_name: Mapped[str] = mapped_column(String(120))
    shipping_cedula: Mapped[str] = mapped_column(String(12))
    shipping_phone: Mapped[str] = mapped_column(String(11))
    shipping_state: Mapped[str] = mapped_column(String(60))
    shipping_city: Mapped[str] = mapped_column(String(80))
    shipping_street: Mapped[str] = mapped_column(String(255))
    shipping_reference: Mapped[str | None] = mapped_column(String(255))

    customer: Mapped[Customer] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

    @property
    def shipping(self) -> "ShippingInfo":
        return ShippingInfo(
            name=self.shipping_name,
            cedula=self.shipping_cedula,
            phone=self.shipping_phone,
            address_state=self.shipping_state,
            address_city=self.shipping_city,
            address_street=self.shipping_street,
            address_reference=self.shipping_reference,
        )


@dataclass(frozen=True)
class ShippingInfo:
    """Vista de los datos de envío de una orden (para la respuesta del admin)."""

    name: str
    cedula: str
    phone: str
    address_state: str
    address_city: str
    address_street: str
    address_reference: str | None


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer)
    price_at_purchase: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class ExchangeRate(Base):
    """Historial de la tasa BCV. La vigente es la de valid_from más reciente que ya empezó."""

    __tablename__ = "exchange_rates"
    __table_args__ = (CheckConstraint("rate > 0", name="ck_exchange_rates_rate_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    source: Mapped[str] = mapped_column(String(20))  # "bcv", "dolarapi", "manual" o "env"
    # "Fecha Valor" del BCV: el día (hora de Venezuela) desde el que rige esta tasa.
    valid_from: Mapped[date] = mapped_column(Date, index=True)
    # Fecha de publicación según la fuente, si la informa (solo DolarApi).
    source_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
