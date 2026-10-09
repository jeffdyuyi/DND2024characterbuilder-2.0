# PowerShell 本地预览启动脚本
[CmdletBinding()]
param (
    [ValidateSet('prod', 'dev', 'rebuild')]
    [string]$Mode = 'prod',
    [int]$Port = 3000,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot\..
$env:PORT = [string]$Port

function Get-PreviewUrl {
    $previewBasePath = ''
    if ($Mode -ne 'dev' -and (Test-Path 'out/.static-site.json')) {
        $previewBasePath = (Get-Content -Raw 'out/.static-site.json' | ConvertFrom-Json).basePath
    }
    return "http://localhost:$Port$previewBasePath/"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       D&D 2024 Character Builder 本地快速启动工具" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 Node.js 环境，请先安装 Node.js (推荐 v20 或更高版本)。"
    exit 1
}

# 2. 检查端口占用
$portOccupied = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portOccupied) {
    $occupiedPid = $portOccupied[0].OwningProcess
    Write-Warning "检测到端口 $Port 已被进程 PID: $occupiedPid 占用。"
    $answer = Read-Host "是否自动关闭占用端口的旧进程？(Y/N, 默认 Y)"
    if ([string]::IsNullOrWhiteSpace($answer) -or $answer -match '^[Yy]$') {
        Stop-Process -Id $occupiedPid -Force -ErrorAction SilentlyContinue
        Write-Host "[完成] 已终止旧进程 PID: $occupiedPid" -ForegroundColor Green
    }
}

# 3. 按照模式启动
if ($Mode -eq 'rebuild') {
    Write-Host "[1/2] 正在执行全量打包 (npm run build)..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "构建失败，请检查控制台错误信息。"
        exit 1
    }
    Write-Host "[2/2] 正在启动生产服务..." -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process (Get-PreviewUrl) }
    npm start
} elseif ($Mode -eq 'dev') {
    Write-Host "[*] 正在启动开发调试服务 (npm run dev)..." -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process (Get-PreviewUrl) }
    npm run dev
} else {
    # 默认 prod 快速启动
    if (-not (Test-Path "out/.static-site.json")) {
        Write-Host "[提示] 未检测到静态构建产物，正在执行初次构建..." -ForegroundColor Yellow
        npm run build
    }
    Write-Host "[*] 正在启动本地生产服务 (npm start)..." -ForegroundColor Green
    if (-not $NoBrowser) { Start-Process (Get-PreviewUrl) }
    npm start
}
