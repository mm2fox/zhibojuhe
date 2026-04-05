import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, session } from 'electron'
import { join } from 'path'
import { registerAccountIPC } from './ipc/account'
import { registerSettingsIPC } from './ipc/settings'
import { registerPlatformIPC } from './ipc/platform'
import { registerFollowIPC } from './ipc/follow'
import { registerDockerIPC } from './ipc/docker'
import { getSettings } from './store'
import Store from 'electron-store'

app.commandLine.appendSwitch('disable-features', 'WebRTC')
app.commandLine.appendSwitch('disable-webrtc')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

async function flushAllSessions() {
  const platforms = ['huya', 'douyin', 'douyu']
  for (const platform of platforms) {
    try {
      const partitionSession = session.fromPartition(`persist:${platform}`)
      await partitionSession.flushStorageData()
    } catch (error) {
      // ignore
    }
  }
}

async function restoreCookiesFromDatabase() {
  try {
    const { Database } = await import('./store/database')
    const db = Database.getInstance()
    const accounts = db.getAllAccounts()
    
    for (const account of accounts) {
      if (!account.cookies) continue
      
      const platform = account.platform
      const partitionSession = session.fromPartition(`persist:${platform}`)
      
      const existingCookies = await partitionSession.cookies.get({})
      
      if (existingCookies.length < 5) {
        const platformUrls: Record<string, string> = {
          huya: 'https://www.huya.com',
          douyin: 'https://www.douyin.com',
          douyu: 'https://www.douyu.com'
        }
        
        const domains: Record<string, string> = {
          huya: '.huya.com',
          douyin: '.douyin.com',
          douyu: '.douyu.com'
        }
        
        const url = platformUrls[platform]
        const domain = domains[platform]
        
        const cookiePairs = account.cookies.split(';').map(c => c.trim())
        
        for (const pair of cookiePairs) {
          if (!pair) continue
          const [name, ...valueParts] = pair.split('=')
          const value = valueParts.join('=')
          if (name && value) {
            try {
              await partitionSession.cookies.set({
                url,
                name: name.trim(),
                value: value.trim(),
                domain,
                path: '/'
              })
            } catch (err) {
              // ignore
            }
          }
        }
      }
    }
  } catch (error) {
    // ignore
  }
}

const dockerStore = new Store<{ docker: { tabs: any[], activeTabId: string | null } }>({
  name: 'docker',
  defaults: {
    docker: {
      tabs: [],
      activeTabId: null
    }
  }
})

function switchDockerTab(shift: boolean) {
  const docker = dockerStore.get('docker')
  const tabs = docker.tabs
  
  if (tabs.length === 0) return false
  
  const activeTabId = docker.activeTabId
  const currentIndex = tabs.findIndex((t: any) => t.id === activeTabId)
  
  let nextIndex: number
  if (shift) {
    nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1
  } else {
    nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1
  }
  
  const nextTab = tabs[nextIndex]
  if (nextTab) {
    docker.activeTabId = nextTab.id
    dockerStore.set('docker', docker)
    mainWindow?.webContents.send('docker:tab-switched', nextTab.id)
  }
  
  return true
}

function toggleMuteCurrentTab() {
  const docker = dockerStore.get('docker')
  const tabs = docker.tabs
  
  if (tabs.length === 0) return false
  
  const activeTabId = docker.activeTabId
  if (!activeTabId) return false
  
  const tab = tabs.find((t: any) => t.id === activeTabId)
  if (!tab) return false
  
  tab.muted = !tab.muted
  dockerStore.set('docker', docker)
  mainWindow?.webContents.send('docker:mute-toggled', activeTabId, tab.muted)
  
  return true
}

function closeCurrentTab() {
  const docker = dockerStore.get('docker')
  const tabs = docker.tabs
  
  if (tabs.length === 0) return false
  
  const activeTabId = docker.activeTabId
  if (!activeTabId) return false
  
  const currentIndex = tabs.findIndex((t: any) => t.id === activeTabId)
  if (currentIndex < 0) return false
  
  tabs.splice(currentIndex, 1)
  
  if (tabs.length > 0) {
    const newIndex = Math.min(currentIndex, tabs.length - 1)
    docker.activeTabId = tabs[newIndex].id
  } else {
    docker.activeTabId = null
  }
  
  dockerStore.set('docker', docker)
  mainWindow?.webContents.send('docker:tab-closed', activeTabId)
  
  return true
}

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function getResourcePath(...paths: string[]): string {
  if (VITE_DEV_SERVER_URL) {
    return join(__dirname, ...paths)
  }
  return join(__dirname, ...paths)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      webSecurity: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, 'index.html'))
  }

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }
    const settings = getSettings()
    if (settings.minimizeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    
    if (input.key === 'Tab' && !input.alt) {
      if (switchDockerTab(input.shift || false)) {
        event.preventDefault()
      }
    } else if (input.key === 'm' && input.control) {
      if (toggleMuteCurrentTab()) {
        event.preventDefault()
      }
    } else if (input.key === 'w' && input.control) {
      closeCurrentTab()
      event.preventDefault()
    } else if (input.key === 'r' && input.control) {
      const docker = dockerStore.get('docker')
      if (docker.tabs.length > 0 && docker.activeTabId) {
        mainWindow?.webContents.send('docker:refresh-tab', docker.activeTabId)
        event.preventDefault()
      }
    }
  })

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return
        
        if (input.key === 'Tab' && !input.alt) {
          if (switchDockerTab(input.shift || false)) {
            event.preventDefault()
          }
        } else if (input.key === 'm' && input.control) {
          if (toggleMuteCurrentTab()) {
            event.preventDefault()
          }
        } else if (input.key === 'w' && input.control) {
          closeCurrentTab()
          event.preventDefault()
        } else if (input.key === 'r' && input.control) {
          const docker = dockerStore.get('docker')
          if (docker.tabs.length > 0 && docker.activeTabId) {
            mainWindow?.webContents.send('docker:refresh-tab', docker.activeTabId)
            event.preventDefault()
          }
        }
      })
    }
  })
}

function createTray() {
  let icon: nativeImage
  
  const iconSize = process.platform === 'win32' ? 16 : 22
  
  const canvas = Buffer.alloc(iconSize * iconSize * 4)
  const centerX = iconSize / 2
  const centerY = iconSize / 2
  const maxRadius = iconSize / 2 - 1
  
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const idx = (y * iconSize + x) * 4
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      
      canvas[idx] = 0
      canvas[idx + 1] = 0
      canvas[idx + 2] = 0
      canvas[idx + 3] = 0
      
      if (distance <= maxRadius) {
        canvas[idx] = 255
        canvas[idx + 1] = 158
        canvas[idx + 2] = 64
        canvas[idx + 3] = 255
      }
      
      const outerRingInner = maxRadius * 0.65
      const outerRingOuter = maxRadius * 0.85
      if (distance >= outerRingInner && distance <= outerRingOuter) {
        canvas[idx] = 255
        canvas[idx + 1] = 255
        canvas[idx + 2] = 255
        canvas[idx + 3] = 255
      }
      
      const innerDotRadius = maxRadius * 0.2
      if (distance <= innerDotRadius) {
        canvas[idx] = 255
        canvas[idx + 1] = 255
        canvas[idx + 2] = 255
        canvas[idx + 3] = 255
      }
    }
  }
  
  icon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize })
  
  if (process.platform === 'win32') {
    icon = icon.resize({ width: 16, height: 16 })
  }
  
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        mainWindow?.close()
        app.quit()
      }
    }
  ])

  tray.setToolTip('直播平台账号聚合管理器')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function registerAllIPC() {
  registerAccountIPC()
  registerSettingsIPC()
  registerPlatformIPC()
  registerFollowIPC()
  registerDockerIPC()
  registerWindowIPC()
}

function registerWindowIPC() {
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    const settings = getSettings()
    if (settings.minimizeToTray) {
      mainWindow?.hide()
    } else {
      mainWindow?.close()
    }
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() || false
  })
}

app.whenReady().then(async () => {
  createWindow()
  createTray()
  registerAllIPC()
  
  await restoreCookiesFromDatabase()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  isQuitting = true
  await flushAllSessions()
})

export { mainWindow }
