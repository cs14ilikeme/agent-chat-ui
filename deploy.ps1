# GA-Go UI 部署与升级脚本
# 用法: .\deploy.ps1 [-Upgrade] [-Port 3000] [-BackupDir .\backups]

param(
    [switch]$Upgrade,
    [int]$Port = 3000,
    [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "=== GA-Go UI Deploy ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Port: $Port"

# --- Step 1: Backup (if upgrade) ---
if ($Upgrade) {
    Write-Host "`n[1/5] Backing up current build..." -ForegroundColor Yellow
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = Join-Path $BackupDir "backup_$ts"
    if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
    if (Test-Path ".next") {
        Copy-Item -Recurse ".next" $backupPath
        Write-Host "  Backed up .next -> $backupPath"
    } else {
        Write-Host "  No .next to backup, skipping"
    }
} else {
    Write-Host "`n[1/5] Fresh deploy, no backup needed" -ForegroundColor Gray
}

# --- Step 2: Install dependencies ---
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Yellow
if (Test-Path "pnpm-lock.yaml") {
    npx pnpm install --frozen-lockfile 2>$null
    if ($LASTEXITCODE -ne 0) { npm install --legacy-peer-deps }
} elseif (Test-Path "package-lock.json") {
    npm ci
} else {
    npm install
}
Write-Host "  Dependencies installed"

# --- Step 3: Build ---
Write-Host "`n[3/5] Building production bundle..." -ForegroundColor Yellow
$env:NODE_ENV = "production"
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  BUILD FAILED!" -ForegroundColor Red
    if ($Upgrade -and (Test-Path $backupPath)) {
        Write-Host "  Rolling back..." -ForegroundColor Red
        Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
        Copy-Item -Recurse $backupPath ".next"
        Write-Host "  Rolled back to previous build"
    }
    exit 1
}
Write-Host "  Build succeeded"

# --- Step 4: Stop existing process ---
Write-Host "`n[4/5] Stopping existing GA-Go UI process..." -ForegroundColor Yellow
$existing = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try { (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue).LocalPort -contains $Port } catch { $false }
}
if ($existing) {
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  Stopped PID $($existing.Id)"
} else {
    Write-Host "  No existing process on port $Port"
}

# --- Step 5: Start ---
Write-Host "`n[5/5] Starting GA-Go UI on port $Port..." -ForegroundColor Yellow
$env:PORT = $Port
Start-Process -FilePath "npx" -ArgumentList "next","start","-p",$Port -WindowStyle Hidden
Start-Sleep -Seconds 3

# Verify
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 10
    if ($resp.StatusCode -eq 200) {
        Write-Host "`n=== DEPLOY SUCCESS ===" -ForegroundColor Green
        Write-Host "GA-Go UI running at http://localhost:$Port"
    } else {
        Write-Host "`n=== DEPLOY WARNING: HTTP $($resp.StatusCode) ===" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n=== DEPLOY WARNING: Could not verify ===" -ForegroundColor Yellow
    Write-Host "  Process started but HTTP check failed. Check manually."
}
