@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   포오랩 사내 공유 시스템 - 개발 서버 시작
echo   브라우저에서 http://localhost:3000 접속
echo   (끄려면 이 창에서 Ctrl+C)
echo ============================================
call npm run dev
pause
