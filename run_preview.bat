@echo off
chcp 65001 >nul
pushd F:\CreateAI\ClawBuddy\workMain\TripSplit
node ci.js preview 2>&1
echo EXIT_CODE=%ERRORLEVEL%
popd
