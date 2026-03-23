@echo off
:: startup-windows.cmd — Launch Project Claw + OpenClaw stack on Windows login
:: Registered as a Task Scheduler job by scripts/register-startup.ps1

set "BASH=C:\Program Files\Git\usr\bin\bash.exe"
set "SCRIPT=%~dp0start-local.sh"

:: Convert Windows path to Unix path for bash
:: %~dp0 gives us the script directory with trailing backslash
set "SCRIPT_UNIX=%SCRIPT:\=/%"

start "" /min "%BASH%" -l -c "bash '%SCRIPT_UNIX%' all"
