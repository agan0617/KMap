# 由 tools/icon.html 產生網頁與 Android 的圖示 PNG（Edge headless 截圖 → System.Drawing 縮圖）
# 用法：powershell -File tools\build-icons.ps1 [-AndroidRes <KMapApp\app\src\main\res>]
param([string]$AndroidRes)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$tmp = Join-Path $PSScriptRoot '.cache\icons'
New-Item -ItemType Directory -Force $tmp | Out-Null
$page = 'file:///' + ((Join-Path $PSScriptRoot 'icon.html') -replace '\\', '/')

function Shot($query, $out) {
  $file = Join-Path $tmp $out
  $p = Start-Process -FilePath $edge -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', "--user-data-dir=$tmp\profile",
    '--window-size=1024,1024', "--screenshot=$file", "$page$query")
  if (-not (Test-Path $file)) { throw "截圖失敗：$out" }
  return $file
}
function Resize($src, $size, $dst) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($img, 0, 0, $size, $size)
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

$plain = Shot '' 'plain.png'
$mask = Shot '?mask=1' 'mask.png'
$fg = Shot '?fg=1' 'fg.png'

Resize $plain 192 "$root\icons\icon-192.png"
Resize $plain 512 "$root\icons\icon-512.png"
Resize $mask 512 "$root\icons\icon-maskable-512.png"
Resize $mask 180 "$root\icons\apple-touch-icon.png"
Write-Output '網頁圖示：icons\'

if ($AndroidRes) {
  $dens = @{ mdpi = 1; hdpi = 1.5; xhdpi = 2; xxhdpi = 3; xxxhdpi = 4 }
  foreach ($d in $dens.Keys) {
    Resize $plain ([int](48 * $dens[$d])) "$AndroidRes\mipmap-$d\ic_launcher.png"
    Resize $fg ([int](108 * $dens[$d])) "$AndroidRes\mipmap-$d\ic_launcher_fg.png"
  }
  Write-Output "Android 圖示：$AndroidRes"
}
