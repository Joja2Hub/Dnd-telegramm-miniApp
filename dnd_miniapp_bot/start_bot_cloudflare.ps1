$ErrorActionPreference = "Stop"

function Fail($text) {
    Write-Host ""
    Write-Host "ERROR: $text" -ForegroundColor Red
    Write-Host ""
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

function Get-PhysicalOutboundNetwork {
    try {
        $configs = Get-NetIPConfiguration -ErrorAction Stop | Where-Object {
            $_.NetAdapter.Status -eq "Up" -and
            $_.NetAdapter.HardwareInterface -eq $true -and
            $_.IPv4DefaultGateway -and
            $_.IPv4Address
        }
        foreach ($config in $configs) {
            $address = $config.IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress
            if ($address -and !$address.StartsWith("169.254.")) {
                return [pscustomobject]@{
                    Address = $address
                    Gateway = $config.IPv4DefaultGateway.NextHop
                    InterfaceIndex = $config.InterfaceIndex
                    InterfaceAlias = $config.InterfaceAlias
                }
            }
        }
    } catch {
        return $null
    }
    return $null
}

function Stop-CloudflaredInstance($process, $pidPath) {
    try {
        if ($process -and !$process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    if ($pidPath -and (Test-Path $pidPath)) {
        try {
            $pid = [int](Get-Content $pidPath -Raw).Trim()
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        } catch {}
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    }
}

function Add-CloudflareBypassRoutes($physicalNetwork) {
    $addedRoutes = @()
    if (!$physicalNetwork) {
        return $addedRoutes
    }

    foreach ($prefix in @("198.41.192.0/24", "198.41.200.0/24")) {
        try {
            $existingRoute = Get-NetRoute -DestinationPrefix $prefix -ErrorAction SilentlyContinue | Where-Object {
                $_.InterfaceIndex -eq $physicalNetwork.InterfaceIndex -and $_.NextHop -eq $physicalNetwork.Gateway
            } | Select-Object -First 1
            if (!$existingRoute) {
                New-NetRoute -DestinationPrefix $prefix `
                    -InterfaceIndex $physicalNetwork.InterfaceIndex `
                    -NextHop $physicalNetwork.Gateway `
                    -RouteMetric 1 -PolicyStore ActiveStore -ErrorAction Stop | Out-Null
                $addedRoutes += $prefix
            }
        } catch {
            Write-Host "Could not add bypass route ${prefix}: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    return $addedRoutes
}

function Remove-CloudflareBypassRoutes($physicalNetwork, $routes) {
    if (!$physicalNetwork -or !$routes) {
        return
    }

    foreach ($prefix in $routes) {
        try {
            Remove-NetRoute -DestinationPrefix $prefix `
                -InterfaceIndex $physicalNetwork.InterfaceIndex `
                -NextHop $physicalNetwork.Gateway `
                -Confirm:$false -ErrorAction SilentlyContinue
        } catch {}
    }
}

function Start-CloudflaredTunnel($strategy, $physicalNetwork, $logPath, $pidPath) {
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    if (Test-Path $logPath) {
        Remove-Item $logPath -Force -ErrorAction SilentlyContinue
    }

    $routes = @()
    if ($strategy.UseRoutes) {
        if ($physicalNetwork) {
            $routes = Add-CloudflareBypassRoutes $physicalNetwork
            Write-Host "Trying Cloudflare via physical route: $($physicalNetwork.InterfaceAlias)" -ForegroundColor Yellow
        } else {
            Write-Host "Physical network was not detected; skipping routed strategy." -ForegroundColor Yellow
            return [pscustomobject]@{ Success = $false; Url = $null; Process = $null; Routes = @(); Reason = "no physical network" }
        }
    }

    Write-Host ""
    Write-Host "Starting Cloudflare tunnel strategy: $($strategy.Name)" -ForegroundColor Cyan

    $tunnelCommand = "cloudflared tunnel --protocol $($strategy.Protocol)"
    if ($strategy.UseEdgeBind -and $physicalNetwork) {
        $tunnelCommand += " --edge-bind-address $($physicalNetwork.Address)"
    }
    $tunnelCommand += " --metrics 127.0.0.1:20241 --pidfile `"$pidPath`" --url http://localhost:8000"
    Write-Host $tunnelCommand -ForegroundColor DarkGray

    $cmdLine = "$tunnelCommand > `"$logPath`" 2>&1"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $cmdLine" -NoNewWindow -PassThru

    $tunnelUrl = $null
    $tunnelConnected = $false
    $reason = "timeout"

    for ($i = 0; $i -lt 45; $i++) {
        Start-Sleep -Seconds 1

        if (Test-Path $logPath) {
            $log = Get-Content $logPath -Raw -ErrorAction SilentlyContinue
            $match = [regex]::Match($log, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
            if ($match.Success) {
                $tunnelUrl = $match.Value.Trim()
            }
            if ($log -match "Registered tunnel connection") {
                $tunnelConnected = $true
                $reason = "connected"
                break
            }
            if ($log -match "precheck complete hard_fail=true") {
                $reason = "cloudflare transport blocked"
                break
            }
            if ($log -match "forbidden by its access permissions") {
                $reason = "windows blocked selected route"
                break
            }
        }

        if ($process.HasExited) {
            $reason = "cloudflared exited"
            break
        }
    }

    if ($tunnelUrl -and $tunnelConnected) {
        $tunnelReady = $false
        for ($i = 0; $i -lt 15; $i++) {
            try {
                $readyResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:20241/ready" -TimeoutSec 2
                if ($readyResponse.StatusCode -eq 200) {
                    $tunnelReady = $true
                    break
                }
            } catch {}
            Start-Sleep -Seconds 1
        }

        if ($tunnelReady) {
            return [pscustomobject]@{ Success = $true; Url = $tunnelUrl; Process = $process; Routes = $routes; Reason = "ready" }
        }
        $reason = "connector not ready"
    }

    Write-Host "Strategy failed: $($strategy.Name) ($reason)" -ForegroundColor Yellow
    if (Test-Path $logPath) {
        Get-Content $logPath -Tail 25
    }
    Stop-CloudflaredInstance $process $pidPath
    Remove-CloudflareBypassRoutes $physicalNetwork $routes
    return [pscustomobject]@{ Success = $false; Url = $tunnelUrl; Process = $null; Routes = @(); Reason = $reason }
}

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$ServerLogPath = Join-Path $ProjectDir "server_runtime.log"
$ShutdownFlagPath = Join-Path $ProjectDir "data\shutdown_requested.flag"
$CloudflaredPidPath = Join-Path $ProjectDir "data\cloudflared.pid"
$BotPidPath = Join-Path $ProjectDir "data\dnd_bot.pid"
if (Test-Path $ShutdownFlagPath) {
    Remove-Item $ShutdownFlagPath -Force
}
Remove-Item $CloudflaredPidPath -Force -ErrorAction SilentlyContinue

if (Test-Path $BotPidPath) {
    try {
        $oldBotPid = [int](Get-Content $BotPidPath -Raw).Trim()
        $oldBot = Get-CimInstance Win32_Process -Filter "ProcessId = $oldBotPid" -ErrorAction SilentlyContinue
        if ($oldBot -and $oldBot.Name -eq "python.exe" -and $oldBot.CommandLine -match [regex]::Escape($ProjectDir)) {
            Write-Host "Stopping old bot process PID $oldBotPid..." -ForegroundColor Yellow
            Stop-Process -Id $oldBotPid -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    Remove-Item $BotPidPath -Force -ErrorAction SilentlyContinue
}

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

$cfProcess = $null
$PhysicalNetwork = Get-PhysicalOutboundNetwork
$AddedBypassRoutes = @()

try {
Write-Host ""
Write-Host "Starting Cloudflare tunnel with adaptive VPN-safe strategies..." -ForegroundColor Cyan
if ($PhysicalNetwork) {
    Write-Host "Physical network detected: $($PhysicalNetwork.InterfaceAlias), $($PhysicalNetwork.Address), gateway $($PhysicalNetwork.Gateway)" -ForegroundColor DarkGray
} else {
    Write-Host "Physical network was not detected. The launcher will use normal system routing only." -ForegroundColor Yellow
}

$TunnelStrategies = @(
    [pscustomobject]@{ Name = "system-http2"; Protocol = "http2"; UseRoutes = $false; UseEdgeBind = $false },
    [pscustomobject]@{ Name = "system-quic"; Protocol = "quic"; UseRoutes = $false; UseEdgeBind = $false },
    [pscustomobject]@{ Name = "physical-route-http2"; Protocol = "http2"; UseRoutes = $true; UseEdgeBind = $false },
    [pscustomobject]@{ Name = "physical-route-quic"; Protocol = "quic"; UseRoutes = $true; UseEdgeBind = $false },
    [pscustomobject]@{ Name = "physical-bind-http2-last-resort"; Protocol = "http2"; UseRoutes = $true; UseEdgeBind = $true }
)

$TunnelResult = $null
foreach ($strategy in $TunnelStrategies) {
    $TunnelResult = Start-CloudflaredTunnel $strategy $PhysicalNetwork $LogPath $CloudflaredPidPath
    if ($TunnelResult.Success) {
        break
    }
}

if (!$TunnelResult -or !$TunnelResult.Success) {
    Write-Host ""
    Write-Host "Cloudflare tunnel was not registered by any strategy." -ForegroundColor Red
    Write-Host "This is usually network/VPN/firewall-level: Cloudflare edge TCP/UDP 7844 is blocked or Windows VPN kill-switch blocks direct sockets." -ForegroundColor Yellow
    Write-Host "BASE_URL was not changed and the bot was not started." -ForegroundColor Yellow
    exit 75
}

$TunnelUrl = $TunnelResult.Url
$cfProcess = $TunnelResult.Process
$AddedBypassRoutes = $TunnelResult.Routes

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
$env:BASE_URL = $TunnelUrl

$WrittenBaseUrl = Get-EnvValue "BASE_URL"
if ($WrittenBaseUrl -ne $TunnelUrl) {
    Fail "BASE_URL verification failed after writing .env."
}

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

$PythonBaseUrl = (& $PythonExe -c "from app.config import get_settings; print(get_settings().base_url)" 2>$null | Select-Object -Last 1).Trim()
if ($PythonBaseUrl -ne $TunnelUrl) {
    Fail "Python BASE_URL verification failed. Cloudflare=$TunnelUrl, Python=$PythonBaseUrl"
}
Write-Host "URL chain verified: Cloudflare = .env = Python = $TunnelUrl" -ForegroundColor Green

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

$env:CLOUDFLARED_PID_PATH = $CloudflaredPidPath

try {
    # v6 fix:
    # Uvicorn writes INFO logs to stderr. PowerShell can treat native stderr as NativeCommandError.
    # Run through cmd.exe and merge stderr into stdout there, so INFO logs do not stop the launcher.
    $quotedPython = '"' + $PythonExe + '"'
    $serverCmd = "$quotedPython -u main.py 2>&1"
    & cmd.exe /d /c $serverCmd | Tee-Object -FilePath $ServerLogPath
    $serverExitCode = $LASTEXITCODE
    $expectedShutdown = Test-Path $ShutdownFlagPath
    if ($expectedShutdown) {
        Remove-Item $ShutdownFlagPath -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "main.py finished with exit code: $serverExitCode" -ForegroundColor Yellow

    if ($serverExitCode -ne 0 -and !$expectedShutdown) {
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

    if ($expectedShutdown) {
        Write-Host "Safe shutdown requested. Closing launcher..." -ForegroundColor Green
    } else {
        Write-Host "Unexpected stop detected. The launcher will restart everything automatically." -ForegroundColor Yellow
        exit 75
    }
} finally {
    Write-Host ""
    Write-Host "Stopping cloudflared..." -ForegroundColor Yellow
    try {
        if ($cfProcess -and !$cfProcess.HasExited) {
            Stop-Process -Id $cfProcess.Id -Force
        }
    } catch {}
}
} finally {
    if (Test-Path $CloudflaredPidPath) {
        try {
            $cloudflaredPid = [int](Get-Content $CloudflaredPidPath -Raw).Trim()
            Stop-Process -Id $cloudflaredPid -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    try {
        if ($cfProcess -and !$cfProcess.HasExited) {
            taskkill.exe /PID $cfProcess.Id /T /F 1>$null 2>$null
        }
    } catch {}
    Remove-Item $CloudflaredPidPath -Force -ErrorAction SilentlyContinue
    Remove-Item $BotPidPath -Force -ErrorAction SilentlyContinue

    if ($PhysicalNetwork) {
        foreach ($prefix in $AddedBypassRoutes) {
            Remove-NetRoute -DestinationPrefix $prefix `
                -InterfaceIndex $PhysicalNetwork.InterfaceIndex `
                -NextHop $PhysicalNetwork.Gateway `
                -Confirm:$false -ErrorAction SilentlyContinue
        }
    }
}
