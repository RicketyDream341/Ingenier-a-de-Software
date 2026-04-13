# Profile Manager

Profile Manager es una plataforma web para gestionar perfiles profesionales y recomendar vacantes laborales de forma explicable. El sistema permite registrar candidatos, completar informacion profesional, relacionar habilidades con roles y vacantes, y mostrar por que una oportunidad puede ser relevante para cada usuario.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Base de datos: Neo4j 5
- Autenticacion: bcrypt para contrasenas y cookie HttpOnly con JWT firmado
- Orquestacion local: Docker Compose + script de arranque

## Requisitos

Antes de iniciar, instala:

- Docker
- docker-compose
- Python 3
- Node.js y npm
- curl

En Linux, si tu usuario no tiene permisos directos para Docker, el script pedira `sudo` cuando sea necesario.

## Ejecutar La Aplicacion

Desde la raiz del proyecto:

```bash
bash start_app.sh start
```

El script levanta Neo4j, backend y frontend. Tambien espera a que cada servicio responda antes de terminar.

URLs locales:

```text
Frontend: http://127.0.0.1:5173
Backend:  http://127.0.0.1:8000
Neo4j:    http://127.0.0.1:7474
```

Credenciales locales de Neo4j:

```text
Usuario:  neo4j
Password: neo4j123
```

## Comandos Utiles

Iniciar todo:

```bash
bash start_app.sh start
```

Ver estado:

```bash
bash start_app.sh status
```

Reiniciar todo:

```bash
bash start_app.sh restart
```

Detener todo:

```bash
bash start_app.sh stop
```

Ver logs:

```bash
tail -f .run_logs/backend.log
tail -f .run_logs/frontend.log
```

## Datos Demo

Para crear 10 candidatos de prueba:

```bash
bash scripts/seed_demo_data.sh
```

El script asume que backend y Neo4j ya estan corriendo. Puedes levantar todo antes con:

```bash
bash start_app.sh start
```

Todos los usuarios demo usan esta contrasena:

```text
123456
```

## Estructura Del Proyecto

```text
.
├── backend/
│   ├── auth.py          # Registro, login, cookies JWT y logout
│   ├── database.py      # Conexion Neo4j, seed de vacantes y utilidades
│   ├── main.py          # App FastAPI y routers
│   ├── profiles.py      # Consulta de usuarios/candidatos
│   ├── schemas.py       # Modelos Pydantic
│   └── vacancies.py     # Vacantes, recomendaciones y postulaciones
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # UI principal y rutas
│   │   └── main.jsx
│   └── package.json
├── scripts/
│   └── seed_demo_data.sh
├── docker-compose.yml
├── requirements.txt
└── start_app.sh
```

## Modelo En Neo4j

Labels principales:

- `User`: candidato
- `Skill`: habilidad
- `Role`: rol laboral
- `Vacancy`: vacante
- `Application`: postulacion

Relaciones principales:

- `(User)-[:TIENE_SKILL]->(Skill)`
- `(User)-[:BUSCA_ROL]->(Role)`
- `(Vacancy)-[:REQUIERE]->(Skill)`
- `(Vacancy)-[:PARA_ROL]->(Role)`
- `(User)-[:REALIZO_POSTULACION]->(Application)-[:A_VACANTE]->(Vacancy)`

## Matching

El matching se hace en Neo4j desde el endpoint:

```text
GET /recommendations/{user_id}
```

La consulta compara las skills del candidato con las skills requeridas por cada vacante y suma puntos por:

- Coincidencia de skills
- Coincidencia con el rol objetivo
- Coincidencia con la modalidad preferida

El resultado incluye `score`, `matched_skills` y una explicacion textual.

## Endpoints Principales

Verificacion de servicios:

```text
GET /
GET /test-db
```

Autenticacion:

```text
POST /users
POST /login
GET  /session
POST /logout
```

Perfiles y vacantes:

```text
GET /users
GET /vacancies
GET /recommendations/{user_id}
```

Postulaciones:

```text
POST /applications
GET  /applications/{user_id}
```

## Consultas Neo4j Utiles

Ver usuarios:

```cypher
MATCH (u:User)
RETURN u.id, u.username, u.nombre, u.email, u.rol_objetivo, u.skills
ORDER BY u.created_at DESC
```

Ver skills por candidato:

```cypher
MATCH (u:User)-[:TIENE_SKILL]->(s:Skill)
RETURN u.nombre AS candidato, collect(s.nombre) AS skills
ORDER BY candidato
```

Ver vacantes con skills:

```cypher
MATCH (v:Vacancy)-[:REQUIERE]->(s:Skill)
RETURN v.titulo AS vacante, collect(s.nombre) AS skills
ORDER BY vacante
```

Ver grafo completo limitado:

```cypher
MATCH p=(n)-[r]->(m)
RETURN p
LIMIT 50
```

## Autenticacion

Las contrasenas se guardan con `bcrypt`. El salt se genera automaticamente dentro del hash.

Al iniciar sesion, el backend crea un JWT firmado y lo guarda en una cookie:

```text
profile_manager_session
```

La cookie es `HttpOnly`, tiene `SameSite=Lax` y expira en 8 horas. Al hacer logout, el backend borra la cookie inmediatamente.

La clave de firma del JWT se genera aleatoriamente al arrancar el backend. Por eso, si se reinicia el backend, las sesiones anteriores dejan de ser validas.
