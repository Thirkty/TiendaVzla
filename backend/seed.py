"""Carga los 6 productos de prueba (los mismos del frontend). Es seguro correrlo varias veces.

Uso:  alembic upgrade head   (crea las tablas)
      python seed.py
"""
from decimal import Decimal

from sqlalchemy import select

import models  # noqa: F401
from database import SessionLocal
from models import Product


def img(seed: str) -> str:
    return f"https://picsum.photos/seed/{seed}/600/600"


PRODUCTS = [
    dict(
        slug="ventilador-recargable-led",
        name='Ventilador Recargable 12" con Luz LED',
        description="Hasta 8 horas de autonomía con una sola carga. Tu aliado para dormir fresco cuando se va la luz, con 3 velocidades y lámpara LED integrada.",
        price_usd=Decimal("34.99"), original_price_usd=Decimal("44.99"), stock=15,
        image_url=img("ventilador-recargable"), category="Hogar", badge="Más vendido",
        rating=4.8, reviews_count=212,
    ),
    dict(
        slug="lampara-solar-sensor",
        name="Lámpara Solar con Sensor de Movimiento",
        description="Se carga sola con el sol y se enciende al detectar movimiento. Ideal para el patio, la entrada o el estacionamiento. Resistente a la lluvia.",
        price_usd=Decimal("19.99"), original_price_usd=Decimal("24.99"), stock=25,
        image_url=img("lampara-solar"), category="Energía", badge="Ahorra luz",
        rating=4.6, reviews_count=134,
    ),
    dict(
        slug="organizador-nevera-6-piezas",
        name="Set Organizador de Nevera (6 piezas)",
        description="Contenedores transparentes apilables para que la comida dure más y encuentres todo de un vistazo. Libres de BPA y fáciles de lavar.",
        price_usd=Decimal("16.50"), original_price_usd=None, stock=30,
        image_url=img("organizador-nevera"), category="Cocina", badge=None,
        rating=4.5, reviews_count=89,
    ),
    dict(
        slug="masajeador-cervical-electrico",
        name="Masajeador Cervical Eléctrico",
        description="Alivia la tensión de cuello y espalda después de un día largo. Función de calor, 6 modos de intensidad y batería recargable por USB.",
        price_usd=Decimal("27.90"), original_price_usd=Decimal("35.00"), stock=10,
        image_url=img("masajeador-cervical"), category="Bienestar", badge="Nuevo",
        rating=4.7, reviews_count=56,
    ),
    dict(
        slug="power-bank-solar-20000",
        name="Power Bank Solar 20.000 mAh",
        description="Carga tu teléfono hasta 5 veces. Panel solar de respaldo, linterna incorporada y dos puertos USB para que nunca te quedes incomunicado.",
        price_usd=Decimal("29.99"), original_price_usd=None, stock=4,
        image_url=img("power-bank-solar"), category="Energía", badge="Últimas unidades",
        rating=4.4, reviews_count=173,
    ),
    dict(
        slug="filtro-agua-grifo",
        name="Filtro de Agua para Grifo",
        description="Reduce cloro, sedimentos y mal sabor directo desde la llave. Instalación en minutos, sin herramientas y con cartucho de larga duración.",
        price_usd=Decimal("14.99"), original_price_usd=Decimal("19.99"), stock=20,
        image_url=img("filtro-agua"), category="Hogar", badge=None,
        rating=4.3, reviews_count=67,
    ),
]


def main() -> None:
    with SessionLocal() as db:
        existing = set(db.scalars(select(Product.slug)).all())
        new = [Product(**data) for data in PRODUCTS if data["slug"] not in existing]
        db.add_all(new)
        db.commit()
        print(f"Productos creados: {len(new)} (ya existían {len(existing)})")


if __name__ == "__main__":
    main()
