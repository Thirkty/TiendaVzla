"""Endpoints de la tasa BCV (pública para mostrar precios en Bs., editable por el admin)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import require_admin
from database import get_db
from schemas import RateIn, RateOut
from services.rates import get_current_rate, refresh_official_rate, set_rate

router = APIRouter(prefix="/api", tags=["Tasa BCV"])


@router.get("/rate", response_model=RateOut)
def current_rate(db: Session = Depends(get_db)) -> RateOut:
    """Tasa vigente (Bs. por 1 USD) que usa el checkout."""
    return RateOut.model_validate(get_current_rate(db))


@router.put("/admin/rate", response_model=RateOut, dependencies=[Depends(require_admin)])
def update_rate(payload: RateIn, db: Session = Depends(get_db)) -> RateOut:
    """Fija la tasa a mano. Queda vigente hasta la próxima actualización automática."""
    return RateOut.model_validate(set_rate(db, payload.rate, source="manual"))


@router.post(
    "/admin/rate/refresh", response_model=RateOut, dependencies=[Depends(require_admin)]
)
def refresh_rate(db: Session = Depends(get_db)) -> RateOut:
    """Consulta ya mismo la tasa oficial del BCV."""
    try:
        return RateOut.model_validate(refresh_official_rate(db))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
