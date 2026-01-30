@echo off
chcp 65001 >nul
title MathReader - 数学学习助手 (Node.js)

echo ========================================
echo   MathReader - 数学学习助手
echo   使用 Node.js http-server
echo ========================================
echo.

REM 检查是否在正确的目录
if not exist "index.html" (
    echo 错误: 未找到 index.html，请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js
    echo 请安装 Node.js 或使用 Python 的 http.server
    pause
    exit /b 1
)

REM 检查 http-server 是否安装
where http-server >nul 2>&1
if %errorlevel% neq 0 (
    echo http-server 未安装，正在安装...
    npm install -g http-server
    if %errorlevel% neq 0 (
        echo 安装失败，请手动运行: npm install -g http-server
        pause
        exit /b 1
    )
)

REM 查找可用端口（从8080开始）
set PORT=8080
:CHECK_PORT
netstat -an | findstr ":%PORT%" >nul
if %errorlevel% equ 0 (
    echo 端口 %PORT% 已被占用，尝试下一个端口...
    set /a PORT+=1
    if %PORT% gtr 8100 (
        echo 错误: 无法找到可用端口（8080-8100都被占用）
        pause
        exit /b 1
    )
    goto CHECK_PORT
)

echo 找到可用端口: %PORT%
echo.
echo 正在启动服务器...
echo 服务器地址: http://localhost:%PORT%
echo.
echo 提示: 按 Ctrl+C 停止服务器
echo.

REM 等待一秒后打开浏览器
timeout /t 1 /nobreak >nul
start http://localhost:%PORT%

REM 启动服务器
http-server -p %PORT% --cors

pause
