@echo off
setlocal

set "DND_FIREWALL_SCRIPT=%~dp0allow_firewall.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:DND_FIREWALL_SCRIPT+[char]34)"

endlocal
