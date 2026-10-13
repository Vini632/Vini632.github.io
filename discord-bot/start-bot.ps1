param([switch]$Background)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskPython = Join-Path $taskRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    throw 'Instale o ambiente conforme README.md antes de iniciar.'
}
if ($Background) {
    $taskData = Join-Path $taskRoot '.data'
    New-Item -ItemType Directory -Path $taskData -Force | Out-Null
    $taskPidFile = Join-Path $taskData 'bot.pid'
    if (Test-Path -LiteralPath $taskPidFile) {
        $taskExistingId = [int](Get-Content -LiteralPath $taskPidFile -Raw)
        $taskExisting = Get-CimInstance Win32_Process -Filter "ProcessId = $taskExistingId" -ErrorAction SilentlyContinue
        if ($taskExisting -and $taskExisting.ExecutablePath -eq $taskPython -and $taskExisting.CommandLine -match 'main\.py') {
            Write-Output 'O bot já está rodando neste ambiente.'
            exit 0
        }
    }
    $taskMain = Join-Path $taskRoot 'main.py'
    $taskProcess = Start-Process -FilePath $taskPython -ArgumentList ('"' + $taskMain + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $taskData 'bot-out.log') -RedirectStandardError (Join-Path $taskData 'bot-error.log') -PassThru
    Set-Content -LiteralPath $taskPidFile -Value $taskProcess.Id -Encoding ascii
    Write-Output "Processo do bot iniciado: $($taskProcess.Id). Logs em discord-bot\.data."
} else {
    & $taskPython (Join-Path $taskRoot 'main.py')
    exit $LASTEXITCODE
}
