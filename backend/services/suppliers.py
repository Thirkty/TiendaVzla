"""Pedido al proveedor por WhatsApp: arma un mensaje por proveedor con sus items y los
datos de envío del cliente (en dropshipping el proveedor despacha directo)."""
from collections import defaultdict
from urllib.parse import quote

from models import Order, OrderItem, Supplier


def whatsapp_url(phone: str, text: str) -> str:
    """04141234567 -> https://wa.me/584141234567?text=..."""
    return f"https://wa.me/58{phone.removeprefix('0')}?text={quote(text)}"


def supplier_messages(order: Order) -> tuple[list[tuple[Supplier, str, str]], list[str]]:
    """Devuelve [(proveedor, mensaje, url)] y los nombres de productos sin proveedor."""
    by_supplier: dict = defaultdict(list)
    missing: list[str] = []
    for item in order.items:
        if item.supplier is None:
            missing.append(item.product.name)
        else:
            by_supplier[item.supplier.id].append(item)

    s = order.shipping
    address = f"{s.address_street}, {s.address_city}, {s.address_state}"
    if s.address_reference:
        address += f" (Ref: {s.address_reference})"

    result = []
    for items in by_supplier.values():
        supplier: Supplier = items[0].supplier
        lines = "\n".join(_item_line(i) for i in items)
        greeting = f"Hola {supplier.contact_name}" if supplier.contact_name else "Hola"
        text = (
            f"{greeting}, te hago un pedido de TiendaVzla (#{str(order.id)[:8].upper()}):\n\n"
            f"{lines}\n\n"
            f"Enviar a:\n{s.name} · C.I. {s.cedula} · Tel. {s.phone}\n{address}\n\n"
            "¿Me confirmas disponibilidad y el número de guía cuando despaches? ¡Gracias!"
        )
        result.append((supplier, text, whatsapp_url(supplier.whatsapp, text)))
    return result, missing


def _item_line(item: OrderItem) -> str:
    sku = next(
        (o.supplier_sku for o in item.product.offers if o.supplier_id == item.supplier_id and o.supplier_sku),
        None,
    )
    return f"• {item.quantity} × {item.product.name}" + (f" (cód. {sku})" if sku else "")
