import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_urlsafe
from uuid import uuid4

import jwt
from fastapi import APIRouter, HTTPException, Request, Response

from database import clean_list, driver, hash_password, node_to_dict, sync_recruiter_assignments, utc_now, verify_password
from schemas import LoginRequest, UserCreate

router = APIRouter()

JWT_SECRET_PATH = Path(__file__).with_name(".jwt_secret")
JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "profile_manager_session"
CSRF_COOKIE_NAME = "profile_manager_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
SESSION_TTL_HOURS = 8
COOKIE_SECURE = os.getenv("PROFILE_MANAGER_COOKIE_SECURE", "false").strip().lower() == "true"
MAX_LOGIN_ATTEMPTS = 5
MAX_LOGIN_WINDOW_SECONDS = 300
MAX_REGISTER_ATTEMPTS = 10
MAX_REGISTER_WINDOW_SECONDS = 300
MAX_SKILLS = 25
MAX_CITY_PREFERENCES = 20
MAX_TEXT_LENGTH = 2000
RATE_LIMIT_STATE = {
    "login": {},
    "register": {},
}


def load_jwt_secret():
    env_secret = os.getenv("PROFILE_MANAGER_JWT_SECRET")
    if env_secret:
        return env_secret

    if JWT_SECRET_PATH.exists():
        return JWT_SECRET_PATH.read_text(encoding="utf-8").strip()

    secret = token_urlsafe(64)
    JWT_SECRET_PATH.write_text(secret, encoding="utf-8")
    return secret


JWT_SECRET = load_jwt_secret()


def create_session_token(user_id: str):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=SESSION_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_csrf_token():
    return token_urlsafe(32)


def set_session_cookies(response: Response, session_token: str, csrf_token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=SESSION_TTL_HOURS * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=SESSION_TTL_HOURS * 60 * 60,
        httponly=False,
        samesite="lax",
        secure=COOKIE_SECURE,
    )


def clear_session_cookies(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
    response.delete_cookie(
        key=CSRF_COOKIE_NAME,
        httponly=False,
        samesite="lax",
        secure=COOKIE_SECURE,
    )


def user_without_password(user):
    for field in ["password_hash", "activo", "disponibilidad", "aspiracion_salarial", "managed_vacancy_ids"]:
        user.pop(field, None)
    return user


def enforce_text_length(value, field_name: str):
    if value is not None and len(value) > MAX_TEXT_LENGTH:
        raise HTTPException(status_code=400, detail=f"El campo '{field_name}' excede el tamano permitido.")


def enforce_rate_limit(scope: str, key: str, max_attempts: int, window_seconds: int):
    now = datetime.now(timezone.utc).timestamp()
    bucket = RATE_LIMIT_STATE[scope].setdefault(key, [])
    bucket[:] = [attempt for attempt in bucket if now - attempt < window_seconds]
    if len(bucket) >= max_attempts:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta mas tarde.")
    bucket.append(now)


def clear_rate_limit(scope: str, key: str):
    RATE_LIMIT_STATE[scope].pop(key, None)


def find_user_by_id(session, user_id: str):
    record = session.run(
        """
        MATCH (u:User {id: $id})
        RETURN u
        LIMIT 1
        """,
        {"id": user_id},
    ).single()
    return node_to_dict(record["u"]) if record else None


def decode_session_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesion invalida.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Sesion invalida.")
    return user_id


def get_current_user_from_request(request: Request, required_account_type: str | None = None):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Sesion no encontrada.")

    user_id = decode_session_token(token)
    with driver.session() as session:
        user = find_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")
    if required_account_type and user.get("account_type") != required_account_type:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta operacion.")
    return user


def ensure_csrf(request: Request):
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(CSRF_HEADER_NAME)
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=403, detail="Token CSRF invalido.")


def normalize_city_preferences(raw_preferences):
    normalized = []
    total_points = 0
    values = raw_preferences or []
    if len(values) > MAX_CITY_PREFERENCES:
        raise HTTPException(status_code=400, detail="Se excedio el numero maximo de ciudades priorizadas.")
    for raw_value in values:
        if not raw_value:
            continue
        city_part, separator, points_part = str(raw_value).partition("|")
        city = city_part.strip()
        if not separator or not city:
            continue
        try:
            points = int(points_part.strip())
        except ValueError:
            continue
        if points < 0:
            continue
        normalized.append(f"{city}|{points}")
        total_points += points
    return normalized, total_points


def provided_fields_for_model(model) -> set[str]:
    return set(getattr(model, "model_fields_set", getattr(model, "__fields_set__", set())))


@router.post("/users")
def create_or_update_user(user: UserCreate, request: Request):
    provided_fields = provided_fields_for_model(user)

    if not user.email.strip():
        raise HTTPException(status_code=400, detail="El campo 'email' no puede estar vacio.")
    enforce_text_length(user.email, "email")
    enforce_text_length(user.username, "username")
    enforce_text_length(user.nombre, "nombre")
    enforce_text_length(user.empresa, "empresa")
    enforce_text_length(user.telefono, "telefono")
    enforce_text_length(user.ciudad, "ciudad")
    enforce_text_length(user.ocupacion, "ocupacion")
    enforce_text_length(user.rol_objetivo, "rol_objetivo")
    enforce_text_length(user.modalidad, "modalidad")
    enforce_text_length(user.experiencia, "experiencia")
    enforce_text_length(user.educacion, "educacion")

    requested_account_type = (user.account_type or "candidate").strip().lower()
    if requested_account_type not in {"candidate", "recruiter"}:
        raise HTTPException(status_code=400, detail="El tipo de cuenta no es valido.")

    now = utc_now()
    user_id = user.id.strip() if user.id and user.id.strip() else None
    password_hash = hash_password(user.password.strip()) if user.password and user.password.strip() else None

    with driver.session() as session:
        existing_user = find_user_by_id(session, user_id) if user_id else None

        if existing_user:
            current_user = get_current_user_from_request(request)
            ensure_csrf(request)
            if current_user["id"] != existing_user["id"]:
                raise HTTPException(status_code=403, detail="No puedes modificar otro usuario.")
            account_type = existing_user.get("account_type", "candidate")
            final_user_id = existing_user["id"]
        else:
            client_ip = request.client.host if request.client else "unknown"
            enforce_rate_limit("register", f"{client_ip}:{user.email.strip().lower()}", MAX_REGISTER_ATTEMPTS, MAX_REGISTER_WINDOW_SECONDS)
            if not user.password or not user.password.strip():
                raise HTTPException(status_code=400, detail="La contrasena es obligatoria para el registro.")
            account_type = requested_account_type
            prefix = "recruiter" if account_type == "recruiter" else "cliente"
            final_user_id = f"{prefix}-{uuid4().hex[:12]}"

        username = user.username.strip() if user.username else None
        if existing_user and "username" not in provided_fields:
            username = existing_user.get("username")

        display_name = (user.nombre or username or user.email).strip() if user.nombre or username or user.email else None
        if existing_user and "nombre" not in provided_fields:
            display_name = existing_user.get("nombre")

        if not display_name:
            raise HTTPException(status_code=400, detail="El campo 'usuario' no puede estar vacio.")
        if not username:
            raise HTTPException(status_code=400, detail="El nombre de usuario es obligatorio.")

        if existing_user:
            if user.skills is not None:
                raw_skills = user.skills
            elif user.intereses is not None:
                raw_skills = user.intereses
            else:
                raw_skills = existing_user.get("skills") or existing_user.get("intereses") or []
        else:
            raw_skills = user.skills or user.intereses

        skills = clean_list(raw_skills)
        if len(skills) > MAX_SKILLS:
            raise HTTPException(status_code=400, detail="Se excedio el numero maximo de skills.")

        recruiter_weights = {
            "role": (
                user.recruiter_weight_role
                if user.recruiter_weight_role is not None
                else existing_user.get("recruiter_weight_role") if existing_user else 40
            ),
            "skills": (
                user.recruiter_weight_skills
                if user.recruiter_weight_skills is not None
                else existing_user.get("recruiter_weight_skills") if existing_user else 40
            ),
            "modality": (
                user.recruiter_weight_modality
                if user.recruiter_weight_modality is not None
                else existing_user.get("recruiter_weight_modality") if existing_user else 20
            ),
        }
        raw_city_preferences = (
            user.recruiter_city_preferences
            if user.recruiter_city_preferences is not None
            else existing_user.get("recruiter_city_preferences") if existing_user else []
        )
        recruiter_city_preferences, recruiter_city_points = normalize_city_preferences(raw_city_preferences)

        if account_type == "recruiter" and recruiter_city_points + sum(recruiter_weights.values()) != 100:
            raise HTTPException(status_code=400, detail="La suma de ciudades, rol, skills y modalidad debe ser 100.")

        existing_username = session.run(
            """
            MATCH (u:User {username: $username})
            WHERE u.id <> $id
            RETURN u
            LIMIT 1
            """,
            {"username": username, "id": final_user_id},
        ).single()
        if existing_username:
            raise HTTPException(status_code=409, detail="El nombre de usuario ya esta en uso.")

        existing_email = session.run(
            """
            MATCH (u:User {email: $email})
            WHERE u.id <> $id
            RETURN u
            LIMIT 1
            """,
            {"email": user.email.strip(), "id": final_user_id},
        ).single()
        if existing_email:
            raise HTTPException(status_code=409, detail="El email ya esta en uso.")

        query = """
        MERGE (u:User {id: $id})
        SET u.nombre = $nombre,
            u.username = $username,
            u.email = $email,
            u.account_type = $account_type,
            u.empresa = $empresa,
            u.fecha_nacimiento = $fecha_nacimiento,
            u.edad = $edad,
            u.telefono = $telefono,
            u.ciudad = $ciudad,
            u.ocupacion = $ocupacion,
            u.intereses = $intereses,
            u.skills = $skills,
            u.rol_objetivo = $rol_objetivo,
            u.modalidad = $modalidad,
            u.aspiracion_salarial = null,
            u.disponibilidad = null,
            u.experiencia = $experiencia,
            u.educacion = $educacion,
            u.recruiter_target_city = null,
            u.recruiter_weight_city = null,
            u.recruiter_weight_salary = null,
            u.recruiter_city_preferences = $recruiter_city_preferences,
            u.recruiter_weight_role = $recruiter_weight_role,
            u.recruiter_weight_skills = $recruiter_weight_skills,
            u.recruiter_weight_modality = $recruiter_weight_modality,
            u.activo = null,
            u.updated_at = $updated_at,
            u.created_at = coalesce(u.created_at, $created_at),
            u.password_hash = CASE
                WHEN $password_hash IS NULL THEN u.password_hash
                ELSE $password_hash
            END
        RETURN u
        """

        params = {
            "id": final_user_id,
            "username": username,
            "nombre": display_name,
            "email": user.email.strip(),
            "account_type": account_type,
            "empresa": (
                user.empresa.strip() if user.empresa else None
                if "empresa" in provided_fields or not existing_user
                else existing_user.get("empresa")
            ),
            "fecha_nacimiento": (
                user.fecha_nacimiento.strip() if user.fecha_nacimiento else None
                if "fecha_nacimiento" in provided_fields or not existing_user
                else existing_user.get("fecha_nacimiento")
            ),
            "edad": user.edad if "edad" in provided_fields or not existing_user else existing_user.get("edad"),
            "telefono": (
                user.telefono.strip() if user.telefono else None
                if "telefono" in provided_fields or not existing_user
                else existing_user.get("telefono")
            ),
            "ciudad": (
                user.ciudad.strip() if user.ciudad else None
                if "ciudad" in provided_fields or not existing_user
                else existing_user.get("ciudad")
            ),
            "ocupacion": (
                user.ocupacion.strip() if user.ocupacion else None
                if "ocupacion" in provided_fields or not existing_user
                else existing_user.get("ocupacion")
            ),
            "intereses": user.intereses if user.intereses is not None or not existing_user else existing_user.get("intereses", []),
            "skills": skills,
            "rol_objetivo": (
                user.rol_objetivo.strip() if user.rol_objetivo else None
                if "rol_objetivo" in provided_fields or not existing_user
                else existing_user.get("rol_objetivo")
            ),
            "modalidad": (
                user.modalidad.strip() if user.modalidad else None
                if "modalidad" in provided_fields or not existing_user
                else existing_user.get("modalidad")
            ),
            "experiencia": (
                user.experiencia.strip() if user.experiencia else None
                if "experiencia" in provided_fields or not existing_user
                else existing_user.get("experiencia")
            ),
            "educacion": (
                user.educacion.strip() if user.educacion else None
                if "educacion" in provided_fields or not existing_user
                else existing_user.get("educacion")
            ),
            "recruiter_city_preferences": recruiter_city_preferences if account_type == "recruiter" else [],
            "recruiter_weight_role": recruiter_weights["role"] if account_type == "recruiter" else None,
            "recruiter_weight_skills": recruiter_weights["skills"] if account_type == "recruiter" else None,
            "recruiter_weight_modality": recruiter_weights["modality"] if account_type == "recruiter" else None,
            "password_hash": password_hash,
            "updated_at": now,
            "created_at": now,
        }

        result = session.run(query, params).single()
        if not result:
            raise HTTPException(status_code=500, detail="No se pudo crear/actualizar el usuario.")

        session.run(
            """
            MATCH (u:User {id: $id})
            OPTIONAL MATCH (u)-[old_skill:TIENE_SKILL]->(:Skill)
            DELETE old_skill
            WITH u
            OPTIONAL MATCH (u)-[old_role:BUSCA_ROL]->(:Role)
            DELETE old_role
            WITH u
            UNWIND $skills AS skill_name
            MERGE (s:Skill {nombre: skill_name})
            MERGE (u)-[:TIENE_SKILL]->(s)
            """,
            {"id": final_user_id, "skills": skills},
        )
        if account_type == "candidate" and params["rol_objetivo"]:
            session.run(
                """
                MATCH (u:User {id: $id})
                MERGE (r:Role {nombre: $rol_objetivo})
                MERGE (u)-[:BUSCA_ROL]->(r)
                """,
                {"id": final_user_id, "rol_objetivo": params["rol_objetivo"]},
            )
        if account_type == "recruiter":
            sync_recruiter_assignments(session, params["email"])

        return {"user": user_without_password(node_to_dict(result["u"]))}


@router.post("/login")
def login(credentials: LoginRequest, response: Response, request: Request):
    email = credentials.email.strip()
    password = credentials.password.strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email y password son obligatorios.")
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit("login", f"{client_ip}:{email.lower()}", MAX_LOGIN_ATTEMPTS, MAX_LOGIN_WINDOW_SECONDS)

    with driver.session() as session:
        record = session.run(
            """
            MATCH (u:User {email: $email})
            RETURN u
            LIMIT 1
            """,
            {"email": email},
        ).single()
        if not record:
            raise HTTPException(status_code=401, detail="Credenciales invalidas.")

        user = node_to_dict(record["u"])
        stored_hash = user.get("password_hash")
        if not stored_hash or not verify_password(password, stored_hash):
            raise HTTPException(status_code=401, detail="Credenciales invalidas.")

        session_token = create_session_token(user["id"])
        csrf_token = create_csrf_token()
        clear_rate_limit("login", f"{client_ip}:{email.lower()}")
        set_session_cookies(response, session_token, csrf_token)

        return {"message": "Login exitoso", "user": user_without_password(user), "csrf_token": csrf_token}


@router.get("/session")
def current_session(request: Request, response: Response):
    user = get_current_user_from_request(request)
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME) or create_csrf_token()
    if not request.cookies.get(CSRF_COOKIE_NAME):
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=csrf_token,
            max_age=SESSION_TTL_HOURS * 60 * 60,
            httponly=False,
            samesite="lax",
            secure=COOKIE_SECURE,
        )
    return {"user": user_without_password(user), "csrf_token": csrf_token}


@router.post("/logout")
def logout(request: Request, response: Response):
    get_current_user_from_request(request)
    ensure_csrf(request)
    clear_session_cookies(response)
    return {"message": "Sesion cerrada"}
