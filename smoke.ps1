# Smoke test: launches the packaged desktop app in test mode.
#   - uses port 3199 (separate from the real 3080 server)
#   - spawns its own `dsh web --port 3199`
#   - loads the UI, logs SMOKE_OK, then quits (killing the spawned server)
# Check: .smoke-logs\desktop.log contains "SMOKE_OK"
param(
    [string]$AppDir = (Join-Path $env:USERPROFILE "dsh-build\DeepSeek Harness Desktop")
)
$ErrorActionPreference = "Stop"
$exe = Join-Path $AppDir "DeepSeek Harness Desktop.exe"
if (-not (Test-Path $exe)) { Write-Error "packaged exe not found: $exe (run: npm run build)"; exit 1 }

$env:DSH_DESKTOP_SMOKE = "1"
$env:DSH_DESKTOP_URL = "http://127.0.0.1:3199"
$env:DSH_DESKTOP_LOG_DIR = Join-Path $PSScriptRoot ".smoke-logs"
$env:DSH_DESKTOP_USERDATA = Join-Path $PSScriptRoot ".smoke-userdata"

Remove-Item $env:DSH_DESKTOP_LOG_DIR -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $env:DSH_DESKTOP_LOG_DIR | Out-Null

Write-Output "launching: $exe"
$proc = Start-Process -FilePath $exe -PassThru
$deadline = (Get-Date).AddMinutes(3)
$ok = $false
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) { Write-Output "app exited early (code=$($proc.ExitCode))"; break }
    $log = Join-Path $env:DSH_DESKTOP_LOG_DIR "desktop.log"
    if (Test-Path $log) {
        $content = Get-Content $log -Raw -ErrorAction SilentlyContinue
        if ($content -match "SMOKE_OK") { $ok = $true; break }
    }
    Start-Sleep -Milliseconds 800
}
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
Write-Output "SMOKE_RESULT=$ok"
Write-Output "---- desktop.log ----"
if (Test-Path (Join-Path $env:DSH_DESKTOP_LOG_DIR "desktop.log")) {
    Get-Content (Join-Path $env:DSH_DESKTOP_LOG_DIR "desktop.log")
} else {
    Write-Output "(no log file)"
}
exit $(if ($ok) { 0 } else { 1 })
