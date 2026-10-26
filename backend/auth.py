"""Protección de los endpoints de administración con el header X-Admin-Key."""
import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from database import ADMIN_API_KEY


def require_admin(x_admin_key: Annotated[str | None, Header()] = None) -> None:
    if not x_admin_key or not secrets.compare_digest(
        x_admin_key.encode(), ADMIN_API_KEY.encode()
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
