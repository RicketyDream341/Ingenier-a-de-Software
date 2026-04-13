#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_DIR="$ROOT_DIR/.run_pids"
LOG_DIR="$ROOT_DIR/.run_logs"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:5173"
NEO4J_URL="http://127.0.0.1:7474"
DOCKER_USE_SUDO=0

mkdir -p "$PID_DIR" "$LOG_DIR"

fix_runtime_permissions() {
  local owner
  owner="$(id -un):$(id -gn)"

  if ! touch "$BACKEND_LOG" "$FRONTEND_LOG" >/dev/null 2>&1; then
    echo "Corrigiendo permisos en logs/PIDs con sudo..."
    sudo chown -R "$owner" "$LOG_DIR" "$PID_DIR"
    touch "$BACKEND_LOG" "$FRONTEND_LOG"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: comando no encontrado: $1"
    exit 1
  fi
}

docker_compose() {
  if ! command -v docker-compose >/dev/null 2>&1; then
    echo "Error: docker-compose no esta instalado en el sistema."
    exit 1
  fi

  local output
  local status

  output="$(docker-compose -f "$ROOT_DIR/docker-compose.yml" "$@" 2>&1)" && {
    [[ -n "$output" ]] && echo "$output"
    return
  }
  status=$?

  if echo "$output" | grep -qi "permission denied while trying to connect to the Docker daemon socket"; then
    echo "Docker requiere permisos. Reintentando con sudo..."
    DOCKER_USE_SUDO=1
    sudo docker-compose -f "$ROOT_DIR/docker-compose.yml" "$@"
    return
  fi

  echo "$output"
  return "$status"
}

docker_cmd() {
  if [[ "$DOCKER_USE_SUDO" -eq 1 ]]; then
    sudo docker "$@"
    return
  fi

  local output
  local status
  output="$(docker "$@" 2>&1)" && {
    [[ -n "$output" ]] && echo "$output"
    return
  }
  status=$?

  if echo "$output" | grep -qi "permission denied while trying to connect to the Docker daemon socket"; then
    DOCKER_USE_SUDO=1
    sudo docker "$@"
    return
  fi

  echo "$output"
  return "$status"
}

is_running() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

clear_stale_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]] && ! is_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  local workdir="$4"
  local cmd="$5"

  clear_stale_pid "$pid_file"

  if is_running "$pid_file"; then
    echo "$name ya esta corriendo (PID $(cat "$pid_file"))."
    return
  fi

  echo "Iniciando $name..."
  nohup setsid bash -lc "cd '$workdir' && exec $cmd" >"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"

  sleep 1
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "$name iniciado (PID $pid). Log: $log_file"
  else
    echo "Error: $name no inicio correctamente. Revisa: $log_file"
    rm -f "$pid_file"
    exit 1
  fi
}

stop_process() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "$pid_file"; then
    echo "$name no esta corriendo."
    rm -f "$pid_file"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  echo "Deteniendo $name (PID $pid)..."
  kill "$pid" >/dev/null 2>&1 || true
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "Forzando cierre de $name (PID $pid)..."
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
  echo "$name detenido."
}

kill_port_if_open() {
  local port="$1"
  local label="$2"

  if ! command -v fuser >/dev/null 2>&1; then
    return
  fi

  local pids
  pids="$(fuser -n tcp "$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Cerrando proceso(s) en puerto $port ($label): $pids"
    fuser -k -n tcp "$port" >/dev/null 2>&1 || true
  fi
}

wait_until() {
  local label="$1"
  local attempts="$2"
  local delay="$3"
  shift 3

  echo "Esperando $label..."
  for ((i = 1; i <= attempts; i++)); do
    if "$@" >/dev/null 2>&1; then
      echo "$label listo."
      return 0
    fi
    sleep "$delay"
  done

  echo "Error: $label no quedo listo a tiempo."
  return 1
}

check_neo4j_ready() {
  docker_cmd exec graphmatchx-neo4j cypher-shell -u neo4j -p neo4j123 "RETURN 1" >/dev/null
}

check_http_ok() {
  local url="$1"
  curl -fsS "$url" >/dev/null
}

ensure_python_dependencies() {
  if python3 - <<'PY' >/dev/null 2>&1
import bcrypt
import fastapi
import jwt
import neo4j
import uvicorn
PY
  then
    return
  fi

  echo "Instalando dependencias Python..."
  python3 -m pip install --user -r "$ROOT_DIR/requirements.txt"
}

start_all() {
  require_cmd docker
  require_cmd npm
  require_cmd python3
  require_cmd curl
  fix_runtime_permissions

  echo "Levantando Neo4j con Docker Compose..."
  docker_compose up -d neo4j
  wait_until "Neo4j" 45 2 check_neo4j_ready

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "Instalando dependencias del frontend..."
    npm install --prefix "$FRONTEND_DIR"
  fi

  ensure_python_dependencies

  local python_bin="python3"
  if [[ -x "$ROOT_DIR/venv/bin/python" ]]; then
    python_bin="$ROOT_DIR/venv/bin/python"
  elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    python_bin="$ROOT_DIR/.venv/bin/python"
  fi

  start_process "Backend FastAPI" \
    "$BACKEND_PID_FILE" \
    "$BACKEND_LOG" \
    "$BACKEND_DIR" \
    "$python_bin -m uvicorn main:app --host 127.0.0.1 --port 8000"
  wait_until "Backend FastAPI" 30 1 check_http_ok "$BACKEND_URL/"
  wait_until "Conexion backend-Neo4j" 30 1 check_http_ok "$BACKEND_URL/test-db"

  start_process "Frontend React (Vite)" \
    "$FRONTEND_PID_FILE" \
    "$FRONTEND_LOG" \
    "$FRONTEND_DIR" \
    "npm run dev -- --host 127.0.0.1 --port 5173"
  wait_until "Frontend React" 30 1 check_http_ok "$FRONTEND_URL/"

  echo
  echo "Sistema iniciado."
  echo "Frontend: $FRONTEND_URL"
  echo "Backend:  $BACKEND_URL"
  echo "Neo4j:    $NEO4J_URL"
  echo
  echo "Logs:"
  echo "  tail -f '$BACKEND_LOG'"
  echo "  tail -f '$FRONTEND_LOG'"
  echo
  echo "Para detener todo:"
  echo "  $0 stop"
}

stop_all() {
  stop_process "Frontend React (Vite)" "$FRONTEND_PID_FILE"
  stop_process "Backend FastAPI" "$BACKEND_PID_FILE"
  kill_port_if_open 5173 "Frontend React (Vite)"
  kill_port_if_open 8000 "Backend FastAPI"

  echo "Deteniendo Neo4j..."
  docker_compose stop neo4j >/dev/null 2>&1 || true
  echo "Neo4j detenido."
}

status_all() {
  clear_stale_pid "$BACKEND_PID_FILE"
  clear_stale_pid "$FRONTEND_PID_FILE"

  if is_running "$BACKEND_PID_FILE"; then
    echo "Backend: activo (PID $(cat "$BACKEND_PID_FILE"))"
  else
    echo "Backend: inactivo"
  fi

  if is_running "$FRONTEND_PID_FILE"; then
    echo "Frontend: activo (PID $(cat "$FRONTEND_PID_FILE"))"
  else
    echo "Frontend: inactivo"
  fi

  local neo4j_status
  neo4j_status="$(docker_compose ps --status running --services 2>/dev/null | grep -Fx neo4j || true)"
  if [[ "$neo4j_status" == "neo4j" ]]; then
    echo "Neo4j: activo"
  else
    echo "Neo4j: inactivo"
  fi

  if check_http_ok "$BACKEND_URL/" >/dev/null 2>&1; then
    echo "Backend HTTP: OK ($BACKEND_URL)"
  else
    echo "Backend HTTP: sin respuesta ($BACKEND_URL)"
  fi

  if check_http_ok "$FRONTEND_URL/" >/dev/null 2>&1; then
    echo "Frontend HTTP: OK ($FRONTEND_URL)"
  else
    echo "Frontend HTTP: sin respuesta ($FRONTEND_URL)"
  fi
}

action="${1:-start}"

if [[ "${EUID:-$(id -u)}" -eq 0 ]] && [[ "$action" != "stop" ]]; then
  echo "No ejecutes este script con sudo para start/restart/status."
  echo "Usa: bash $0 $action"
  echo "Solo usa sudo para limpiar procesos huerfanos si hace falta."
  exit 1
fi

case "$action" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  *)
    echo "Uso: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
