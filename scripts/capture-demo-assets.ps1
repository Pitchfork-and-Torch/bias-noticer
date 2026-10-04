# Capture Bias Noticer demo mockups to PNG via Brave/Chrome headless.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\capture-demo-assets.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# script lives in bias-noticer/scripts → root is bias-noticer
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$mockDir = Join-Path $root "docs\demo\mockups"
$outDir = Join-Path $root "docs\demo\assets"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$browser = @(
  "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) { throw "No Chromium browser found for headless screenshots" }
Write-Host "Browser: $browser"

$shots = @(
  @{ file = "01-install.html"; out = "01-install-extensions.png"; w = 1100; h = 700 },
  @{ file = "02-popup.html"; out = "02-popup-idle.png"; w = 900; h = 700 },
  @{ file = "03-article-raw.html"; out = "03-nyt-article-raw.png"; w = 1280; h = 900 },
  @{ file = "04-paywall-banner.html"; out = "04-paywall-banner.png"; w = 1280; h = 900 },
  @{ file = "05-reader.html"; out = "05-reader-extract.png"; w = 1280; h = 900 },
  @{ file = "sidepanel-mock.html"; out = "06-highlights-and-sidepanel.png"; w = 1400; h = 900 },
  @{ file = "sidepanel-mock.html"; out = "07-sidepanel-summary.png"; w = 1400; h = 900 },
  @{ file = "sidepanel-mock.html"; out = "08-sidepanel-detail.png"; w = 1400; h = 900 },
  @{ file = "09-settings.html"; out = "09-settings-model.png"; w = 1100; h = 800 },
  @{ file = "10-they-live.html"; out = "10-they-live-theme.png"; w = 1280; h = 800 },
  @{ file = "ethics-slate.html"; out = "00-ethics-slate.png"; w = 1280; h = 720 }
)

$userData = Join-Path $env:TEMP "bn-shot-profile"
New-Item -ItemType Directory -Force -Path $userData | Out-Null

foreach ($s in $shots) {
  $html = Join-Path $mockDir $s.file
  if (-not (Test-Path $html)) { Write-Host "SKIP missing $($s.file)"; continue }
  $uri = ([Uri]$html).AbsoluteUri
  $out = Join-Path $outDir $s.out
  $tmpShot = Join-Path $env:TEMP "bn-screenshot.png"
  Remove-Item $tmpShot -ErrorAction SilentlyContinue

  $args = @(
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=$($s.w),$($s.h)",
    "--user-data-dir=$userData",
    "--screenshot=$tmpShot",
    $uri
  )
  Write-Host "Capture $($s.out) ..."
  & $browser @args | Out-Null
  if (Test-Path $tmpShot) {
    Copy-Item $tmpShot $out -Force
    Write-Host "  OK $out ($((Get-Item $out).Length) bytes)"
  } else {
    Write-Host "  FAIL $out"
  }
}

Write-Host "Done. Assets in $outDir"
Get-ChildItem $outDir -Filter *.png | Select-Object Name, Length
