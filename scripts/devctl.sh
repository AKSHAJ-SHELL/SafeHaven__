#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.dev/logs"
PID_DIR="$ROOT_DIR/.dev/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
pidfile() { echo "$PID_DIR/$1.pid"; }

is_running() {
  local pf="$1"
  if [[ -f "$pf" ]]; then
    local pid
    pid=$(cat "$pf" || true)
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_service() {
  local name="$1"; shift
  local cwd="$1"; shift
  local cmd="$*"
  local pf; pf=$(pidfile "$name")
  local lf="$LOG_DIR/$name.log"
  if is_running "$pf"; then
    log "$name already running (pid $(cat "$pf"))"
    return 0
  fi
  log "Starting $name..."
  (cd "$cwd" && nohup bash -lc "$cmd" >"$lf" 2>&1 & echo $! >"$pf")
  sleep 0.8
  if is_running "$pf"; then
    log "$name started (pid $(cat "$pf")); logs: $lf"
  else
    log "Failed to start $name; see logs: $lf"
  fi
}

stop_service() {
  local name="$1"
  local pf; pf=$(pidfile "$name")
  if is_running "$pf"; then
    local pid; pid=$(cat "$pf")
    log "Stopping $name (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
      log "$name did not stop, forcing..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  else
    log "$name not running"
  fi
  rm -f "$pf"
}

status_service() {
  local name="$1"
  local pf; pf=$(pidfile "$name")
  if is_running "$pf"; then
    echo "$name: running (pid $(cat "$pf"))"
  else
    echo "$name: stopped"
  fi
}

start_mqtt() {
  local name="mqtt"
  local pf; pf=$(pidfile "$name")
  local lf="$LOG_DIR/$name.log"
  if is_running "$pf"; then
    log "MQTT already running (pid $(cat "$pf"))"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    # Use Homebrew if it's already started; otherwise start local config (TCP 1883 + WS 9011)
    if brew services list | grep -q "^mosquitto\s\+started"; then
      log "Mosquitto already running via Homebrew services"
      echo "homebrew" > "$pf"
      return 0
    fi
  fi
  log "Starting project Mosquitto (TCP 1883 + WS 9011)"
  (cd "$ROOT_DIR" && nohup mosquitto -c "$ROOT_DIR/configs/mosquitto-local.conf" >"$lf" 2>&1 & echo $! >"$pf")
  sleep 0.8
  if is_running "$pf"; then
    log "MQTT started (pid $(cat "$pf")); logs: $lf"
  else
    log "Failed to start MQTT; see logs: $lf"
  fi
}

stop_mqtt() {
  local pf; pf=$(pidfile "mqtt")
  if [[ -f "$pf" ]] && [[ $(cat "$pf") == "homebrew" ]]; then
    log "Stopping Mosquitto via Homebrew services..."
    brew services stop mosquitto >/dev/null 2>&1 || true
    rm -f "$pf"
    return 0
  fi
  stop_service "mqtt"
}

start_all() {
  start_mqtt
  start_service api "$ROOT_DIR" "npm run dev --workspace=apps/api"
  start_service inference "$ROOT_DIR" "npm run dev --workspace=workers/inference"
  start_service actions "$ROOT_DIR" "npm run dev --workspace=workers/actions-service"
  start_service web "$ROOT_DIR" "npm run dev --workspace=apps/web"
}

stop_all() {
  stop_service web
  stop_service actions
  stop_service inference
  stop_service api
  stop_mqtt
}

status_all() {
  status_service mqtt
  status_service api
  status_service inference
  status_service actions
  status_service web
}

usage() {
  cat <<EOF
Usage: $0 <start|stop|status> [service]

Services:
  mqtt, api, inference, actions, web, all

Examples:
  $0 start all
  $0 start api web
  $0 status
  $0 stop all
EOF
}

main() {
  if [[ $# -lt 1 ]]; then usage; exit 1; fi
  local cmd="$1"; shift || true
  case "$cmd" in
    start)
      if [[ $# -eq 0 ]]; then usage; exit 1; fi
      for s in "$@"; do
        case "$s" in
          mqtt) start_mqtt;;
          api) start_service api "$ROOT_DIR" "npm run dev --workspace=apps/api";;
          inference) bash "$ROOT_DIR/workers/inference/scripts/fetch-models.sh" >/dev/null 2>&1 || true; start_service inference "$ROOT_DIR" "HEALTH_PORT=7018 npm run dev --workspace=workers/inference";;
          actions) start_service actions "$ROOT_DIR" "npm run dev --workspace=workers/actions-service";;
          web) start_service web "$ROOT_DIR" "npm run dev --workspace=apps/web";;
          all) start_all;;
          *) log "Unknown service: $s"; usage; exit 1;;
        esac
      done
      ;;
    stop)
      if [[ $# -eq 0 ]]; then usage; exit 1; fi
      for s in "$@"; do
        case "$s" in
          mqtt) stop_mqtt;;
          api) stop_service api;;
          inference) stop_service inference;;
          actions) stop_service actions;;
          web) stop_service web;;
          all) stop_all;;
          *) log "Unknown service: $s"; usage; exit 1;;
        esac
      done
      ;;
    status)
      status_all
      ;;
    *) usage; exit 1;;
  esac
}

main "$@"
