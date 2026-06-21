property logFile : "/tmp/opencow-latest-desktop-launch.log"
property repoRoot : "/Users/apple/Desktop/2026/opencow"
property launcherScript : "/Users/apple/Desktop/2026/opencow/scripts/start-opencow-latest-desktop-mac.command"

on run
  display notification "正在构建并打开最新版桌面端" with title "opencow 最新测试版"

  try
    do shell script "nohup /bin/zsh " & quoted form of launcherScript & " >/dev/null 2>&1 &"
  on error errorMessage number errorNumber
    display alert "opencow 最新测试版启动失败" message ("错误码: " & errorNumber & return & errorMessage & return & "日志: " & logFile) as critical
  end try
end run
