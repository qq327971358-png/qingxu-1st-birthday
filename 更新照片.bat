@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在处理「宝宝照片」文件夹中的照片...
echo.
python tools\process_photos.py
echo.
echo 处理完成。如果页面已打开，请刷新浏览器查看。
pause
