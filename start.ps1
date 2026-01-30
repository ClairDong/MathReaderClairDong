# MathReader 启动脚本 (PowerShell)
# 自动启动本地服务器并打开浏览器

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MathReader - 数学学习助手" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "index.html")) {
    Write-Host "错误: 未找到 index.html，请确保在项目根目录运行此脚本" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

# 检查 Python 是否安装
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "错误: 未找到 Python" -ForegroundColor Red
    Write-Host "请安装 Python 3.x 或使用 Node.js 的 http-server" -ForegroundColor Yellow
    Read-Host "按 Enter 键退出"
    exit 1
}

# 查找可用端口（从8080开始）
$port = 8080
$maxPort = 8100
$portFound = $false

while (-not $portFound -and $port -le $maxPort) {
    $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $portInUse) {
        $portFound = $true
    } else {
        Write-Host "端口 $port 已被占用，尝试下一个端口..." -ForegroundColor Yellow
        $port++
    }
}

if (-not $portFound) {
    Write-Host "错误: 无法找到可用端口（8080-8100都被占用）" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host "找到可用端口: $port" -ForegroundColor Green

Write-Host "正在启动服务器..." -ForegroundColor Green
Write-Host "服务器地址: http://localhost:$port" -ForegroundColor Green
Write-Host ""
Write-Host "提示: 按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 等待一秒后打开浏览器
Start-Sleep -Seconds 1
Start-Process "http://localhost:$port"

# 启动服务器
try {
    & $pythonCmd -m http.server $port
} catch {
    Write-Host ""
    Write-Host "服务器启动失败: $_" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
}
