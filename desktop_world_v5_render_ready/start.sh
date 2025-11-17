#!/bin/bash
echo Installing dependencies...
npm install
echo Starting server in background...
node server.js &
sleep 2
xdg-open "http://localhost:3000"
