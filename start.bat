@echo off
echo =========================================
echo       铁腕 - 智能任务管理工具启动脚本
echo =========================================
echo.

:: 检查是否安装了 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js。
    echo 请先前往 https://nodejs.org/ 下载并安装 Node.js。
    echo.
    pause
    exit /b 1
)

:: 检查依赖并安装（如果没有 node_modules）
if not exist "node_modules" (
    echo [状态] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络或 npm 配置。
        pause
        exit /b 1
    )
    echo [状态] 依赖安装完成！
    echo.
)

:: 启动开发服务器
echo [状态] 正在启动本地服务...
echo [提示] 服务启动后，浏览器将自动打开 http://127.0.0.1:8080/login.html
echo.
call npm run dev

pause
