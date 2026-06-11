@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title opencow desktop test launcher

set "MODE=%~1"
set "ROOT=%~dp0"

echo [opencow] repo: %ROOT%
cd /d "%ROOT%"
if errorlevel 1 (
  echo [error] failed to enter repo root
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [error] npm was not found in PATH
  exit /b 1
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [error] cargo was not found in PATH
  exit /b 1
)

if not exist "node_modules" (
  echo [step] installing npm dependencies
  call npm install
  if errorlevel 1 (
    echo [error] npm install failed
    exit /b 1
  )
) else (
  echo [step] node_modules already present
)

echo [step] refreshing OpenClaw adapter build
call npm --workspace packages/openclaw-adapter run build
if errorlevel 1 (
  echo [error] OpenClaw adapter build failed
  exit /b 1
)

curl --silent --fail http://127.0.0.1:11434/api/tags >nul 2>nul
if errorlevel 1 (
  echo [error] Ollama is not reachable at http://127.0.0.1:11434
  echo [hint] start Ollama first, then run this launcher again
  exit /b 1
) else (
  echo [step] Ollama is reachable
)

if /I "%MODE%"=="check" (
  echo [ok] environment check passed
  exit /b 0
)

set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--enable-features=msEdgeDevToolsWdpRemoteDebugging --remote-debugging-port=9333"
echo [step] WebView2 smoke debugging endpoint: http://127.0.0.1:9333/json

echo [step] starting opencow desktop dev app
call npm run desktop:dev
exit /b %errorlevel%
