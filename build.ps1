# Manual, deterministic packaging:
#   copy working electron dist -> rename exe -> rcedit (icon+version) -> add resources\app
# (rcedit corruption seen with electron-packager is bypassed; rcedit invoked directly works.)
$ErrorActionPreference = "Stop"

$srcRoot = $PSScriptRoot
$electronDist = Join-Path $srcRoot "node_modules\electron\dist"
$buildRoot = Join-Path $env:USERPROFILE "dsh-build"
$pkg = Join-Path $buildRoot "DeepSeek Harness Desktop"

# ---- 1. fresh package dir from the working electron dist ----
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
Copy-Item $electronDist $pkg -Recurse -Force

# ---- 2. rename the binary ----
$exe = Join-Path $pkg "electron.exe"
$newExe = Join-Path $pkg "DeepSeek Harness Desktop.exe"
Rename-Item $exe $newExe

# ---- 3. embed icon + version info via rcedit (direct invocation works) ----
$rcedit = Join-Path $srcRoot "node_modules\rcedit\lib\rcedit.js"
$icon = Join-Path $srcRoot "build\icon.ico"
& node $rcedit $newExe `
    --set-icon $icon `
    --set-version-string FileDescription "DeepSeek Harness Desktop" `
    --set-version-string InternalName "DeepSeek Harness Desktop" `
    --set-version-string OriginalFilename "DeepSeek Harness Desktop.exe" `
    --set-version-string ProductName "DeepSeek Harness Desktop" `
    --set-product-version 1.0.0 --set-file-version 1.0.0
if ($LASTEXITCODE -ne 0) { Write-Error "rcedit failed"; exit 1 }

# ---- 4. app payload ----
$appDir = Join-Path $pkg "resources\app"
New-Item -ItemType Directory -Force -Path (Join-Path $appDir "build") | Out-Null
Copy-Item (Join-Path $srcRoot "main.js") $appDir
Copy-Item (Join-Path $srcRoot "build\icon.png") (Join-Path $appDir "build\")
Copy-Item (Join-Path $srcRoot "build\tray.png") (Join-Path $appDir "build\")
@{
    name        = "dsh-desktop"
    productName = "DeepSeek Harness Desktop"
    version     = "1.0.0"
    description = "Desktop client for DeepSeek Harness (dsh web) - one-click launch, tray support."
    main        = "main.js"
    author      = "dsh-desktop"
    license     = "MIT"
} | ConvertTo-Json | Set-Content (Join-Path $appDir "package.json") -Encoding UTF8

# drop the placeholder default app so ours loads
$defaultAsar = Join-Path $pkg "resources\default_app.asar"
if (Test-Path $defaultAsar) { Remove-Item $defaultAsar -Force }

# ---- 5. sanity: exe present (launch verification happens in smoke.ps1) ----
if (-not (Test-Path $newExe)) { Write-Error "packaged exe missing"; exit 1 }

# ---- 6. mirror into project dist/ ----
$projDist = Join-Path $srcRoot "dist"
if (Test-Path $projDist) { Remove-Item $projDist -Recurse -Force }
Copy-Item $pkg $projDist -Recurse -Force
Write-Output "packed -> $pkg"
Write-Output "mirrored -> $projDist"
