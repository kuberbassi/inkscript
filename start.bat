@echo off
echo Starting Handwriting Studio v3.0 (React + TypeScript + Direct Canvas 2D)...
if not exist "dist\index.html" (
  echo Building production bundle...
  call npm run build
)
node server.js
pause
