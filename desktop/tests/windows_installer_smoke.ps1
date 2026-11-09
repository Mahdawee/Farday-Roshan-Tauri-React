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
# Launch the actual Tauri binary and check the migrated SQLite file. This does
# not exercise webview interaction, native dialogs, or accounting workflows.
$app = Start-Process -FilePath $binary -PassThru
try {
  $db = Join-Path $appData 'farday-roshan.sqlite3'
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $ready = $false
  while ([DateTime]::UtcNow -lt $deadline) {
    $app.Refresh()
    if ($app.HasExited) { throw "Tauri process exited during startup with code $($app.ExitCode)." }
    if (Test-Path $db) {
      python -c "import sqlite3,sys,pathlib; c=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True); assert c.execute('select count(*) from _sqlx_migrations where success=1').fetchone()[0]==10; assert c.execute('pragma integrity_check').fetchone()[0]=='ok'; c.close()" $db 2>$null
      if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Tauri startup did not create a valid migrated SQLite database within 60 seconds.' }
  Start-Sleep -Seconds 2
  $app.Refresh()
  if ($app.HasExited) { throw "Tauri process exited immediately after database startup with code $($app.ExitCode)." }
} finally {
  $app.Refresh()
  if (-not $app.HasExited) { $app.Kill(); $app.WaitForExit() }
}
# _?= avoids NSIS spawning an untracked temporary process; it must be the last argument.
Run-InstallerProcess $uninstaller "/S _?=$dir"
if (Test-Path $binary) { throw 'Uninstall did not remove the application executable.' }
if (-not (Test-Path $sentinel) -or -not (Test-Path $db)) { throw 'Silent uninstall unexpectedly removed application data.' }
Remove-Item -Recurse -Force $appData
Write-Output 'Silent install, Tauri startup and SQLite migration, and silent uninstall smoke tests passed; application data was preserved.'
