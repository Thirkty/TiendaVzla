"""Utilidades del catálogo: slugs únicos e imágenes subidas por los vendedores."""
import io
import re
import secrets
import unicodedata
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import PUBLIC_API_URL, UPLOAD_DIR

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_SIDE = 1600
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

UPLOAD_PATH = Path(__file__).resolve().parents[1] / UPLOAD_DIR
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)


def slugify(text: str, max_length: int = 70) -> str:
    """'Ventilador Recargable 12" con Luz' -> 'ventilador-recargable-12-con-luz'"""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:max_length].rstrip("-") or "item"


def unique_slug(db: Session, column, base: str) -> str:
    """Devuelve `base` o `base-xxxx` si ya existe en la columna dada."""
    slug = slugify(base)
    while db.scalar(select(column).where(column == slug)) is not None:
        slug = f"{slugify(base, 64)}-{secrets.token_hex(2)}"
    return slug


def save_product_image(data: bytes) -> str:
    """Valida, achica y guarda la imagen como WebP. Devuelve su URL pública.

    Volver a codificar la imagen descarta los metadatos (EXIF/GPS de la foto) y
    cualquier contenido que no sea imagen.
    """
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("La imagen pesa más de 5 MB")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise ValueError("Formato no permitido. Usa JPG, PNG o WebP")
        with Image.open(io.BytesIO(data)) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            name = f"{secrets.token_hex(12)}.webp"
            img.save(UPLOAD_PATH / name, "WEBP", quality=85)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("El archivo no es una imagen válida") from exc
    return f"{PUBLIC_API_URL}/uploads/{name}"
