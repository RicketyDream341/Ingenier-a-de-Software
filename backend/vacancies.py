from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from auth import ensure_csrf, get_current_user_from_request
from database import RECRUITER_ASSIGNMENTS, driver, ensure_seed_data, node_to_dict, utc_now
from schemas import ApplicationCreate, VacancyCreate

router = APIRouter()
MAX_VACANCY_SKILLS = 20
MAX_TEXT_LENGTH = 2000


def parse_city_preferences(raw_preferences):
    parsed = []
    for raw_value in raw_preferences or []:
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
        parsed.append({"city": city, "points": points})
    return parsed


def parse_skill_weights(raw_values):
    parsed = []
    for raw_value in raw_values or []:
        if not raw_value:
            continue
        skill_part, separator, points_part = str(raw_value).partition("|")
        skill = skill_part.strip()
        if not separator or not skill:
            continue
        try:
            points = int(points_part.strip())
        except ValueError:
            continue
        if points < 0:
            continue
        parsed.append({"skill": skill, "points": points})
    return parsed


def serialize_skill_weights(skill_weights):
    return [f"{item['skill']}|{int(item['points'])}" for item in skill_weights]


def build_skill_weight_map(skill_weights):
    return {item["skill"]: int(item["points"]) for item in skill_weights}


def enforce_text_length(value, field_name: str):
    if value is not None and len(value) > MAX_TEXT_LENGTH:
        raise HTTPException(status_code=400, detail=f"El campo '{field_name}' excede el tamano permitido.")


def get_city_score(candidate_city, city_preferences):
    if not candidate_city:
        return 0
    normalized_candidate_city = candidate_city.strip().lower()
    for preference in city_preferences:
        if preference["city"].strip().lower() == normalized_candidate_city:
            return preference["points"]
    return 0


def sanitize_candidate(candidate):
    for field in ["password_hash", "activo", "disponibilidad", "aspiracion_salarial", "fecha_nacimiento", "telefono", "email"]:
        candidate.pop(field, None)
    return candidate


def normalize_vacancy_skill_weights(skills, raw_skill_weights):
    skill_names = []
    seen = set()
    for skill in skills or []:
        normalized = str(skill).strip()
        if normalized and normalized.lower() not in seen:
            skill_names.append(normalized)
            seen.add(normalized.lower())

    parsed = parse_skill_weights(raw_skill_weights)
    normalized_weights = []
    weight_map = {}
    for item in parsed:
        key = item["skill"].strip().lower()
        if key in seen and key not in weight_map:
            weight_map[key] = {"skill": item["skill"].strip(), "points": int(item["points"])}

    for skill in skill_names:
        weighted = weight_map.get(skill.lower())
        normalized_weights.append({"skill": skill, "points": weighted["points"] if weighted else 0})

    return skill_names, normalized_weights


def ensure_recruiter_manages_vacancy(recruiter, vacancy_id: str):
    assigned_vacancy_ids = RECRUITER_ASSIGNMENTS.get((recruiter.get("email") or "").strip().lower(), [])
    with driver.session() as session:
        record = session.run(
            """
            MATCH (:User {id: $recruiter_id})-[:MANAGES]->(v:Vacancy {id: $vacancy_id})
            WHERE coalesce(v.owner_recruiter_id, '') = $recruiter_id OR v.id IN $assigned_vacancy_ids
            RETURN 1 AS allowed
            LIMIT 1
            """,
            {"recruiter_id": recruiter["id"], "vacancy_id": vacancy_id, "assigned_vacancy_ids": assigned_vacancy_ids},
        ).single()
    if not record:
        raise HTTPException(status_code=403, detail="No puedes acceder a una vacante que no tienes asignada.")


@router.get("/vacancies")
def list_vacancies():
    query = """
    MATCH (v:Vacancy)-[:PARA_ROL]->(r:Role)
    OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
    RETURN DISTINCT v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills, coalesce(v.skill_weights, []) AS skill_weights
    ORDER BY v.created_at DESC
    """

    with driver.session() as session:
        ensure_seed_data(session)
        result = session.run(query)
        vacancies = []
        for record in result:
            vacancy = node_to_dict(record["v"])
            vacancy["rol"] = record["rol"]
            vacancy["skills"] = record["skills"]
            vacancy["skill_weights"] = record["skill_weights"]
            vacancies.append(vacancy)
        return {"vacancies": vacancies}


@router.get("/recruiters/{recruiter_id}/vacancies")
def list_recruiter_vacancies(recruiter_id: str, request: Request):
    current_user = get_current_user_from_request(request, required_account_type="recruiter")
    if current_user["id"] != recruiter_id.strip():
        raise HTTPException(status_code=403, detail="No puedes consultar vacantes de otro reclutador.")
    assigned_vacancy_ids = RECRUITER_ASSIGNMENTS.get((current_user.get("email") or "").strip().lower(), [])

    query = """
    MATCH (:User {id: $recruiter_id})-[:MANAGES]->(v:Vacancy)-[:PARA_ROL]->(r:Role)
    WHERE coalesce(v.owner_recruiter_id, '') = $recruiter_id OR v.id IN $assigned_vacancy_ids
    OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
    RETURN DISTINCT v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills, coalesce(v.skill_weights, []) AS skill_weights
    ORDER BY v.created_at DESC
    """

    with driver.session() as session:
        result = session.run(query, {"recruiter_id": recruiter_id.strip(), "assigned_vacancy_ids": assigned_vacancy_ids})
        vacancies = []
        for record in result:
            vacancy = node_to_dict(record["v"])
            vacancy["rol"] = record["rol"]
            vacancy["skills"] = record["skills"]
            vacancy["skill_weights"] = record["skill_weights"]
            vacancies.append(vacancy)
        return {"vacancies": vacancies}


@router.post("/recruiters/{recruiter_id}/vacancies")
def create_or_update_recruiter_vacancy(recruiter_id: str, vacancy: VacancyCreate, request: Request):
    current_user = get_current_user_from_request(request, required_account_type="recruiter")
    ensure_csrf(request)
    if current_user["id"] != recruiter_id.strip():
        raise HTTPException(status_code=403, detail="No puedes gestionar vacantes de otro reclutador.")

    enforce_text_length(vacancy.titulo, "titulo")
    enforce_text_length(vacancy.empresa, "empresa")
    enforce_text_length(vacancy.rol, "rol")
    enforce_text_length(vacancy.ubicacion, "ubicacion")
    enforce_text_length(vacancy.modalidad, "modalidad")
    enforce_text_length(vacancy.descripcion, "descripcion")

    skill_names, normalized_skill_weights = normalize_vacancy_skill_weights(vacancy.skills or [], vacancy.skill_weights or [])
    if not vacancy.titulo.strip():
        raise HTTPException(status_code=400, detail="El titulo de la vacante es obligatorio.")
    if not vacancy.rol.strip():
        raise HTTPException(status_code=400, detail="El rol de la vacante es obligatorio.")
    if not skill_names:
        raise HTTPException(status_code=400, detail="Debes definir al menos una skill para la vacante.")
    if len(skill_names) > MAX_VACANCY_SKILLS:
        raise HTTPException(status_code=400, detail="Se excedio el numero maximo de skills para la vacante.")

    current_city_points = sum(item["points"] for item in parse_city_preferences(current_user.get("recruiter_city_preferences")))
    current_role_weight = int(current_user.get("recruiter_weight_role") or 0)
    current_modality_weight = int(current_user.get("recruiter_weight_modality") or 0)
    current_skill_weight_total = sum(item["points"] for item in normalized_skill_weights)
    if current_city_points + current_role_weight + current_modality_weight + current_skill_weight_total != 100:
        raise HTTPException(
            status_code=400,
            detail="La configuracion activa debe sumar exactamente 100 puntos entre ciudad, rol, modalidad y skills de la vacante.",
        )

    vacancy_id = vacancy.id.strip() if vacancy.id and vacancy.id.strip() else f"vacancy-{uuid4().hex[:12]}"

    with driver.session() as session:
        ensure_seed_data(session)
        if vacancy.id:
            existing_permission = session.run(
                """
                MATCH (:User {id: $recruiter_id})-[:MANAGES]->(:Vacancy {id: $vacancy_id})
                RETURN 1 AS allowed
                LIMIT 1
                """,
                {"recruiter_id": recruiter_id.strip(), "vacancy_id": vacancy_id},
            ).single()
            if not existing_permission:
                raise HTTPException(status_code=403, detail="No puedes editar una vacante que no administras.")

        session.run(
            """
            MERGE (v:Vacancy {id: $id})
            SET v.titulo = $titulo,
                v.empresa = $empresa,
                v.ubicacion = $ubicacion,
                v.modalidad = $modalidad,
                v.salario = $salario,
                v.descripcion = $descripcion,
                v.skill_weights = $skill_weights,
                v.owner_recruiter_id = $owner_recruiter_id,
                v.updated_at = $updated_at,
                v.created_at = coalesce(v.created_at, $created_at)
            WITH v
            OPTIONAL MATCH (v)-[old_role:PARA_ROL]->(:Role)
            DELETE old_role
            WITH v
            OPTIONAL MATCH (v)-[old_skill:REQUIERE]->(:Skill)
            DELETE old_skill
            WITH v
            MERGE (r:Role {nombre: $rol})
            MERGE (v)-[:PARA_ROL]->(r)
            WITH v
            UNWIND $skills AS skill_name
            MERGE (s:Skill {nombre: skill_name})
            MERGE (v)-[:REQUIERE]->(s)
            """,
            {
                "id": vacancy_id,
                "titulo": vacancy.titulo.strip(),
                "empresa": vacancy.empresa.strip() if vacancy.empresa else (current_user.get("empresa") or None),
                "ubicacion": vacancy.ubicacion.strip() if vacancy.ubicacion else None,
                "modalidad": vacancy.modalidad.strip() if vacancy.modalidad else "Remoto",
                "salario": vacancy.salario,
                "descripcion": vacancy.descripcion.strip() if vacancy.descripcion else None,
                "rol": vacancy.rol.strip(),
                "skills": skill_names,
                "skill_weights": serialize_skill_weights(normalized_skill_weights),
                "owner_recruiter_id": recruiter_id.strip(),
                "updated_at": utc_now(),
                "created_at": utc_now(),
            },
        )
        session.run(
            """
            MATCH (u:User {id: $recruiter_id})
            MATCH (v:Vacancy {id: $vacancy_id})
            MERGE (u)-[:MANAGES]->(v)
            """,
            {"recruiter_id": recruiter_id.strip(), "vacancy_id": vacancy_id},
        )
        record = session.run(
            """
            MATCH (v:Vacancy {id: $id})-[:PARA_ROL]->(r:Role)
            OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
            RETURN v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills, coalesce(v.skill_weights, []) AS skill_weights
            LIMIT 1
            """,
            {"id": vacancy_id},
        ).single()

    vacancy_data = node_to_dict(record["v"])
    vacancy_data["rol"] = record["rol"]
    vacancy_data["skills"] = record["skills"]
    vacancy_data["skill_weights"] = record["skill_weights"]
    return {"vacancy": vacancy_data}


@router.get("/recommendations/{user_id}")
def recommend_vacancies(user_id: str, request: Request):
    current_user = get_current_user_from_request(request)
    if current_user["id"] != user_id.strip():
        raise HTTPException(status_code=403, detail="No puedes consultar recomendaciones de otro usuario.")
    query = """
    MATCH (u:User {id: $user_id})
    MATCH (v:Vacancy)-[:PARA_ROL]->(r:Role)
    OPTIONAL MATCH (u)-[:TIENE_SKILL]->(candidate_skill:Skill)
    WITH u, v, r, collect(DISTINCT candidate_skill.nombre) AS candidate_skills
    OPTIONAL MATCH (v)-[:REQUIERE]->(required_skill:Skill)
    WITH u, v, r, candidate_skills, collect(DISTINCT required_skill.nombre) AS required_skills
    WITH u, v, r, candidate_skills, required_skills,
         [skill IN required_skills WHERE skill IN candidate_skills] AS matched_skills
    WITH u, v, r, candidate_skills, required_skills, matched_skills,
         CASE WHEN u.rol_objetivo IS NOT NULL AND toLower(u.rol_objetivo) = toLower(r.nombre) THEN 25 ELSE 0 END AS role_score,
         CASE WHEN u.modalidad IS NOT NULL AND toLower(u.modalidad) = toLower(v.modalidad) THEN 10 ELSE 0 END AS modality_score,
         CASE WHEN size(required_skills) = 0 THEN 0 ELSE toInteger((toFloat(size(matched_skills)) / size(required_skills)) * 65) END AS skills_score
    RETURN v, r.nombre AS rol, u.rol_objetivo AS candidate_role, u.modalidad AS candidate_modality,
           candidate_skills, required_skills, matched_skills, role_score, modality_score, skills_score,
           role_score + modality_score + skills_score AS score
    ORDER BY score DESC, v.titulo ASC
    LIMIT 10
    """

    with driver.session() as session:
        ensure_seed_data(session)
        records = list(session.run(query, {"user_id": user_id.strip()}))
        if not records:
            raise HTTPException(status_code=404, detail="No existe un candidato con ese ID.")

        recommendations = []
        for record in records:
            vacancy = node_to_dict(record["v"])
            vacancy["rol"] = record["rol"]
            vacancy["skills"] = record["required_skills"]
            matched_skills = record["matched_skills"]
            required_skills = record["required_skills"]
            candidate_skills = record["candidate_skills"]
            missing_skills = [skill for skill in required_skills if skill not in matched_skills]
            role_match = record["role_score"] > 0
            modality_match = record["modality_score"] > 0

            recommendations.append({
                "vacancy": vacancy,
                "score": record["score"],
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "score_breakdown": {
                    "skills": record["skills_score"],
                    "role": record["role_score"],
                    "modality": record["modality_score"],
                    "total": record["score"],
                    "max": 100,
                },
                "explanation": build_recommendation_explanation(
                    vacancy=vacancy,
                    candidate_skills=candidate_skills,
                    matched_skills=matched_skills,
                    missing_skills=missing_skills,
                    candidate_role=record["candidate_role"],
                    role_match=role_match,
                    candidate_modality=record["candidate_modality"],
                    modality_match=modality_match,
                    skills_score=record["skills_score"],
                    role_score=record["role_score"],
                    modality_score=record["modality_score"],
                    total_score=record["score"],
                ),
            })
        return {"recommendations": recommendations}


def build_recommendation_explanation(
    vacancy,
    candidate_skills,
    matched_skills,
    missing_skills,
    candidate_role,
    role_match,
    candidate_modality,
    modality_match,
    skills_score,
    role_score,
    modality_score,
    total_score,
):
    matched_text = ", ".join(matched_skills) if matched_skills else "sin coincidencias directas"
    missing_text = ", ".join(missing_skills) if missing_skills else "ninguna"
    candidate_skills_text = ", ".join(candidate_skills) if candidate_skills else "sin skills registradas"
    role_text = (
        f"El rol objetivo del candidato ({candidate_role}) coincide con el rol de la vacante ({vacancy['rol']})."
        if role_match
        else f"El rol objetivo del candidato ({candidate_role or 'no definido'}) no coincide exactamente con el rol de la vacante ({vacancy['rol']})."
    )
    modality_text = (
        f"La modalidad preferida ({candidate_modality}) coincide con la modalidad de la vacante."
        if modality_match
        else f"La modalidad preferida ({candidate_modality or 'no definida'}) no coincide con la modalidad de la vacante ({vacancy.get('modalidad') or 'no definida'})."
    )

    return (
        f"Score total {total_score}/100. "
        f"Skills: {skills_score}/65 puntos porque el candidato tiene {len(matched_skills)} de "
        f"{len(vacancy['skills'])} skills requeridas ({matched_text}). "
        f"Skills del candidato consideradas: {candidate_skills_text}. "
        f"Skills faltantes para esta vacante: {missing_text}. "
        f"Rol: {role_score}/25 puntos. {role_text} "
        f"Modalidad: {modality_score}/10 puntos. {modality_text}"
    )


@router.get("/recruiters/{recruiter_id}/recommendations")
def recommend_candidates_for_vacancy(recruiter_id: str, vacancy_id: str, request: Request):
    current_user = get_current_user_from_request(request, required_account_type="recruiter")
    if current_user["id"] != recruiter_id.strip():
        raise HTTPException(status_code=403, detail="No puedes consultar recomendaciones de otro reclutador.")
    ensure_recruiter_manages_vacancy(current_user, vacancy_id.strip())
    query = """
    MATCH (recruiter:User {id: $recruiter_id})
    WHERE recruiter.account_type = 'recruiter'
    MATCH (v:Vacancy {id: $vacancy_id})-[:PARA_ROL]->(r:Role)
    OPTIONAL MATCH (v)-[:REQUIERE]->(required_skill:Skill)
    WITH recruiter, v, r, collect(DISTINCT required_skill.nombre) AS required_skills
    MATCH (candidate:User)-[:REALIZO_POSTULACION]->(:Application)-[:A_VACANTE]->(v)
    WHERE coalesce(candidate.account_type, 'candidate') = 'candidate'
    OPTIONAL MATCH (candidate)-[:TIENE_SKILL]->(candidate_skill:Skill)
    WITH recruiter, v, r, required_skills, candidate, collect(DISTINCT candidate_skill.nombre) AS candidate_skills
    WITH recruiter, v, r, required_skills, candidate, candidate_skills,
         [skill IN required_skills WHERE skill IN candidate_skills] AS matched_skills
    WITH recruiter, v, r, required_skills, candidate, candidate_skills, matched_skills,
         CASE WHEN candidate.rol_objetivo IS NOT NULL AND toLower(candidate.rol_objetivo) = toLower(r.nombre) THEN recruiter.recruiter_weight_role ELSE 0 END AS role_score,
         CASE WHEN candidate.modalidad IS NOT NULL AND toLower(candidate.modalidad) = toLower(v.modalidad) THEN recruiter.recruiter_weight_modality ELSE 0 END AS modality_score
    RETURN candidate, r.nombre AS role_name, required_skills, candidate_skills, matched_skills,
           role_score, modality_score,
           recruiter.recruiter_city_preferences AS city_preferences,
           recruiter.recruiter_weight_role AS weight_role,
           recruiter.recruiter_weight_modality AS weight_modality,
           coalesce(v.skill_weights, []) AS skill_weights,
           v
    ORDER BY candidate.nombre ASC
    LIMIT 20
    """

    with driver.session() as session:
        ensure_seed_data(session)
        records = list(
            session.run(
                query,
                {
                    "recruiter_id": recruiter_id.strip(),
                    "vacancy_id": vacancy_id.strip(),
                },
            )
        )
        if not records:
            recruiter_exists = session.run(
                "MATCH (u:User {id: $id}) RETURN u LIMIT 1",
                {"id": recruiter_id.strip()},
            ).single()
            if not recruiter_exists:
                raise HTTPException(status_code=404, detail="No existe un reclutador con ese ID.")

            vacancy_exists = session.run(
                "MATCH (v:Vacancy {id: $id}) RETURN v LIMIT 1",
                {"id": vacancy_id.strip()},
            ).single()
            if not vacancy_exists:
                raise HTTPException(status_code=404, detail="No existe una vacante con ese ID.")

        vacancy = None
        recommendations = []
        for record in records:
            vacancy = node_to_dict(record["v"])
            vacancy["rol"] = record["role_name"]
            vacancy["skills"] = record["required_skills"]
            candidate = sanitize_candidate(node_to_dict(record["candidate"]))
            matched_skills = record["matched_skills"]
            required_skills = record["required_skills"]
            candidate_skills = record["candidate_skills"]
            city_preferences = parse_city_preferences(record["city_preferences"])
            skill_weights = parse_skill_weights(record["skill_weights"])
            skill_weight_map = build_skill_weight_map(skill_weights)
            city_score = get_city_score(candidate.get("ciudad"), city_preferences)
            missing_skills = [skill for skill in required_skills if skill not in matched_skills]
            skills_score = sum(skill_weight_map.get(skill, 0) for skill in matched_skills)
            score_breakdown = {
                "city": int(city_score),
                "role": int(record["role_score"]),
                "skills": int(skills_score),
                "modality": int(record["modality_score"]),
                "total": int(city_score) + int(record["role_score"]) + int(skills_score) + int(record["modality_score"]),
                "max": 100,
            }
            weights = {
                "city": sum(preference["points"] for preference in city_preferences),
                "role": int(record["weight_role"]),
                "skills": sum(item["points"] for item in skill_weights),
                "modality": int(record["weight_modality"]),
            }

            recommendations.append(
                {
                    "candidate": candidate,
                    "score": score_breakdown["total"],
                    "matched_skills": matched_skills,
                    "missing_skills": missing_skills,
                    "score_breakdown": score_breakdown,
                    "weights": weights,
                    "city_preferences": city_preferences,
                    "skill_weights": skill_weights,
                    "explanation": build_recruiter_explanation(
                        candidate=candidate,
                        vacancy=vacancy,
                        required_skills=required_skills,
                        matched_skills=matched_skills,
                        missing_skills=missing_skills,
                        candidate_skills=candidate_skills,
                        city_preferences=city_preferences,
                        skill_weights=skill_weights,
                        weights=weights,
                        score_breakdown=score_breakdown,
                        role_name=record["role_name"],
                    ),
                }
            )

        recommendations.sort(key=lambda item: (-item["score"], item["candidate"].get("nombre", "")))

        if vacancy is None:
            vacancy_record = session.run(
                """
                MATCH (v:Vacancy {id: $id})-[:PARA_ROL]->(r:Role)
                OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
                RETURN v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills, coalesce(v.skill_weights, []) AS skill_weights
                LIMIT 1
                """,
                {"id": vacancy_id.strip()},
            ).single()
            if not vacancy_record:
                raise HTTPException(status_code=404, detail="No existe una vacante con ese ID.")
            vacancy = node_to_dict(vacancy_record["v"])
            vacancy["rol"] = vacancy_record["rol"]
            vacancy["skills"] = vacancy_record["skills"]
            vacancy["skill_weights"] = vacancy_record["skill_weights"]

        return {"vacancy": vacancy, "recommendations": recommendations}


@router.get("/recruiters/{recruiter_id}/applications")
def list_recruiter_applications(recruiter_id: str, vacancy_id: str, request: Request):
    current_user = get_current_user_from_request(request, required_account_type="recruiter")
    if current_user["id"] != recruiter_id.strip():
        raise HTTPException(status_code=403, detail="No puedes consultar postulaciones de otro reclutador.")
    ensure_recruiter_manages_vacancy(current_user, vacancy_id.strip())

    query = """
    MATCH (u:User)-[:REALIZO_POSTULACION]->(a:Application)-[:A_VACANTE]->(v:Vacancy {id: $vacancy_id})
    WHERE coalesce(u.account_type, 'candidate') = 'candidate'
    RETURN u, a, v
    ORDER BY a.updated_at DESC
    """

    with driver.session() as session:
        vacancy_record = session.run(
            """
            MATCH (v:Vacancy {id: $id})-[:PARA_ROL]->(r:Role)
            OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
            RETURN v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills
            LIMIT 1
            """,
            {"id": vacancy_id.strip()},
        ).single()
        if not vacancy_record:
            raise HTTPException(status_code=404, detail="No existe una vacante con ese ID.")

        result = session.run(query, {"vacancy_id": vacancy_id.strip()})
        applications = []
        for record in result:
            candidate = sanitize_candidate(node_to_dict(record["u"]))
            applications.append(
                {
                    "candidate": candidate,
                    "application": node_to_dict(record["a"]),
                    "vacancy": node_to_dict(record["v"]),
                }
            )

        vacancy = node_to_dict(vacancy_record["v"])
        vacancy["rol"] = vacancy_record["rol"]
        vacancy["skills"] = vacancy_record["skills"]
        return {"vacancy": vacancy, "applications": applications}


def build_recruiter_explanation(candidate, vacancy, required_skills, matched_skills, missing_skills, candidate_skills, city_preferences, skill_weights, weights, score_breakdown, role_name):
    matched_text = ", ".join(matched_skills) if matched_skills else "sin coincidencias directas"
    missing_text = ", ".join(missing_skills) if missing_skills else "ninguna"
    candidate_skills_text = ", ".join(candidate_skills) if candidate_skills else "sin skills registradas"
    city_preferences_text = ", ".join(
        f"{preference['city']} ({preference['points']} pts)" for preference in city_preferences
    ) if city_preferences else "sin ciudades configuradas"
    skill_weights_text = ", ".join(
        f"{item['skill']} ({item['points']} pts)" for item in skill_weights
    ) if skill_weights else "sin pesos definidos por skill"
    city_text = (
        f"La ciudad del candidato ({candidate.get('ciudad') or 'no definida'}) coincide con una ciudad priorizada por el reclutador."
        if score_breakdown["city"] > 0
        else f"La ciudad del candidato ({candidate.get('ciudad') or 'no definida'}) no aparece dentro de las ciudades priorizadas por el reclutador."
    )
    role_text = (
        f"El rol objetivo ({candidate.get('rol_objetivo') or 'no definido'}) coincide con el rol requerido ({role_name})."
        if score_breakdown["role"] > 0
        else f"El rol objetivo ({candidate.get('rol_objetivo') or 'no definido'}) no coincide exactamente con el rol requerido ({role_name})."
    )
    modality_text = (
        f"La modalidad ({candidate.get('modalidad') or 'no definida'}) coincide con la modalidad de la vacante."
        if score_breakdown["modality"] > 0
        else f"La modalidad ({candidate.get('modalidad') or 'no definida'}) no coincide con la modalidad de la vacante ({vacancy.get('modalidad') or 'no definida'})."
    )
    return (
        f"Score total {score_breakdown['total']}/100. "
        f"Ciudad: {score_breakdown['city']}/{weights['city']} puntos. {city_text} "
        f"Ciudades configuradas: {city_preferences_text}. "
        f"Rol: {score_breakdown['role']}/{weights['role']} puntos. {role_text} "
        f"Skills: {score_breakdown['skills']}/{weights['skills']} puntos porque el candidato coincide en "
        f"{len(matched_skills)} de {len(required_skills)} skills requeridas ({matched_text}). "
        f"Pesos por skill: {skill_weights_text}. Skills del candidato: {candidate_skills_text}. Skills faltantes: {missing_text}. "
        f"Modalidad: {score_breakdown['modality']}/{weights['modality']} puntos. {modality_text}"
    )


@router.post("/applications")
def apply_to_vacancy(application: ApplicationCreate, request: Request):
    current_user = get_current_user_from_request(request)
    ensure_csrf(request)
    if not application.user_id.strip() or not application.vacancy_id.strip():
        raise HTTPException(status_code=400, detail="Candidato y vacante son obligatorios.")
    if current_user["id"] != application.user_id.strip():
        raise HTTPException(status_code=403, detail="No puedes crear postulaciones para otro usuario.")

    application_id = f"postulacion-{application.user_id.strip()}-{application.vacancy_id.strip()}"
    query = """
    MATCH (u:User {id: $user_id})
    MATCH (v:Vacancy {id: $vacancy_id})
    MERGE (a:Application {id: $id})
    SET a.estado = coalesce(a.estado, 'Postulado'),
        a.notas = $notas,
        a.updated_at = $now,
        a.created_at = coalesce(a.created_at, $now)
    MERGE (u)-[:REALIZO_POSTULACION]->(a)
    MERGE (a)-[:A_VACANTE]->(v)
    RETURN a, v
    """

    params = {
        "id": application_id,
        "user_id": application.user_id.strip(),
        "vacancy_id": application.vacancy_id.strip(),
        "notas": application.notas.strip() if application.notas else None,
        "now": utc_now(),
    }

    with driver.session() as session:
        result = session.run(query, params).single()
        if not result:
            raise HTTPException(status_code=404, detail="Candidato o vacante no encontrados.")

        return {
            "application": node_to_dict(result["a"]),
            "vacancy": node_to_dict(result["v"]),
        }


@router.get("/applications/{user_id}")
def list_applications(user_id: str, request: Request):
    current_user = get_current_user_from_request(request)
    if current_user["id"] != user_id.strip():
        raise HTTPException(status_code=403, detail="No puedes consultar postulaciones de otro usuario.")
    query = """
    MATCH (u:User {id: $user_id})-[:REALIZO_POSTULACION]->(a:Application)-[:A_VACANTE]->(v:Vacancy)
    RETURN a, v
    ORDER BY a.updated_at DESC
    """

    with driver.session() as session:
        result = session.run(query, {"user_id": user_id.strip()})
        applications = []
        for record in result:
            applications.append({
                "application": node_to_dict(record["a"]),
                "vacancy": node_to_dict(record["v"]),
            })
        return {"applications": applications}
