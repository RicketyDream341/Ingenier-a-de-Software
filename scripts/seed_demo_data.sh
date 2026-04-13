#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: comando no encontrado: $1"
    exit 1
  fi
}

post_user() {
  local payload="$1"
  curl -fsS -X POST "$API_BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null
}

require_cmd curl

echo "Verificando backend en $API_BASE_URL..."
curl -fsS "$API_BASE_URL/test-db" >/dev/null

echo "Creando usuarios demo..."

post_user '{"id":"demo-ana-backend","username":"ana_backend","nombre":"Ana Torres","email":"ana.backend@example.com","password":"123456","fecha_nacimiento":"1996-02-14","edad":30,"telefono":"3001000001","ciudad":"Bogota","ocupacion":"Desarrolladora backend","skills":["Python","FastAPI","Neo4j","APIs"],"intereses":["Python","FastAPI","Neo4j","APIs"],"rol_objetivo":"Backend Developer","modalidad":"Hibrido","aspiracion_salarial":6500000,"disponibilidad":"Inmediata","experiencia":"APIs REST y servicios con Python","educacion":"Ingenieria de Sistemas"}'
post_user '{"id":"demo-bruno-frontend","username":"bruno_frontend","nombre":"Bruno Salazar","email":"bruno.frontend@example.com","password":"123456","fecha_nacimiento":"1999-07-22","edad":26,"telefono":"3001000002","ciudad":"Medellin","ocupacion":"Frontend developer","skills":["React","JavaScript","HTML","CSS"],"intereses":["React","JavaScript","HTML","CSS"],"rol_objetivo":"Frontend Developer","modalidad":"Remoto","aspiracion_salarial":5400000,"disponibilidad":"2 semanas","experiencia":"Interfaces React y componentes reutilizables","educacion":"Tecnologia en Desarrollo Web"}'
post_user '{"id":"demo-camila-data","username":"camila_data","nombre":"Camila Rojas","email":"camila.data@example.com","password":"123456","fecha_nacimiento":"1995-11-03","edad":30,"telefono":"3001000003","ciudad":"Cali","ocupacion":"Data engineer","skills":["Neo4j","Python","Cypher","ETL"],"intereses":["Neo4j","Python","Cypher","ETL"],"rol_objetivo":"Data Engineer","modalidad":"Remoto","aspiracion_salarial":7600000,"disponibilidad":"Inmediata","experiencia":"Pipelines de datos y grafos","educacion":"Maestria en Analitica"}'
post_user '{"id":"demo-diego-qa","username":"diego_qa","nombre":"Diego Martinez","email":"diego.qa@example.com","password":"123456","fecha_nacimiento":"1997-09-18","edad":28,"telefono":"3001000004","ciudad":"Cali","ocupacion":"QA automation","skills":["Testing","Selenium","Python","CI"],"intereses":["Testing","Selenium","Python","CI"],"rol_objetivo":"QA Engineer","modalidad":"Presencial","aspiracion_salarial":4800000,"disponibilidad":"1 mes","experiencia":"Automatizacion de pruebas web","educacion":"Ingenieria de Software"}'
post_user '{"id":"demo-elena-fullstack","username":"elena_fullstack","nombre":"Elena Vargas","email":"elena.fullstack@example.com","password":"123456","fecha_nacimiento":"1994-04-30","edad":31,"telefono":"3001000005","ciudad":"Bogota","ocupacion":"Full stack developer","skills":["React","JavaScript","Python","FastAPI"],"intereses":["React","JavaScript","Python","FastAPI"],"rol_objetivo":"Backend Developer","modalidad":"Remoto","aspiracion_salarial":7000000,"disponibilidad":"Inmediata","experiencia":"Aplicaciones full stack","educacion":"Ingenieria Informatica"}'
post_user '{"id":"demo-felipe-cypher","username":"felipe_cypher","nombre":"Felipe Mora","email":"felipe.cypher@example.com","password":"123456","fecha_nacimiento":"1993-12-08","edad":32,"telefono":"3001000006","ciudad":"Barranquilla","ocupacion":"Graph analyst","skills":["Neo4j","Cypher","SQL","ETL"],"intereses":["Neo4j","Cypher","SQL","ETL"],"rol_objetivo":"Data Engineer","modalidad":"Hibrido","aspiracion_salarial":7200000,"disponibilidad":"2 semanas","experiencia":"Analisis de grafos y consultas Cypher","educacion":"Ciencia de Datos"}'
post_user '{"id":"demo-gabriela-react","username":"gabriela_react","nombre":"Gabriela Nunez","email":"gabriela.react@example.com","password":"123456","fecha_nacimiento":"2000-01-16","edad":26,"telefono":"3001000007","ciudad":"Medellin","ocupacion":"UI developer","skills":["React","JavaScript","Testing","CSS"],"intereses":["React","JavaScript","Testing","CSS"],"rol_objetivo":"Frontend Developer","modalidad":"Hibrido","aspiracion_salarial":5200000,"disponibilidad":"Inmediata","experiencia":"Frontends con pruebas de componentes","educacion":"Diseno Interactivo"}'
post_user '{"id":"demo-hector-python","username":"hector_python","nombre":"Hector Ruiz","email":"hector.python@example.com","password":"123456","fecha_nacimiento":"1998-06-27","edad":27,"telefono":"3001000008","ciudad":"Bogota","ocupacion":"Python developer","skills":["Python","APIs","SQL","FastAPI"],"intereses":["Python","APIs","SQL","FastAPI"],"rol_objetivo":"Backend Developer","modalidad":"Presencial","aspiracion_salarial":6000000,"disponibilidad":"1 mes","experiencia":"Servicios backend y bases relacionales","educacion":"Ingenieria Electronica"}'
post_user '{"id":"demo-isabel-testing","username":"isabel_testing","nombre":"Isabel Pena","email":"isabel.testing@example.com","password":"123456","fecha_nacimiento":"1996-10-11","edad":29,"telefono":"3001000009","ciudad":"Cali","ocupacion":"QA manual y automation","skills":["Testing","Selenium","JavaScript","CI"],"intereses":["Testing","Selenium","JavaScript","CI"],"rol_objetivo":"QA Engineer","modalidad":"Remoto","aspiracion_salarial":5000000,"disponibilidad":"Inmediata","experiencia":"Pruebas funcionales y automatizadas","educacion":"Calidad de Software"}'
post_user '{"id":"demo-julian-mixed","username":"julian_mixed","nombre":"Julian Castro","email":"julian.mixed@example.com","password":"123456","fecha_nacimiento":"1992-03-25","edad":34,"telefono":"3001000010","ciudad":"Bogota","ocupacion":"Tech lead","skills":["Python","Neo4j","React","Testing"],"intereses":["Python","Neo4j","React","Testing"],"rol_objetivo":"Data Engineer","modalidad":"Remoto","aspiracion_salarial":8500000,"disponibilidad":"2 meses","experiencia":"Liderazgo tecnico en productos de datos","educacion":"Especializacion en Arquitectura"}'

echo "Usuarios demo creados."
echo "Total esperado: 10 candidatos."
