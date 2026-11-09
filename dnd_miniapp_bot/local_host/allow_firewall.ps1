$ErrorActionPreference = 'Stop'
try {
    $name = 'DND Mini App Local 8000 LAN'
    $rule = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -RemoteAddress LocalSubnet -Profile Private,Public | Out-Null
    } else {
        Enable-NetFirewallRule -DisplayName $name
    }
    Write-Host 'Port 8000 is open for devices on your local network only.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Read-Host 'Press Enter to close'
