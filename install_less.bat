@echo off
chcp 65001 >nul
pushd F:\CreateAI\ClawBuddy\workMain\TripSplit
npm install miniprogram-ci@latest --save-dev
echo DONE_%ERRORLEVEL%
popd
