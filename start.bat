@echo off
REM ===========================================================================
REM  استارت سریع سیستم فردای روشن — ویندوز
REM  این فایل را دوبار کلیک کنید (یا در ترمینال:  start.bat)
REM ===========================================================================
setlocal
cd /d "%~dp0"
set PORT=8080
if not "%1"=="" set PORT=%1

echo ==================================================
echo    سیستم مدیریت فردای روشن - استارت سرور محلی
echo ==================================================

REM ---------- ۱) پیدا کردن PHP ----------
set PHP=php
where php >nul 2>nul
if errorlevel 1 (
  if exist "C:\xampp\php\php.exe"      set PHP=C:\xampp\php\php.exe
  if exist "C:\laragon\bin\php"       for /d %%d in ("C:\laragon\bin\php\*") do set PHP=%%d\php.exe
  if exist "C:\wamp64\bin\php"        for /d %%d in ("C:\wamp64\bin\php\*") do set PHP=%%d\php.exe
)

"%PHP%" -v >nul 2>nul
if errorlevel 1 (
  echo [X] PHP پیدا نشد یا در PATH نیست.
  echo     راه حل: XAMPP یا Laragon نصب کنید، یا مسیر php.exe را به PATH اضافه کنید.
  echo     مثال:  set PATH=C:\xampp\php;%PATH%
  pause
  exit /b 1
)

echo [ok] PHP:
"%PHP%" -v | findstr /i "PHP"

echo --------------------------------------------------
echo [i]  آدرس سیستم:      http://localhost:%PORT%/
echo [i]  نصب (بار اول):   http://localhost:%PORT%/install.php
echo [i]  بررسی سلامت:     http://localhost:%PORT%/doctor.php
echo --------------------------------------------------
echo   . اگر MySQL را در XAMPP/Laragon استارت نکرده اید، اول آن را استارت کنید.
echo   . اگر داخل VS Code / Codespaces هستید:  تب PORTS  -^>  Forward a Port  -^>  %PORT%
echo   . برای خاموش کردن، این پنجره را ببندید (یا Ctrl + C).
echo.

"%PHP%" -S 0.0.0.0:%PORT% -t .
pause
