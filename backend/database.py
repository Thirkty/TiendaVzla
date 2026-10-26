"""Conexión a PostgreSQL con SQLAlchemy 2.0 y configuración leída del .env."""
import os
from collections.abc import Generator
from decimal import Decimal, InvalidOperation

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno {name}. Revisa tu archivo .env")
    return value


# ---------- Configuración ----------

DATABASE_URL = _require_env("DATABASE_URL")
ADMIN_API_KEY = _require_env("ADMIN_API_KEY")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

try:
    BCV_RATE = Decimal(os.getenv("BCV_RATE", "40"))
    if BCV_RATE <= 0:
        raise InvalidOperation
except InvalidOperation as exc:
    raise RuntimeError("BCV_RATE debe ser un número mayor que 0") from exc

SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"

# ---------- SQLAlchemy ----------

engine = create_engine(
    DATABASE_URL,
    echo=SQL_ECHO,
    pool_pre_ping=True,  # descarta conexiones caídas antes de usarlas
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: abre una sesión por request y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
