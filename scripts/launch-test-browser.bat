@echo off
REM Bias Noticer test browser — runs outside agent process trees
set "BRAVE=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
set "PROFILE=C:\Users\Knock\bias-noticer\.browser-profile-stable"
set "EXT=C:\Users\Knock\bias-noticer\.output\chrome-mv3"
if not exist "%PROFILE%" mkdir "%PROFILE%"
start "" "%BRAVE%" --user-data-dir="%PROFILE%" --load-extension="%EXT%" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --start-maximized --new-window chrome://extensions/ https://www.bbc.com/news
