# Check Chrome Web Store public version for Bias Noticer.
# Exit 0 always; writes JSON status for agents / CI.
param(
  [string]$ExtensionId = "fomgclbljaghhlnnemplpobaipegkkfc",
  [string]$ExpectedVersion = "2.0.0",
  [string]$OutPath = ""
)

$ErrorActionPreference = "Continue"
$url = "https://chromewebstore.google.com/detail/bias-noticer/$ExtensionId`?hl=en"
$storeUrl = "https://chromewebstore.google.com/detail/bias-noticer/$ExtensionId"

$result = [ordered]@{
  checkedAt      = (Get-Date).ToUniversalTime().ToString("o")
  extensionId    = $ExtensionId
  storeUrl       = $storeUrl
  expectedVersion = $ExpectedVersion
  liveVersion    = $null
  isLive         = $false
  matchesExpected = $false
  addToChrome    = $false
  error          = $null
}

try {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
  $c = $r.Content
  $result.isLive = ($r.StatusCode -eq 200) -and ($c -match "Bias Noticer")
  $result.addToChrome = $c -match "Add to Chrome"

  # Prefer explicit Version label on CWS detail page
  $m = [regex]::Match($c, "Version</div><div[^>]*>([0-9]+\.[0-9]+(?:\.[0-9]+)?)")
  if ($m.Success) {
    $result.liveVersion = $m.Groups[1].Value
  } else {
    # Fallback: first semver near item metadata (best-effort)
    $m2 = [regex]::Match($c, '"version"\s*:\s*"([0-9]+\.[0-9]+(?:\.[0-9]+)?)"')
    if ($m2.Success) { $result.liveVersion = $m2.Groups[1].Value }
  }

  if ($result.liveVersion) {
    $result.matchesExpected = ($result.liveVersion -eq $ExpectedVersion)
  }
} catch {
  $result.error = $_.Exception.Message
}

$json = $result | ConvertTo-Json -Compress
Write-Output $json

if ($OutPath) {
  $dir = Split-Path $OutPath -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  Set-Content -Path $OutPath -Value ($result | ConvertTo-Json) -Encoding utf8
}

if ($result.matchesExpected) { exit 10 } # special code for "ready to publish polish"
exit 0
