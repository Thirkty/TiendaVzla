"""Endpoints de la tasa BCV (pública para mostrar precios en Bs., editable por el admin)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import require_admin
from database import get_db
from schemas import RateCheckOut, RateIn, RateOut, RateStatusOut
from services import rates as rate_service
from services.rates import (
    STALE_BUSINESS_DAYS,
    business_days_behind,
    get_current_rate,
    get_upcoming_rate,
    refresh_official_rate,
    set_rate,
)

router = APIRouter(prefix="/api", tags=["Tasa BCV"])


@router.get("/rate", response_model=RateOut)
def current_rate(db: Session = Depends(get_db)) -> RateOut:
    """Tasa vigente (Bs. por 1 USD) que usa el checkout."""
    return RateOut.model_validate(get_current_rate(db))


@router.put("/admin/rate", response_model=RateOut, dependencies=[Depends(require_admin)])
def update_rate(payload: RateIn, db: Session = Depends(get_db)) -> RateOut:
    """Fija la tasa a mano para hoy. Rige hasta que empiece una tasa con fecha valor posterior."""
    return RateOut.model_validate(set_rate(db, payload.rate, source="manual"))


@router.post(
    "/admin/rate/refresh", response_model=RateOut, dependencies=[Depends(require_admin)]
)
def refresh_rate(db: Session = Depends(get_db)) -> RateOut:
    """Consulta ya mismo la tasa oficial (BCV, con DolarApi de respaldo)."""
    try:
        return RateOut.model_validate(refresh_official_rate(db))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get(
    "/admin/rate/status", response_model=RateStatusOut, dependencies=[Depends(require_admin)]
)
def rate_status(db: Session = Depends(get_db)) -> RateStatusOut:
    """Tasa vigente, la próxima ya publicada y si la vigente está atrasada."""
    current = get_current_rate(db)
    upcoming = get_upcoming_rate(db)
    behind = business_days_behind(current.valid_from)
    check = rate_service.last_check
    return RateStatusOut(
        current=RateOut.model_validate(current),
        upcoming=RateOut.model_validate(upcoming) if upcoming else None,
        business_days_behind=behind,
        stale=behind >= STALE_BUSINESS_DAYS,
        last_check=RateCheckOut.model_validate(check, from_attributes=True) if check else None,
    )
