from fastapi import APIRouter, HTTPException

from database import driver, ensure_seed_data, node_to_dict, utc_now
from schemas import ApplicationCreate

router = APIRouter()


@router.get("/vacancies")
def list_vacancies():
    query = """
    MATCH (v:Vacancy)-[:PARA_ROL]->(r:Role)
    OPTIONAL MATCH (v)-[:REQUIERE]->(s:Skill)
    RETURN DISTINCT v, r.nombre AS rol, collect(DISTINCT s.nombre) AS skills
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
            vacancies.append(vacancy)
        return {"vacancies": vacancies}


@router.get("/recommendations/{user_id}")
def recommend_vacancies(user_id: str):
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
    matched_text = ", ".join(matched_skills) if matched_skills else "ninguna skill requerida"
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


@router.post("/applications")
def apply_to_vacancy(application: ApplicationCreate):
    if not application.user_id.strip() or not application.vacancy_id.strip():
        raise HTTPException(status_code=400, detail="Candidato y vacante son obligatorios.")

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
def list_applications(user_id: str):
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
