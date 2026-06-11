$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Label,
    [Parameter(Mandatory = $true)]
    [scriptblock] $Command
  )

  Write-Host "==> $Label"
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

Invoke-Checked "Running desktop unit tests" {
  npm --workspace packages/openclaw-adapter run build
  npm --workspace apps/desktop run test:unit
}

Invoke-Checked "Running repository build" {
  npm run build
}

Invoke-Checked "Running encoding check" {
  npm run check:encoding
}

Invoke-Checked "Running health check" {
  npm run check:health
}

Write-Host "==> Running desktop tauri tests"
Push-Location "apps/desktop/src-tauri"
try {
  cargo test

  if ($LASTEXITCODE -ne 0) {
    throw "Desktop tauri tests failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}
