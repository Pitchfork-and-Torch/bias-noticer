@echo off
REM Bias Noticer test browser - isolated profile (NOT your daily Brave)
setlocal EnableExtensions
set "BRAVE=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "PROFILE=%USERPROFILE%\.local\bias-noticer-profiles\.browser-profile-stable"
set "EXT=%USERPROFILE%\.local\bias-noticer-extension\chrome-mv3"
set "START_URL=https://www.bbc.com/news"

if not exist "%PROFILE%" mkdir "%PROFILE%"
if not exist "%EXT%\manifest.json" (
  echo ERROR: Extension missing at %EXT%
  echo From repo: npm run build then copy .output\chrome-mv3\* there
  pause
  exit /b 1
)

set "BROWSER="
if exist "%BRAVE%" set "BROWSER=%BRAVE%"
if not defined BROWSER if exist "%CHROME%" set "BROWSER=%CHROME%"
if not defined BROWSER (
  echo No Brave or Chrome found.
  pause
  exit /b 1
)

REM Clear crash/session restore so the window is not a ghost Extensions tab
if exist "%PROFILE%\Default\Sessions" rd /s /q "%PROFILE%\Default\Sessions" 2>nul
if exist "%PROFILE%\Default\Session Storage" rd /s /q "%PROFILE%\Default\Session Storage" 2>nul
del /f /q "%PROFILE%\SingletonLock" 2>nul
del /f /q "%PROFILE%\lockfile" 2>nul

echo.
echo === Bias Noticer test browser ===
echo Profile: %PROFILE%
echo Ext:     %EXT%
echo URL:     %START_URL%
echo.
echo The console may close; Brave should STAY open on BBC News.
echo Alt+Tab if you do not see it. Look for "BBC" or "Bias Noticer".
echo.

start "Bias Noticer Test" "%BROWSER%" ^
  --user-data-dir="%PROFILE%" ^
  --load-extension="%EXT%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-session-crashed-bubble ^
  --disable-restore-session-state ^
  --start-maximized ^
  --new-window ^
  "%START_URL%"

timeout /t 3 /nobreak >nul
echo If Brave closed immediately, run launch-test-browser.ps1 for diagnostics.
endlocal
