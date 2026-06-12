@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title opencow desktop test launcher

set "MODE=%~1"
set "ROOT=%~dp0"
set "EXIT_CODE=0"

echo [opencow] repo: %ROOT%
cd /d "%ROOT%"
if errorlevel 1 (
  echo [error] failed to enter repo root
  set "EXIT_CODE=1"
  goto :done
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [error] npm was not found in PATH
  set "EXIT_CODE=1"
  goto :done
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [error] cargo was not found in PATH
  set "EXIT_CODE=1"
  goto :done
)

if not exist "node_modules" (
  echo [step] installing npm dependencies
  call npm install
  if errorlevel 1 (
    echo [error] npm install failed
    set "EXIT_CODE=1"
    goto :done
  )
) else (
  echo [step] node_modules already present
)

echo [step] refreshing OpenClaw adapter build
call npm run predesktop:dev
if errorlevel 1 (
  echo [error] OpenClaw adapter build failed
  set "EXIT_CODE=1"
  goto :done
)

curl --silent --fail http://127.0.0.1:11434/api/tags >nul 2>nul
if errorlevel 1 (
  echo [error] Ollama is not reachable at http://127.0.0.1:11434
  echo [hint] start Ollama first, then run this launcher again
  set "EXIT_CODE=1"
  goto :done
) else (
  echo [step] Ollama is reachable
)

if /I "%MODE%"=="check" (
  echo [ok] environment check passed
  goto :done
)

set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--enable-features=msEdgeDevToolsWdpRemoteDebugging --remote-debugging-port=9333"
echo [step] WebView2 smoke debugging endpoint: http://127.0.0.1:9333/json

echo [step] starting opencow desktop dev app
call npm run desktop:dev
set "EXIT_CODE=%errorlevel%"

goto :done

:done
if "!EXIT_CODE!"=="0" (
  exit /b 0
)
echo.
echo [done] launcher finished with errors (exit !EXIT_CODE!)
if /I "%MODE%"=="check" (
  exit /b !EXIT_CODE!
)
echo [hint] press any key to close this window
pause >nul
exit /b !EXIT_CODE!
