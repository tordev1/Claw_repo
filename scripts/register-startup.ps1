# register-startup.ps1 — Register Project Claw as a Windows startup task
# Run once as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\register-startup.ps1
#
# To remove:
#   schtasks /delete /tn "ProjectClaw-Startup" /f

$TaskName   = "ProjectClaw-Startup"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$CmdFile    = Join-Path $ScriptDir "startup-windows.cmd"
$LogFile    = Join-Path $ScriptDir "..\logs\startup.log"

# Ensure logs dir exists
$LogDir = Join-Path $ScriptDir "..\logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

Write-Host "Registering Task Scheduler job: $TaskName"
Write-Host "Command: $CmdFile"

# Remove existing task if any
schtasks /delete /tn $TaskName /f 2>$null | Out-Null

# Create task: runs at logon for current user, minimized
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <Delay>PT10S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$CmdFile</Command>
      <WorkingDirectory>$(Split-Path -Parent $ScriptDir)</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$TmpXml = [System.IO.Path]::GetTempFileName() + ".xml"
[System.IO.File]::WriteAllText($TmpXml, $xml, [System.Text.Encoding]::Unicode)

schtasks /create /tn $TaskName /xml $TmpXml /f
Remove-Item $TmpXml -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: '$TaskName' will run automatically at next login." -ForegroundColor Green
    Write-Host "To run now: schtasks /run /tn `"$TaskName`""
    Write-Host "To remove:  schtasks /delete /tn `"$TaskName`" /f"
} else {
    Write-Host "FAILED to register task. Try running as Administrator." -ForegroundColor Red
}
