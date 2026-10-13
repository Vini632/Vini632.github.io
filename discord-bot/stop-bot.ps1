$ErrorActionPreference = 'Stop'
$taskPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$taskPidFile = Join-Path $PSScriptRoot '.data\bot.pid'
if (-not (Test-Path -LiteralPath $taskPidFile)) { Write-Output 'Nenhum processo registrado.'; exit 0 }
$taskProcessId = [int](Get-Content -LiteralPath $taskPidFile -Raw)
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $taskProcessId" -ErrorAction SilentlyContinue
if ($taskProcess -and ($taskProcess.ExecutablePath -ne $taskPython -or $taskProcess.CommandLine -notmatch 'main\.py')) {
    throw 'O PID foi reutilizado por outro processo; não foi encerrado.'
}
if ($taskProcess) {
    $taskConfig = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.venv\pyvenv.cfg')
    $taskBaseLine = $taskConfig | Where-Object { $_ -match '^executable = ' } | Select-Object -First 1
    $taskBasePython = $taskBaseLine -replace '^executable = ', ''
    $taskChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $taskProcessId"
    foreach ($taskChild in $taskChildren) {
        if ($taskChild.ExecutablePath -eq $taskBasePython -and $taskChild.CommandLine -match 'main\.py') {
            Stop-Process -Id $taskChild.ProcessId -ErrorAction SilentlyContinue
        }
    }
    $taskStillRunning = Get-CimInstance Win32_Process -Filter "ProcessId = $taskProcessId" -ErrorAction SilentlyContinue
    if ($taskStillRunning -and $taskStillRunning.CreationDate -eq $taskProcess.CreationDate) { Stop-Process -Id $taskProcessId -ErrorAction SilentlyContinue }
}
Remove-Item -LiteralPath $taskPidFile
Write-Output 'Bot encerrado.'
