@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo  VUONG CHI V8 - SHARPER FONT PATCH
echo ============================================
echo.

if not exist "index.html" (
  echo [LOI] Hay giai nen goi V8 vao dung thu muc:
  echo F:\webnhap\vuong-chi-v5
  pause
  exit /b 1
)
if not exist "assets\styles-v8.css" (
  echo [LOI] Khong tim thay assets\styles-v8.css
  pause
  exit /b 1
)

if not exist "_backup-before-v8" mkdir "_backup-before-v8"
copy /y "*.html" "_backup-before-v8\" >nul 2>&1

echo [1/2] Doi CSS sang styles-v8.css bang UTF-8 an toan...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$utf8 = New-Object System.Text.UTF8Encoding($false);" ^
  "$files = Get-ChildItem -Path . -Filter *.html -File;" ^
  "foreach($f in $files){" ^
  "  $c=[System.IO.File]::ReadAllText($f.FullName,[System.Text.Encoding]::UTF8);" ^
  "  $c=$c.Replace('assets/styles-v5.css','assets/styles-v8.css').Replace('assets/styles-v6.css','assets/styles-v8.css').Replace('assets/styles-v7.css','assets/styles-v8.css');" ^
  "  [System.IO.File]::WriteAllText($f.FullName,$c,$utf8);" ^
  "}" ^
  "Write-Host ('Da cap nhat ' + $files.Count + ' file HTML.');"
if errorlevel 1 (
  echo [LOI] Khong the cap nhat HTML.
  pause
  exit /b 1
)

echo [2/2] Kiem tra UTF-8...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c=[System.IO.File]::ReadAllText((Resolve-Path 'index.html'),[System.Text.Encoding]::UTF8);" ^
  "if($c -match 'Vương Chí' -and $c -match 'Xây Dựng'){Write-Host 'UTF-8: OK' -ForegroundColor Green; exit 0}else{Write-Host 'UTF-8: LOI' -ForegroundColor Red; exit 2}"
if errorlevel 2 (
  echo [DUNG LAI] Khong git push.
  pause
  exit /b 2
)

echo.
echo HOAN TAT.
echo CSS moi: assets\styles-v8.css
echo JS van giu app-v7.js - khong dong vao logic Cong trinh.
echo.
echo Mo index.html de test local, sau do git add / commit / push.
pause
