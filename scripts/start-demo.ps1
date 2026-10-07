param([switch]$CheckOnly, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$serverScript = Join-Path $PSScriptRoot 'serve-preview.js'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath) -or -not (Test-Path -LiteralPath $serverScript)) { throw 'Node.js or the local preview script is missing.' }
if ($CheckOnly) { Write-Output "Ready: $siteRoot"; exit 0 }

function Test-DemoPage([string]$demoUrl) {
  try {
    $response = Invoke-WebRequest -Uri $demoUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.Contains('name="bke-demo" content="20261007"')
  } catch { return $false }
}

$demoUrl = 'http://127.0.0.1:4173/demo.html'
if (-not (Test-DemoPage $demoUrl)) {
  $oldPort = $env:BKE_PREVIEW_PORT
  try {
    $env:BKE_PREVIEW_PORT = '4173'
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $siteRoot -WindowStyle Hidden -PassThru
  } finally { $env:BKE_PREVIEW_PORT = $oldPort }
  $ready = $false
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    if (Test-DemoPage $demoUrl) { $ready = $true; break }
    if ($serverProcess.HasExited) { break }
    Start-Sleep -Milliseconds 200
  }
  if (-not $ready) { throw 'The local preview could not start on port 4173. Close any other preview on that port and try again.' }
}
Write-Output $demoUrl
if (-not $NoOpen) { Start-Process $demoUrl }
