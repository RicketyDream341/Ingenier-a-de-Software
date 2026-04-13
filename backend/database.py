from datetime import datetime, timezone

import bcrypt
from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "bolt://127.0.0.1:7687",
    auth=("neo4j", "neo4j123"),
)

DEFAULT_VACANCIES = [
    {
        "id": "vac-dev-react",
        "titulo": "Frontend Developer React",
        "empresa": "Magneto Demo",
        "rol": "Frontend Developer",
        "ubicacion": "Medellin",
        "modalidad": "Remoto",
        "salario": 5500000,
        "skills": ["React", "JavaScript", "HTML", "CSS"],
        "descripcion": "Construccion de interfaces web para productos de empleabilidad.",
    },
    {
        "id": "vac-back-python",
        "titulo": "Backend Developer Python",
        "empresa": "Magneto Demo",
        "rol": "Backend Developer",
        "ubicacion": "Bogota",
        "modalidad": "Hibrido",
        "salario": 6500000,
        "skills": ["Python", "FastAPI", "Neo4j", "APIs"],
        "descripcion": "Desarrollo de APIs y servicios de datos para matching de talento.",
    },
    {
        "id": "vac-data-neo4j",
        "titulo": "Data Engineer Neo4j",
        "empresa": "Graph Talent",
        "rol": "Data Engineer",
        "ubicacion": "Colombia",
        "modalidad": "Remoto",
        "salario": 7500000,
        "skills": ["Neo4j", "Python", "Cypher", "ETL"],
        "descripcion": "Modelado de grafos, pipelines de datos y recomendaciones explicables.",
    },
    {
        "id": "vac-qa-auto",
        "titulo": "QA Automation Engineer",
        "empresa": "TalentOps",
        "rol": "QA Engineer",
        "ubicacion": "Cali",
        "modalidad": "Presencial",
        "salario": 4800000,
        "skills": ["Testing", "Selenium", "Python", "CI"],
        "descripcion": "Automatizacion de pruebas para flujos de postulacion y seleccion.",
    },
]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str):
    password_bytes = password.encode("utf-8")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str):
    password_bytes = password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)


def node_to_dict(node):
    return dict(node) if node else None


def clean_list(values):
    return sorted({value.strip() for value in values if value and value.strip()})


def ensure_seed_data(session):
    session.run("CREATE CONSTRAINT vacancy_id_unique IF NOT EXISTS FOR (v:Vacancy) REQUIRE v.id IS UNIQUE")
    session.run("CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
    session.run("CREATE CONSTRAINT username_unique IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE")
    session.run("CREATE CONSTRAINT skill_name_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.nombre IS UNIQUE")
    session.run("CREATE CONSTRAINT role_name_unique IF NOT EXISTS FOR (r:Role) REQUIRE r.nombre IS UNIQUE")

    existing = session.run("MATCH (v:Vacancy) RETURN count(v) AS total").single()["total"]
    if existing:
        return

    query = """
    UNWIND $vacancies AS item
    MERGE (v:Vacancy {id: item.id})
    SET v.titulo = item.titulo,
        v.empresa = item.empresa,
        v.ubicacion = item.ubicacion,
        v.modalidad = item.modalidad,
        v.salario = item.salario,
        v.descripcion = item.descripcion,
        v.created_at = $created_at
    MERGE (r:Role {nombre: item.rol})
    MERGE (v)-[:PARA_ROL]->(r)
    WITH v, item
    UNWIND item.skills AS skill_name
    MERGE (s:Skill {nombre: skill_name})
    MERGE (v)-[:REQUIERE]->(s)
    """
    session.run(query, {"vacancies": DEFAULT_VACANCIES, "created_at": utc_now()})
