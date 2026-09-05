# Installs DeepSeek Harness Desktop:
#   1. copies the packaged app to %LOCALAPPDATA%\Programs\DeepSeek Harness Desktop
#      (or the -TargetDir you pass, e.g. a folder on another drive)
#   2. creates a Desktop shortcut (one-click launch)
#   3. creates a Start Menu shortcut
#
# Usage:
#   .\install.ps1 [-SourceDir <packaged app dir>] [-TargetDir <install dir>]
param(
    [string]$SourceDir = (Join-Path $env:USERPROFILE "dsh-build\DeepSeek Harness Desktop"),
    [string]$TargetDir = (Join-Path $env:LOCALAPPDATA "Programs\DeepSeek Harness Desktop")
)

$ErrorActionPreference = "Stop"
$appName = "DeepSeek Harness"
$exeName = "DeepSeek Harness Desktop.exe"
$exe = Join-Path $TargetDir $exeName

if (-not (Test-Path (Join-Path $SourceDir $exeName))) {
    Write-Error "Packaged app not found: $SourceDir (run: npm run pack first)"
    exit 1
}

# ---- 1. copy app ----
if (Test-Path $TargetDir) {
    Remove-Item $TargetDir -Recurse -Force
}
Copy-Item $SourceDir $TargetDir -Recurse -Force
Write-Output "installed to: $TargetDir"

# ---- 2. shortcuts ----
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

foreach ($dir in @($desktop, $startMenu)) {
    if (-not $dir -or -not (Test-Path $dir)) { continue }
    $lnkPath = Join-Path $dir "$appName.lnk"
    $lnk = $shell.CreateShortcut($lnkPath)
    $lnk.TargetPath = $exe
    $lnk.WorkingDirectory = Split-Path $exe
    $lnk.IconLocation = "$exe,0"
    $lnk.Description = "DeepSeek Harness Desktop — one-click dsh web"
    $lnk.Save()
    Write-Output "shortcut created: $lnkPath"
}

Write-Output ""
Write-Output "Done! Double-click the '$appName' icon on your desktop to launch."
