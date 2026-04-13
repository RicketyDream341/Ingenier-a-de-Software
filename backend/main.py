from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from database import driver, ensure_seed_data
from profiles import router as profiles_router
from vacancies import router as vacancies_router

app = FastAPI(title="Profile Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(vacancies_router)


@app.get("/")
def root():
    return {"message": "Profile Manager API running"}


@app.get("/test-db")
def test_db():
    with driver.session() as session:
        ensure_seed_data(session)
        result = session.run("RETURN 'Neo4j connected' AS message")
        return {"result": result.single()["message"]}
