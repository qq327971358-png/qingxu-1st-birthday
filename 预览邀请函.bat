@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地预览...
echo 预览地址：http://localhost:8001/
echo 关闭本窗口即可停止预览。
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8001/"
python -m http.server 8001
pause
