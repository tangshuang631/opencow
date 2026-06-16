#!/bin/zsh

set -euo pipefail

PID_FILE="/tmp/opencow-web-dev.pid"
PORT="1421"

kill_if_running() {
  local pid="$1"

  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    sleep 1
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi
}

if [[ -f "${PID_FILE}" ]]; then
  pid="$(tr -d '[:space:]' < "${PID_FILE}")"
  kill_if_running "${pid}"
  rm -f "${PID_FILE}"
fi

port_pids="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"

if [[ -n "${port_pids}" ]]; then
  while IFS= read -r port_pid; do
    kill_if_running "${port_pid}"
  done <<< "${port_pids}"
fi
