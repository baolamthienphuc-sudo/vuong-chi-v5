@echo off
chcp 65001 >nul
title UPDATE VUONG CHI - PUSH GITHUB
color 0A

cd /d "%~dp0"

echo ==========================================================
echo        VUONG CHI - CAP NHAT WEBSITE LEN GITHUB
echo ==========================================================
echo.
echo Thu muc dang chay:
echo %CD%
echo.

:: Kiem tra Git
where git >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay Git tren may.
    echo Hay cai Git for Windows truoc:
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

:: Khoi tao Git neu thu muc chua phai repository
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [INFO] Thu muc chua duoc khoi tao Git. Dang khoi tao...
    git init
    if errorlevel 1 goto :error

    git branch -M main

    echo [INFO] Dang ket noi voi GitHub...
    git remote add origin https://github.com/baolamthienphuc-sudo/vuong-chi-v5.git
    if errorlevel 1 goto :error
) else (
    :: Dam bao nhanh main
    git branch -M main >nul 2>nul

    :: Kiem tra remote origin
    git remote get-url origin >nul 2>nul
    if errorlevel 1 (
        git remote add origin https://github.com/baolamthienphuc-sudo/vuong-chi-v5.git
    ) else (
        git remote set-url origin https://github.com/baolamthienphuc-sudo/vuong-chi-v5.git
    )
)

echo.
echo [1/4] Dang kiem tra thay doi...
git add -A
if errorlevel 1 goto :error

git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo ==========================================================
    echo KHONG CO FILE NAO THAY DOI - KHONG CAN PUSH.
    echo ==========================================================
    echo.
    pause
    exit /b 0
)

echo.
set "commitmsg="
set /p "commitmsg=Nhap ghi chu cap nhat ^(Enter = Update website^): "
if "%commitmsg%"=="" set "commitmsg=Update website"

echo.
echo [2/4] Dang tao commit...
git commit -m "%commitmsg%"
if errorlevel 1 goto :error

echo.
echo [3/4] Dang dong bo voi GitHub...
git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo [CANH BAO] Khong pull/rebase duoc.
    echo Co the GitHub dang co thay doi khac hoac xung dot file.
    echo BAT se KHONG tu dong ghi de de tranh mat code.
    echo.
    echo Hay chup man hinh loi nay gui cho ChatGPT neu can.
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] Dang PUSH len GitHub...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo ==========================================================
echo             CAP NHAT GITHUB THANH CONG!
echo ==========================================================
echo.
echo Repo:
echo https://github.com/baolamthienphuc-sudo/vuong-chi-v5
echo.
echo Cloudflare se tu dong deploy neu repo da ket noi dung.
echo.
pause
exit /b 0

:error
echo.
echo ==========================================================
echo [LOI] CAP NHAT THAT BAI.
echo ==========================================================
echo.
echo Hay chup man hinh cua so nay gui cho ChatGPT.
echo.
pause
exit /b 1
