@echo off
setlocal

set "RULE_NAME=DND Mini App Local 8000"
set "PS_CMD=if (-not (Get-NetFirewallRule -DisplayName '%RULE_NAME%' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName '%RULE_NAME%' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private,Public | Out-Null }; Write-Host 'Firewall rule is ready: %RULE_NAME%'; Write-Host 'Port 8000 is allowed for Private and Public networks.'; pause"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"%PS_CMD%\"'"

endlocal
