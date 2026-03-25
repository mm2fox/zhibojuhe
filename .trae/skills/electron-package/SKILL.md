---
name: "electron-package"
description: "Packages Electron+Vue app to exe using cached Electron. Invoke when user wants to build/package exe or asks about electron packaging."
---

# Electron Package Skill

This skill packages an Electron + Vue project into a standalone Windows executable using locally cached Electron, avoiding additional downloads.

## When to Use

- User wants to package/build the Electron app into an exe
- User asks about electron-builder packaging issues
- User wants to create a distributable version of the app

## Prerequisites

1. Project must have:
   - `vite.config.ts` configured for Electron
   - `electron/` folder with main process code
   - `build/` folder with icon files (optional)
   - Electron cached at: `%LOCALAPPDATA%\electron\Cache\`

2. Required npm scripts in `package.json`:
   ```json
   {
     "scripts": {
       "package": "powershell -ExecutionPolicy Bypass -File ./build-exe.ps1"
     }
   }
   ```

## Packaging Steps

### Step 1: Stop Running Processes

Stop any running instances of the app to avoid file lock issues:

```powershell
Get-Process -Name "直播平台账号聚合管理器" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Step 2: Build Vue App

Build the Vue frontend and Electron main process:

```powershell
npx vite build
```

This generates:
- `dist/` - Vue frontend files
- `dist-electron/main.js` - Electron main process
- `dist-electron/preload.js` - Preload script

### Step 3: Extract Electron

Extract cached Electron to output directory:

```powershell
$electronZip = "C:\Users\admin\AppData\Local\electron\Cache\<hash>\electron-v<version>-win32-x64.zip"
$outputDir = "E:\Project\zhibojuhe\release\直播平台账号聚合管理器"
Expand-Archive -Path $electronZip -DestinationPath $outputDir -Force
```

### Step 4: Copy App Files

Copy built files to `resources/app`:

```powershell
$appDir = "$outputDir\resources\app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item -Recurse -Force "dist\*" $appDir
Copy-Item -Recurse -Force "dist-electron\*" $appDir
Copy-Item -Recurse -Force "build" "$outputDir\build" -ErrorAction SilentlyContinue
```

### Step 5: Create package.json

Create a minimal `package.json` in `resources/app`:

```json
{
  "name": "live-stream-account-manager",
  "version": "1.0.0",
  "main": "main.js"
}
```

### Step 6: Rename Executable

Rename `electron.exe` to the app name:

```powershell
Rename-Item -Path "$outputDir\electron.exe" -NewName "直播平台账号聚合管理器.exe" -Force
```

## Important Notes

1. **Path Configuration**: Ensure `main.ts` uses correct paths for production:
   ```typescript
   // Correct - works in both dev and production
   mainWindow.loadFile(join(__dirname, 'index.html'))
   
   // Wrong - only works in dev
   mainWindow.loadFile(join(__dirname, '../dist/index.html'))
   ```

2. **Icon Path**: For tray icons, use relative path from `__dirname`:
   ```typescript
   const iconPath = join(__dirname, '../../build/icon.ico')
   ```

3. **Electron Cache**: Find the correct Electron zip path:
   ```powershell
   Get-ChildItem "$env:LOCALAPPDATA\electron\Cache\*\electron-*.zip" -Recurse
   ```

## Complete build-exe.ps1 Script

```powershell
$outputDir = "E:\Project\zhibojuhe\release\直播平台账号聚合管理器"
$electronZip = "C:\Users\admin\AppData\Local\electron\Cache\<hash>\electron-v<version>-win32-x64.zip"

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
Copy-Item -Recurse -Force "dist\*" $appDir
Copy-Item -Recurse -Force "dist-electron\*" $appDir

Write-Host "Copying build folder for icons..."
Copy-Item -Recurse -Force "build" "$outputDir\build" -ErrorAction SilentlyContinue

Write-Host "Creating package.json..."
@'
{
  "name": "live-stream-account-manager",
  "version": "1.0.0",
  "main": "main.js"
}
'@ | Out-File -FilePath "$appDir\package.json" -Encoding utf8

Write-Host "Renaming executable..."
Rename-Item -Path "$outputDir\electron.exe" -NewName "直播平台账号聚合管理器.exe" -Force

Write-Host "Build complete! Output: $outputDir"
```

## Troubleshooting

### White Screen Issue
- Check `main.ts` uses `join(__dirname, 'index.html')` not `../dist/index.html`
- Verify `package.json` has `"main": "main.js"`

### File Lock Error
- Ensure app is fully closed before packaging
- Use `Stop-Process -Force` to kill lingering processes

### Icon Not Showing
- Copy `build/` folder to output directory
- Check icon path in `main.ts` is relative to `__dirname`
