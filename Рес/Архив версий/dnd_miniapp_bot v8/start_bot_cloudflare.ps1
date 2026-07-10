$ErrorActionPreference = "Stop"

function Fail($text) {
    Write-Host ""
    Write-Host "ERROR: $text" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

function Test-Python310($exe, $argsList) {
    try {
        & $exe @argsList -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Python-Version-Text($exe, $argsList) {
    try {
        $out = & $exe @argsList -c "import sys; print(str(sys.version_info.major)+'.'+str(sys.version_info.minor)+'.'+str(sys.version_info.micro))" 2>$null
        return ($out | Select-Object -First 1)
    } catch {
        return ""
    }
}

function Get-GoodPython {
    $candidates = @()

    if (Get-Command py -ErrorAction SilentlyContinue) {
        $candidates += @{ exe = "py"; args = @("-3.12"); label = "py -3.12" }
        $candidates += @{ exe = "py"; args = @("-3.11"); label = "py -3.11" }
        $candidates += @{ exe = "py"; args = @("-3.10"); label = "py -3.10" }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        $candidates += @{ exe = "python"; args = @(); label = "python" }
    }

    foreach ($c in $candidates) {
        if (Test-Python310 $c.exe $c.args) {
            $ver = Python-Version-Text $c.exe $c.args
            Write-Host "Selected Python: $($c.label) / $ver" -ForegroundColor Green
            return $c
        }
    }

    return $null
}

function Get-EnvValue($name) {
    if (!(Test-Path ".env")) { return "" }
    $line = Get-Content ".env" -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if (!$line) { return "" }
    return ($line -replace "^$name=", "").Trim()
}

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$ServerLogPath = Join-Path $ProjectDir "server_runtime.log"

Write-Host "Project dir: $ProjectDir" -ForegroundColor Cyan

if (!(Test-Path "main.py")) {
    Fail "main.py was not found. Put START_BOT_CLOUDFLARE.bat and start_bot_cloudflare.ps1 into the dnd_miniapp_bot folder."
}

if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Fail "cloudflared was not found. Install it first: winget install --id Cloudflare.cloudflared"
}

Get-Process cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Write-Host "Stopping old cloudflared PID $($_.Id)..." -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force
    } catch {}
}

$LogPath = Join-Path $ProjectDir "cloudflared_url.log"
if (Test-Path $LogPath) {
    Remove-Item $LogPath -Force
}

Write-Host ""
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "cloudflared tunnel --url http://localhost:8000" -ForegroundColor DarkGray

$cmdLine = "cloudflared tunnel --url http://localhost:8000 > `"$LogPath`" 2>&1"
$cfProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $cmdLine" -WindowStyle Minimized -PassThru

Write-Host "Waiting for https URL..." -ForegroundColor Cyan

$TunnelUrl = $null
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1

    if (Test-Path $LogPath) {
        $log = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue
        $match = [regex]::Match($log, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        if ($match.Success) {
            $TunnelUrl = $match.Value.Trim()
            break
        }
    }

    if ($cfProcess.HasExited) {
        break
    }
}

if (!$TunnelUrl) {
    Write-Host ""
    Write-Host "Could not get Cloudflare URL." -ForegroundColor Red
    Write-Host "cloudflared log:" -ForegroundColor Yellow
    if (Test-Path $LogPath) {
        Get-Content $LogPath
    }
    Fail "Check cloudflared and internet connection."
}

Write-Host ""
Write-Host "Cloudflare URL: $TunnelUrl" -ForegroundColor Green

if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host ".env was created from .env.example" -ForegroundColor Yellow
    } else {
        New-Item ".env" -ItemType File | Out-Null
        Write-Host ".env was created" -ForegroundColor Yellow
    }
}

$envPath = Join-Path $ProjectDir ".env"
$envText = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if ($null -eq $envText) {
    $envText = ""
}

if ($envText -match "(?m)^BASE_URL=") {
    $envText = [regex]::Replace($envText, "(?m)^BASE_URL=.*$", "BASE_URL=$TunnelUrl")
} else {
    if ($envText.Length -gt 0 -and !$envText.EndsWith("`n")) {
        $envText += "`r`n"
    }
    $envText += "BASE_URL=$TunnelUrl`r`n"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $envText, $utf8NoBom)

Write-Host ".env updated: BASE_URL=$TunnelUrl" -ForegroundColor Green

$botToken = Get-EnvValue "BOT_TOKEN"
if (!$botToken -or $botToken -eq "0" -or $botToken -match "token|your|paste") {
    Write-Host ""
    Write-Host "WARNING: BOT_TOKEN in .env looks empty or placeholder." -ForegroundColor Yellow
}

$PythonExe = Join-Path $ProjectDir ".venv\Scripts\python.exe"
$NeedCreateVenv = $true

if (Test-Path $PythonExe) {
    if (Test-Python310 $PythonExe @()) {
        $venvVer = Python-Version-Text $PythonExe @()
        Write-Host "Existing .venv Python is OK: $venvVer" -ForegroundColor Green
        $NeedCreateVenv = $false
    } else {
        $venvVer = Python-Version-Text $PythonExe @()
        Write-Host "Existing .venv uses old Python: $venvVer" -ForegroundColor Yellow
        Write-Host "Removing old .venv..." -ForegroundColor Yellow
        Remove-Item ".venv" -Recurse -Force
        $NeedCreateVenv = $true
    }
}

if ($NeedCreateVenv) {
    $goodPython = Get-GoodPython
    if (!$goodPython) {
        Fail "Python 3.10+ was not found. Install Python 3.11: winget install Python.Python.3.11"
    }

    Write-Host ""
    Write-Host "Creating .venv with $($goodPython.label)..." -ForegroundColor Cyan
    & $goodPython.exe @($goodPython.args) -m venv .venv

    if (!(Test-Path $PythonExe)) {
        Fail "Could not create .venv."
    }

    $newVer = Python-Version-Text $PythonExe @()
    Write-Host ".venv created with Python $newVer" -ForegroundColor Green
}

if (Test-Path "requirements.txt") {
    Write-Host ""
    Write-Host "Checking/installing requirements..." -ForegroundColor Cyan
    & $PythonExe -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Fail "pip install -r requirements.txt failed."
    }
}

if (Test-Path $ServerLogPath) {
    Remove-Item $ServerLogPath -Force
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "STARTING BOT SERVER NOW" -ForegroundColor Green
Write-Host "Command: $PythonExe -u main.py" -ForegroundColor Green
Write-Host "Mini App URL: $TunnelUrl" -ForegroundColor Green
Write-Host "Server log: $ServerLogPath" -ForegroundColor Green
Write-Host "Do not close this window while the bot is running." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

try {
    # v6 fix:
    # Uvicorn writes INFO logs to stderr. PowerShell can treat native stderr as NativeCommandError.
    # Run through cmd.exe and merge stderr into stdout there, so INFO logs do not stop the launcher.
    $quotedPython = '"' + $PythonExe + '"'
    $serverCmd = "$quotedPython -u main.py 2>&1"
    & cmd.exe /d /c $serverCmd | Tee-Object -FilePath $ServerLogPath
    $serverExitCode = $LASTEXITCODE

    Write-Host ""
    Write-Host "main.py finished with exit code: $serverExitCode" -ForegroundColor Yellow

    if ($serverExitCode -ne 0) {
        Write-Host ""
        Write-Host "Last server log lines:" -ForegroundColor Red
        if (Test-Path $ServerLogPath) {
            Get-Content $ServerLogPath -Tail 80
        } else {
            Write-Host "server_runtime.log was not created."
        }
        Write-Host ""
        Write-Host "Send me the text above or server_runtime.log." -ForegroundColor Yellow
    }

    Read-Host "Press Enter to close"
} finally {
    Write-Host ""
    Write-Host "Stopping cloudflared..." -ForegroundColor Yellow
    try {
        if ($cfProcess -and !$cfProcess.HasExited) {
            Stop-Process -Id $cfProcess.Id -Force
        }
    } catch {}
}
