from typing import List, Optional

from pydantic import BaseModel


class UserCreate(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    nombre: Optional[str] = None
    email: str
    account_type: str = "candidate"
    empresa: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    edad: Optional[int] = None
    password: Optional[str] = None
    telefono: Optional[str] = None
    ciudad: Optional[str] = None
    ocupacion: Optional[str] = None
    intereses: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    rol_objetivo: Optional[str] = None
    modalidad: Optional[str] = None
    experiencia: Optional[str] = None
    educacion: Optional[str] = None
    recruiter_city_preferences: Optional[List[str]] = None
    recruiter_weight_role: Optional[int] = None
    recruiter_weight_modality: Optional[int] = None


class VacancyCreate(BaseModel):
    id: Optional[str] = None
    titulo: str
    empresa: Optional[str] = None
    rol: str
    ubicacion: Optional[str] = None
    modalidad: Optional[str] = None
    salario: Optional[int] = None
    descripcion: Optional[str] = None
    skills: Optional[List[str]] = None
    skill_weights: Optional[List[str]] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class ApplicationCreate(BaseModel):
    user_id: str
    vacancy_id: str
    notas: Optional[str] = None
