from typing import List, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    nombre: Optional[str] = None
    email: str
    fecha_nacimiento: Optional[str] = None
    edad: Optional[int] = None
    password: Optional[str] = None
    telefono: Optional[str] = None
    ciudad: Optional[str] = None
    ocupacion: Optional[str] = None
    intereses: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    rol_objetivo: Optional[str] = None
    modalidad: Optional[str] = None
    aspiracion_salarial: Optional[int] = None
    disponibilidad: Optional[str] = None
    experiencia: Optional[str] = None
    educacion: Optional[str] = None
    activo: bool = True


class LoginRequest(BaseModel):
    email: str
    password: str


class ApplicationCreate(BaseModel):
    user_id: str
    vacancy_id: str
    notas: Optional[str] = None
