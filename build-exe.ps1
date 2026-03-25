$outputDir = "E:\Project\zhibojuhe\release\直播平台账号聚合管理器"
$electronZip = "C:\Users\admin\AppData\Local\electron\Cache\9d52d289307a654855bb61f40a54e0b7898cd525432a5eed13c306a897e673ef\electron-v28.3.3-win32-x64.zip"

Write-Host "Stopping running app..."
Get-Process -Name "直播平台账号聚合管理器" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Removing old output directory..."
if (Test-Path $outputDir) { 
    Remove-Item -Recurse -Force $outputDir -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Building Vue app..."
npx vite build

Write-Host "Extracting Electron..."
Expand-Archive -Path $electronZip -DestinationPath $outputDir -Force

Write-Host "Copying app files..."
$appDir = "$outputDir\resources\app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item -Recurse -Force "E:\Project\zhibojuhe\dist\*" $appDir
Copy-Item -Recurse -Force "E:\Project\zhibojuhe\dist-electron\*" $appDir

Write-Host "Copying build folder for icons..."
Copy-Item -Recurse -Force "E:\Project\zhibojuhe\build" "$outputDir\build" -ErrorAction SilentlyContinue

Write-Host "Creating package.json..."
@'
{
  "name": "live-stream-account-manager",
  "version": "1.0.0",
  "main": "main.js"
}
'@ | Out-File -FilePath "$appDir\package.json" -Encoding utf8

Write-Host "Renaming executable..."
$exePath = "$outputDir\electron.exe"
$newExePath = "$outputDir\直播平台账号聚合管理器.exe"
if (Test-Path $newExePath) { Remove-Item -Force $newExePath }
Rename-Item -Path $exePath -NewName "直播平台账号聚合管理器.exe" -Force

Write-Host "Build complete! Output: $outputDir"
