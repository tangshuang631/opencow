$ErrorActionPreference = "Stop"

Write-Host "==> Running desktop unit tests"
npm --workspace apps/desktop run test:unit

Write-Host "==> Running repository build"
npm run build

Write-Host "==> Running encoding check"
npm run check:encoding

Write-Host "==> Running health check"
npm run check:health

Write-Host "==> Running desktop tauri tests"
Push-Location "apps/desktop/src-tauri"
try {
  cargo test
}
finally {
  Pop-Location
}
