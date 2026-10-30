@echo off
cd /d "%~dp0"
echo SECOND LIFE demo starting at http://localhost:8000
start "" http://localhost:8000
py -3 -m http.server 8000 --directory site || python -m http.server 8000 --directory site
pause
