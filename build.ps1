$ErrorActionPreference = 'Stop'
Push-Location web
npm ci
npm run build
Pop-Location
cargo build --release
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item target\release\home_screen.exe dist\home_screen.exe -Force
Write-Host "Built dist\home_screen.exe"
