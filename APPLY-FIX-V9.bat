@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo  VUONG CHI V9 - HERO TITLE 2-LINE FIX
echo ============================================
echo.

if not exist "index.html" (
  echo [ERROR] Extract this patch into the project root:
  echo F:\webnhap\vuong-chi-v5
  pause
  exit /b 1
)

if not exist "assets\styles-v9.css" (
  echo [ERROR] Missing assets\styles-v9.css
  pause
  exit /b 1
)

echo Updating HTML references to styles-v9.css ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$utf8 = New-Object System.Text.UTF8Encoding($false);" ^
  "$files = Get-ChildItem -Path . -Filter *.html -File;" ^
  "foreach($f in $files){" ^
  "  $c=[System.IO.File]::ReadAllText($f.FullName,[System.Text.Encoding]::UTF8);" ^
  "  $c=[regex]::Replace($c,'assets/styles-v(?:5|6|7|8)\.css','assets/styles-v9.css');" ^
  "  [System.IO.File]::WriteAllText($f.FullName,$c,$utf8);" ^
  "}" ^
  "Write-Host ('Updated ' + $files.Count + ' HTML files.');"
if errorlevel 1 (
  echo [ERROR] Could not update HTML files.
  pause
  exit /b 1
)

echo.
echo DONE.
echo CSS: assets\styles-v9.css
echo JS was not changed.
echo Open index.html and test different browser widths.
pause
