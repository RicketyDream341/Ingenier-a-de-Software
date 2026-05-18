from fastapi import APIRouter, HTTPException, Request

from auth import get_current_user_from_request
from database import driver, node_to_dict

router = APIRouter()


def sanitize_user(user):
    for field in ["password_hash", "activo", "disponibilidad", "aspiracion_salarial", "fecha_nacimiento", "telefono", "email"]:
        user.pop(field, None)
    return user


@router.get("/users")
def list_users(request: Request):
    get_current_user_from_request(request)
    raise HTTPException(
        status_code=403,
        detail="El listado global de usuarios no esta disponible. Usa /session para consultar tu cuenta.",
    )


@router.get("/candidates")
def list_candidates(request: Request):
    get_current_user_from_request(request, required_account_type="recruiter")
    raise HTTPException(
        status_code=403,
        detail="La lista global de candidatos no esta disponible. Consulta solo postulaciones por vacante asignada.",
    )
