# Generates the DeepSeek Harness Desktop app icons:
#   build/icon.png   (256x256)
#   build/tray.png   (32x32)
#   build/icon.ico   (multi-size: 16..256)
param([string]$OutDir = (Join-Path $PSScriptRoot "build"))

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function New-AppIconBitmap([int]$size) {
    $S = $size * 4
    $bmp = [System.Drawing.Bitmap]::new($S, $S)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($S * 0.06)
    $w = [float]($S - 2 * $pad)
    $rect = [System.Drawing.RectangleF]::new($pad, $pad, $w, $w)
    $radius = [float]($S * 0.22)
    $d = 2 * $radius
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $c1 = [System.Drawing.Color]::FromArgb(255, 92, 118, 255)   # #5C76FF
    $c2 = [System.Drawing.Color]::FromArgb(255, 30, 45, 110)    # #1E2D6E
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, 45.0)
    $g.FillPath($brush, $path)

    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 255, 255, 255), [float]($S * 0.012))
    $g.DrawPath($pen, $path)

    $font = [System.Drawing.Font]::new("Segoe UI", [float]($S * 0.52), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = [System.Drawing.StringFormat]::new()
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $fmt.FormatFlags = [System.Drawing.StringFormatFlags]::NoClip
    $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $textRect = [System.Drawing.RectangleF]::new(0, [float]($S * 0.02), $S, $S)
    $g.DrawString("D", $font, $textBrush, $textRect, $fmt)

    $textBrush.Dispose(); $fmt.Dispose(); $font.Dispose()
    $pen.Dispose(); $brush.Dispose(); $path.Dispose()
    $g.Dispose()

    $out = [System.Drawing.Bitmap]::new($size, $size)
    $g2 = [System.Drawing.Graphics]::FromImage($out)
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($bmp, 0, 0, $size, $size)
    $g2.Dispose()
    $bmp.Dispose()
    return $out
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$file) {
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
}

$big = New-AppIconBitmap 256
Save-Png $big (Join-Path $OutDir "icon.png")
$tray = New-AppIconBitmap 32
Save-Png $tray (Join-Path $OutDir "tray.png")

# ---- write raw PNGs for every ico size (packed into .ico by pack-ico.mjs) ----
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$rawDir = Join-Path $OutDir "raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
foreach ($s in $sizes) {
    $b = New-AppIconBitmap $s
    Save-Png $b (Join-Path $rawDir ("icon-{0}.png" -f $s))
    $b.Dispose()
}

$big.Dispose(); $tray.Dispose()
Write-Output "icons written to $OutDir"
Get-ChildItem $OutDir | Select-Object Name, Length | Format-Table -AutoSize
