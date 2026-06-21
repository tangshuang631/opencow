#!/bin/zsh

set -euo pipefail

REPO_ROOT="/Users/apple/Desktop/2026/opencow"
DESKTOP_APP="/Users/apple/Desktop/OpenCow桌面端.app"
LOG_FILE="/tmp/opencow-latest-desktop-launch.log"
APP_BUNDLE_ID="cn.opencow.desktop"
APP_EXECUTABLE="opencow-desktop"
APP_BINARY="${DESKTOP_APP}/Contents/MacOS/${APP_EXECUTABLE}"
NODE_BIN="/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin"
SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"

export PATH="${NODE_BIN}:${HOME}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export SHELL="/bin/zsh"
export OPENCOW_WORKSPACE_ROOT="${REPO_ROOT}"

: > "${LOG_FILE}"
exec > >(tee -a "${LOG_FILE}") 2>&1

handle_launch_error() {
  local exit_code=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] launch failed with exit code ${exit_code}"
  exit "${exit_code}"
}

trap handle_launch_error ERR

close_existing_desktop_app() {
  /usr/bin/osascript -e "tell application id \"${APP_BUNDLE_ID}\" to quit" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! /usr/bin/pgrep -x "${APP_EXECUTABLE}" >/dev/null 2>&1; then
      return
    fi
    sleep 0.25
  done

  /usr/bin/pkill -x "${APP_EXECUTABLE}" >/dev/null 2>&1 || true
}

close_launcher_terminal_window() {
  if [[ "${TERM_PROGRAM:-}" != "Apple_Terminal" ]]; then
    return
  fi

  /usr/bin/osascript <<'APPLESCRIPT' >/dev/null 2>&1 || true
tell application "Terminal"
  if (count of windows) > 0 then
    close front window saving no
  end if
end tell
APPLESCRIPT
}

echo "[$(date '+%Y-%m-%d %H:%M:%S')] syncing latest desktop app"
close_existing_desktop_app
cd "${REPO_ROOT}"
python3 "${SYNC_SCRIPT}"
if [[ ! -x "${APP_BINARY}" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] missing desktop binary: ${APP_BINARY}"
  exit 1
fi
"${APP_BINARY}" >/dev/null 2>&1 &
APP_PID=$!
disown
echo "[$(date '+%Y-%m-%d %H:%M:%S')] launched ${DESKTOP_APP}"
sleep 1
if ! kill -0 "${APP_PID}" >/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] desktop process exited immediately"
  exit 1
fi
close_launcher_terminal_window
