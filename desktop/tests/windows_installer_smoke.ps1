$ErrorActionPreference = 'Stop'
$installers = @(Get-ChildItem 'src-tauri/target/debug/bundle/nsis/*.exe')
if ($installers.Count -ne 1) { throw "Expected exactly one NSIS installer, found $($installers.Count)." }
$dir = Join-Path $env:RUNNER_TEMP 'farday-roshan-installer-smoke'
if (Test-Path $dir) { throw 'Smoke test installation directory already exists.' }
$appData = Join-Path $env:APPDATA 'af.fardayroshan.desktop'
if (Test-Path $appData) { throw 'Smoke test application data directory already exists.' }
New-Item -ItemType Directory -Path $appData | Out-Null
$sentinel = Join-Path $appData 'smoke-test.txt'
Set-Content -Path $sentinel -Value 'not a real database'
function Run-InstallerProcess([string]$path, [string]$arguments) {
  $process = Start-Process -FilePath $path -ArgumentList $arguments -PassThru
  if (-not $process.WaitForExit(120000)) {
    $process.Kill()
    throw "Installer process timed out: $path"
  }
  $process.Refresh()
  if ($process.ExitCode -ne 0) { throw "Installer process failed with exit code $($process.ExitCode): $path" }
}
Run-InstallerProcess $installers[0].FullName "/S /D=$dir"
$binary = Join-Path $dir 'farday-roshan-desktop.exe'
$uninstaller = Join-Path $dir 'uninstall.exe'
if (-not (Test-Path $binary) -or -not (Test-Path $uninstaller)) { throw 'Expected installed executable and uninstaller were not found.' }
# _?= avoids NSIS spawning an untracked temporary process; it must be the last argument.
Run-InstallerProcess $uninstaller "/S _?=$dir"
if (Test-Path $binary) { throw 'Uninstall did not remove the application executable.' }
if (-not (Test-Path $sentinel)) { throw 'Silent uninstall unexpectedly removed application data.' }
Remove-Item -Recurse -Force $appData
Write-Output 'Silent install and uninstall smoke test passed; application data sentinel was preserved.'
