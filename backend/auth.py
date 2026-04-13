from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from uuid import uuid4

import jwt
from fastapi import APIRouter, HTTPException, Request, Response

from database import clean_list, driver, hash_password, node_to_dict, utc_now, verify_password
from schemas import LoginRequest, UserCreate

router = APIRouter()

JWT_SECRET = token_urlsafe(64)
JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "profile_manager_session"
SESSION_TTL_HOURS = 8


def create_session_token(user_id: str):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=SESSION_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_HOURS * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=False,
    )


def user_without_password(user):
    user.pop("password_hash", None)
    return user


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


@router.post("/users")
def create_or_update_user(user: UserCreate):
    if not user.email.strip():
        raise HTTPException(status_code=400, detail="El campo 'email' no puede estar vacio.")

    username = user.username.strip() if user.username else None
    display_name = (user.nombre or username or user.email).strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="El campo 'usuario' no puede estar vacio.")
    if not username:
        raise HTTPException(status_code=400, detail="El nombre de usuario es obligatorio.")

    now = utc_now()
    user_id = user.id.strip() if user.id and user.id.strip() else f"cliente-{uuid4().hex[:12]}"
    password_hash = hash_password(user.password.strip()) if user.password and user.password.strip() else None
    skills = clean_list(user.skills or user.intereses)

    query = """
    MERGE (u:User {id: $id})
    SET u.nombre = $nombre,
        u.username = $username,
        u.email = $email,
        u.fecha_nacimiento = $fecha_nacimiento,
        u.edad = $edad,
        u.telefono = $telefono,
        u.ciudad = $ciudad,
        u.ocupacion = $ocupacion,
        u.intereses = $intereses,
        u.skills = $skills,
        u.rol_objetivo = $rol_objetivo,
        u.modalidad = $modalidad,
        u.aspiracion_salarial = $aspiracion_salarial,
        u.disponibilidad = $disponibilidad,
        u.experiencia = $experiencia,
        u.educacion = $educacion,
        u.activo = $activo,
        u.updated_at = $updated_at,
        u.created_at = coalesce(u.created_at, $created_at)
    FOREACH (_ IN CASE WHEN $password_hash IS NULL THEN [] ELSE [1] END |
        SET u.password_hash = $password_hash
    )
    RETURN u
    """

    params = {
        "id": user_id,
        "username": user.username.strip() if user.username else None,
        "nombre": display_name,
        "email": user.email.strip(),
        "fecha_nacimiento": user.fecha_nacimiento.strip() if user.fecha_nacimiento else None,
        "edad": user.edad,
        "telefono": user.telefono.strip() if user.telefono else None,
        "ciudad": user.ciudad.strip() if user.ciudad else None,
        "ocupacion": user.ocupacion.strip() if user.ocupacion else None,
        "intereses": user.intereses,
        "skills": skills,
        "rol_objetivo": user.rol_objetivo.strip() if user.rol_objetivo else None,
        "modalidad": user.modalidad.strip() if user.modalidad else None,
        "aspiracion_salarial": user.aspiracion_salarial,
        "disponibilidad": user.disponibilidad.strip() if user.disponibilidad else None,
        "experiencia": user.experiencia.strip() if user.experiencia else None,
        "educacion": user.educacion.strip() if user.educacion else None,
        "activo": user.activo,
        "password_hash": password_hash,
        "updated_at": now,
        "created_at": now,
    }

    with driver.session() as session:
        existing_username = session.run(
            """
            MATCH (u:User {username: $username})
            WHERE u.id <> $id
            RETURN u
            LIMIT 1
            """,
            {"username": username, "id": user_id},
        ).single()
        if existing_username:
            raise HTTPException(status_code=409, detail="El nombre de usuario ya esta en uso.")

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
            {"id": user_id, "skills": skills},
        )
        if params["rol_objetivo"]:
            session.run(
                """
                MATCH (u:User {id: $id})
                MERGE (r:Role {nombre: $rol_objetivo})
                MERGE (u)-[:BUSCA_ROL]->(r)
                """,
                {"id": user_id, "rol_objetivo": params["rol_objetivo"]},
            )

        return {"user": user_without_password(node_to_dict(result["u"]))}


@router.post("/login")
def login(credentials: LoginRequest, response: Response):
    email = credentials.email.strip()
    password = credentials.password.strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email y password son obligatorios.")

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

        if user.get("activo") is False:
            raise HTTPException(status_code=403, detail="El usuario esta inactivo.")

        token = create_session_token(user["id"])
        set_session_cookie(response, token)

        return {"message": "Login exitoso", "user": user_without_password(user)}


@router.get("/session")
def current_session(request: Request):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Sesion no encontrada.")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesion invalida.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Sesion invalida.")

    with driver.session() as session:
        user = find_user_by_id(session, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado.")
        if user.get("activo") is False:
            raise HTTPException(status_code=403, detail="El usuario esta inactivo.")

        return {"user": user_without_password(user)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"message": "Sesion cerrada"}
