param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "status", "restart")]
  [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot

$pgCtlPath = "C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe"
$dataDir = Join-Path $workspaceRoot "_local_pg_lumina/data"
$logFile = Join-Path $workspaceRoot "_local_pg_lumina/postgres.log"
$port = 5433

function Test-ClusterListener {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $listener
}

function Remove-StalePidFile {
  $pidFile = Join-Path $dataDir "postmaster.pid"
  if (-not (Test-Path $pidFile)) {
    return
  }

  $pidLine = (Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue).Trim()
  if (-not $pidLine) {
    Remove-Item $pidFile -Force
    Write-Host "Removed empty postmaster.pid"
    return
  }

  $running = Get-Process -Id ([int]$pidLine) -ErrorAction SilentlyContinue
  if (-not $running) {
    Remove-Item $pidFile -Force
    Write-Host "Removed stale postmaster.pid (PID $pidLine not running)"
  }
}

if (-not (Test-Path $pgCtlPath)) {
  Write-Error "pg_ctl not found at $pgCtlPath"
}

if (-not (Test-Path $dataDir)) {
  Write-Error "Local cluster data directory not found at $dataDir"
}

switch ($Action) {
  "status" {
    & $pgCtlPath -D $dataDir status
    if (Test-ClusterListener) {
      Write-Host "Port $port listener: UP"
    } else {
      Write-Host "Port $port listener: DOWN"
    }
  }

  "stop" {
    & $pgCtlPath -D $dataDir stop
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Local PostgreSQL cluster stopped"
    }
  }

  "restart" {
    & $pgCtlPath -D $dataDir stop
    Remove-StalePidFile
    & $pgCtlPath -D $dataDir -l $logFile -o "-p $port" -w start
    if ($LASTEXITCODE -eq 0 -and (Test-ClusterListener)) {
      Write-Host "Local PostgreSQL cluster restarted on port $port"
    }
  }

  Default {
    if (Test-ClusterListener) {
      Write-Host "Local PostgreSQL cluster is already listening on port $port"
      exit 0
    }

    Remove-StalePidFile
    & $pgCtlPath -D $dataDir -l $logFile -o "-p $port" -w start
    if ($LASTEXITCODE -eq 0 -and (Test-ClusterListener)) {
      Write-Host "Local PostgreSQL cluster started on port $port"
    }
  }
}