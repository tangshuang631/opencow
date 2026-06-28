#!/bin/zsh

set -euo pipefail

REPO_ROOT="/Users/apple/Desktop/2026/opencow"
NODE_BIN="/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin"
APP_URL="http://127.0.0.1:1421"
PID_FILE="/tmp/opencow-web-dev.pid"
LOG_FILE="/tmp/opencow-web-dev.log"
START_COMMAND=(npm --workspace apps/web run dev)

export PATH="${NODE_BIN}:$PATH"
export SHELL="/bin/zsh"

is_pid_running() {
  local pid="$1"

  [[ -n "${pid}" ]] || return 1
  kill -0 "${pid}" 2>/dev/null
}

read_pid_file() {
  if [[ -f "${PID_FILE}" ]]; then
    tr -d '[:space:]' < "${PID_FILE}"
  fi
}

is_port_ready() {
  curl -fsS --max-time 2 "${APP_URL}" >/dev/null 2>&1
}

open_browser() {
  open "${APP_URL}"
}

start_server() {
  cd "${REPO_ROOT}"
  nohup "${START_COMMAND[@]}" > "${LOG_FILE}" 2>&1 &
  echo $! > "${PID_FILE}"
}

existing_pid="$(read_pid_file || true)"

if [[ -n "${existing_pid}" ]] && is_pid_running "${existing_pid}"; then
  if is_port_ready; then
    open_browser
    exit 0
  fi
fi

start_server

for _ in {1..60}; do
  if is_port_ready; then
    open_browser
    exit 0
  fi
  sleep 1
done

osascript -e 'display alert "OpenCow 网页端启动失败" message "60 秒内没有等到 http://127.0.0.1:1421 就绪。可查看 /tmp/opencow-web-dev.log。" as critical'
exit 1
