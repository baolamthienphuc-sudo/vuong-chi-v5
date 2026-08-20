@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo  VUONG CHI V7 - RECOVER UTF-8 + FONT + ROUTE
echo ============================================
echo.

if not exist ".git" (
  echo [LOI] Thu muc nay khong co .git.
  echo Hay giai nen goi V7 vao dung thu muc:
  echo F:\webnhap\vuong-chi-v5
  echo roi chay lai file nay.
  pause
  exit /b 1
)

if not exist "index.html" (
  echo [LOI] Khong tim thay index.html.
  pause
  exit /b 1
)

if not exist "assets\styles-v7.css" (
  echo [LOI] Khong tim thay assets\styles-v7.css
  pause
  exit /b 1
)

if not exist "assets\app-v7.js" (
  echo [LOI] Khong tim thay assets\app-v7.js
  pause
  exit /b 1
)

rem Backup the currently corrupted HTML files before recovery.
if not exist "_backup-before-v7" mkdir "_backup-before-v7"
copy /y "*.html" "_backup-before-v7\" >nul 2>&1

echo [1/3] Khoi phuc cac file HTML tu commit Git gan nhat...
for %%F in (*.html) do (
  git ls-files --error-unmatch "%%F" >nul 2>&1
  if not errorlevel 1 git restore -- "%%F"
)
if errorlevel 1 (
  echo [LOI] Git restore that bai.
  echo KHONG tiep tuc de tranh lam hong file.
  pause
  exit /b 1
)

echo [2/3] Cap nhat CSS/JS bang UTF-8 an toan...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$utf8 = New-Object System.Text.UTF8Encoding($false);" ^
  "$files = Get-ChildItem -Path . -Filter *.html -File;" ^
  "foreach($f in $files){" ^
  "  $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8);" ^
  "  $c = $c.Replace('assets/styles-v5.css','assets/styles-v7.css').Replace('assets/styles-v6.css','assets/styles-v7.css');" ^
  "  $c = $c.Replace('assets/app-v5.js','assets/app-v7.js').Replace('assets/app-v6.js','assets/app-v7.js');" ^
  "  [System.IO.File]::WriteAllText($f.FullName, $c, $utf8);" ^
  "}" ^
  "Write-Host ('Da cap nhat ' + $files.Count + ' file HTML bang UTF-8.');"
if errorlevel 1 (
  echo [LOI] Khong the cap nhat HTML.
  pause
  exit /b 1
)

echo [3/3] Kiem tra nhanh chu tieng Viet...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c=[System.IO.File]::ReadAllText((Resolve-Path 'index.html'),[System.Text.Encoding]::UTF8);" ^
  "if($c -match 'Vương Chí' -and $c -match 'Xây Dựng'){ Write-Host 'UTF-8: OK' -ForegroundColor Green; exit 0 } else { Write-Host 'CANH BAO: Khong tim thay chu tieng Viet mong doi.' -ForegroundColor Yellow; exit 2 }"
if errorlevel 2 (
  echo.
  echo [DUNG LAI] Khong git push. Hay gui anh man hinh cho ChatGPT.
  pause
  exit /b 2
)

echo.
echo ============================================
echo  HOAN TAT - UTF-8 DA DUOC KHOI PHUC

echo  CSS: assets\styles-v7.css
echo  JS : assets\app-v7.js
echo ============================================
echo.
echo Mo index.html va du-an.html de test local truoc khi git push.
echo Ban sao HTML truoc khi sua nam trong _backup-before-v7.
echo.
pause
