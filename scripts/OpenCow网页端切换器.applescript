property repoRoot : "/Users/apple/Desktop/2026/opencow"
property nodeBin : "/Users/apple/.local/opt/node-v24.16.0-darwin-arm64/bin"
property appUrl : "http://127.0.0.1:1421"
property pidFile : "/tmp/opencow-web-dev.pid"
property logFile : "/tmp/opencow-web-dev.log"

on run
  set existingPid to my readPidFile(pidFile)
  set serverReady to my isServerReady(appUrl)

  if existingPid is not "" and my isPidRunning(existingPid) then
    my stopServer(pidFile)
    display dialog "OpenCow 网页端已退出" buttons {"确定"} default button "确定"
    return
  end if

  my startServer(repoRoot, nodeBin, pidFile, logFile)

  repeat 60 times
    delay 1
    if my isServerReady(appUrl) then
      do shell script "open " & quoted form of appUrl
      return
    end if
  end repeat

  display alert "OpenCow 网页端启动失败" message "60 秒内没有等到 http://127.0.0.1:1421 就绪。可查看 /tmp/opencow-web-dev.log。"
end run

on readPidFile(pidFile)
  try
    return do shell script "if [ -f " & quoted form of pidFile & " ]; then tr -d '[:space:]' < " & quoted form of pidFile & "; fi"
  on error
    return ""
  end try
end readPidFile

on isPidRunning(pidValue)
  try
    do shell script "kill -0 " & quoted form of pidValue
    return true
  on error
    return false
  end try
end isPidRunning

on isServerReady(appUrl)
  try
    do shell script "curl -fsS --max-time 2 " & quoted form of appUrl & " >/dev/null"
    return true
  on error
    return false
  end try
end isServerReady

on startServer(repoRoot, nodeBin, pidFile, logFile)
  set commandText to "cd " & quoted form of repoRoot & " && PATH=" & quoted form of (nodeBin & ":$PATH") & " nohup npm --workspace apps/web run dev > " & quoted form of logFile & " 2>&1 & echo $! > " & quoted form of pidFile
  do shell script commandText
end startServer

on stopServer(pidFile)
  set cleanupScript to "PID_FILE=" & quoted form of pidFile & "\n" & ¬
    "kill_if_running() {\n" & ¬
    "  pid=\"$1\"\n" & ¬
    "  if [ -n \"$pid\" ] && kill -0 \"$pid\" 2>/dev/null; then\n" & ¬
    "    kill \"$pid\" 2>/dev/null || true\n" & ¬
    "    sleep 1\n" & ¬
    "    if kill -0 \"$pid\" 2>/dev/null; then\n" & ¬
    "      kill -9 \"$pid\" 2>/dev/null || true\n" & ¬
    "    fi\n" & ¬
    "  fi\n" & ¬
    "}\n" & ¬
    "if [ -f \"$PID_FILE\" ]; then\n" & ¬
    "  pid=$(tr -d '[:space:]' < \"$PID_FILE\")\n" & ¬
    "  kill_if_running \"$pid\"\n" & ¬
    "  rm -f \"$PID_FILE\"\n" & ¬
    "fi\n" & ¬
    "port_pids=$(lsof -ti tcp:1421 2>/dev/null || true)\n" & ¬
    "if [ -n \"$port_pids\" ]; then\n" & ¬
    "  while IFS= read -r port_pid; do\n" & ¬
    "    kill_if_running \"$port_pid\"\n" & ¬
    "  done <<EOF\n" & ¬
    "$port_pids\n" & ¬
    "EOF\n" & ¬
    "fi"

  do shell script "/bin/zsh -lc " & quoted form of cleanupScript
end stopServer
