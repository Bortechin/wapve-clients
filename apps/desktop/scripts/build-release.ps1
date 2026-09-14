$ErrorActionPreference = "Stop"

$desktopDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repositoryRoot = (Resolve-Path (Join-Path $desktopDirectory "..\..")).Path
$desktopPackage = Get-Content -Raw -LiteralPath (Join-Path $desktopDirectory "package.json") | ConvertFrom-Json
$releaseDirectory = Join-Path $repositoryRoot ".tmp\desktop-release\$($desktopPackage.version)"
$bundleDirectory = Join-Path $desktopDirectory "release"

Push-Location $repositoryRoot
try {
  & pnpm --filter @wapve/desktop dist:win
  if ($LASTEXITCODE -ne 0) {
    throw "Electron NSIS build failed with exit code $LASTEXITCODE."
  }

  $installer = Get-ChildItem -LiteralPath $bundleDirectory -Filter "*.exe" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if (-not $installer) {
    throw "NSIS installer was not found at $bundleDirectory."
  }

  New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
  $destination = Join-Path $releaseDirectory $installer.Name
  Copy-Item -LiteralPath $installer.FullName -Destination $destination -Force

  $stream = [System.IO.File]::OpenRead($destination)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
      $hash = ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    }
    finally {
      $sha256.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
  $manifest = "$hash  $($installer.Name)`n"
  Set-Content -LiteralPath (Join-Path $releaseDirectory "SHA256SUMS.txt") -Value $manifest -NoNewline -Encoding utf8

  Write-Host "Installer: $destination"
  Write-Host "SHA-256:  $hash"
}
finally {
  Pop-Location
}
