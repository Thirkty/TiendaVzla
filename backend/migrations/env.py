"""Entorno de Alembic: usa la misma conexión (DATABASE_URL del .env) y los modelos de la app.

Comandos útiles (desde backend/ con el venv activo):
    alembic upgrade head                          # aplica las migraciones pendientes
    alembic revision --autogenerate -m "mensaje"  # crea una migración a partir de models.py
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context

# Permite importar database.py y models.py desde backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import models  # noqa: E402,F401  (registra los modelos en Base.metadata)
from database import DATABASE_URL, Base, engine  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Genera el SQL sin conectarse (alembic upgrade head --sql)."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
