\
@echo off
echo Installing dependencies (may take a few minutes)...
npm install
echo Starting server...
start cmd /k "node server.js"
timeout /t 2 > nul
echo Opening browser...
start "" "http://localhost:3000"
echo To enable voice and recording, allow microphone access in your browser.
pause
