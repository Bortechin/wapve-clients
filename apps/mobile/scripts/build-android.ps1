param(
  [ValidateSet('debug', 'release')][string]$Variant = 'debug',
  [ValidateSet('apk', 'aab')][string]$Artifact = 'apk',
  [ValidateSet('arm64-v8a', 'x86_64', 'arm64-v8a,x86_64')][string]$Architectures = 'arm64-v8a',
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($Artifact -eq 'aab' -and $Variant -ne 'release') { throw 'AAB requires a release build.' }
if ($Artifact -eq 'aab' -and $Install) { throw 'Install an APK, not an AAB.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 21.' }
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { throw 'Set ANDROID_HOME to your Android SDK.' }
if ($Variant -eq 'release') {
  foreach ($name in @('WAPVE_RELEASE_STORE_FILE','WAPVE_RELEASE_STORE_PASSWORD','WAPVE_RELEASE_KEY_ALIAS','WAPVE_RELEASE_KEY_PASSWORD')) {
    if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Set $name using your own signing credentials." }
  }
}
$env:APP_VARIANT = if ($Variant -eq 'debug') { 'development' } else { 'production' }
$env:NODE_ENV = if ($Variant -eq 'debug') { 'development' } else { 'production' }
# React Native CMake object paths exceed Windows' limit when pnpm's virtual
# store is nested under this checkout. Reinstall into a short, repo-independent
# path only for this build; C:\w is disposable and never part of the repository.
$workletsLink = Join-Path $mobileRoot 'node_modules\react-native-worklets'
if (Test-Path -LiteralPath $workletsLink) {
  $target = [string](Get-Item -LiteralPath $workletsLink).Target
  if ($target -and $target.Length -gt 90) {
    Push-Location (Resolve-Path (Join-Path $mobileRoot '..\..')).Path
    try {
      & pnpm install --force --frozen-lockfile --ignore-scripts --virtual-store-dir C:\w
      if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the short pnpm virtual store.' }
    } finally { Pop-Location }
  }
}
$debugStore = Join-Path $mobileRoot 'android\app\debug.keystore'
if ($Variant -eq 'debug' -and -not (Test-Path -LiteralPath $debugStore)) {
  & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -keystore $debugStore -storepass android -alias androiddebugkey -keypass android -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
  if ($LASTEXITCODE -ne 0) { throw 'Could not generate a local debug key.' }
}
Push-Location (Join-Path $mobileRoot 'android')
try {
  $task = if ($Variant -eq 'debug') { 'assembleDebug' } elseif ($Artifact -eq 'aab') { 'bundleRelease' } else { 'assembleRelease' }
  & .\gradlew.bat $task "-PreactNativeArchitectures=$Architectures" --no-daemon --no-parallel --max-workers=2
  if ($LASTEXITCODE -ne 0) { throw "Gradle $task failed." }
  if ($Install) {
    $apkPath = Join-Path $mobileRoot "android\app\build\outputs\apk\$Variant\app-$Variant.apk"
    & adb install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'ADB installation failed.' }
  }
} finally { Pop-Location }
