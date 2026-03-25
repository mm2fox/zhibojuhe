import { ipcMain, app } from 'electron'
import { defaultSettings, getSettings, setSettings } from '../store'
import type { AppSettings } from '../preload'

export function registerSettingsIPC() {
  ipcMain.handle('settings:get', async () => {
    try {
      const settings = getSettings()
      return settings
    } catch (error) {
      console.error('Failed to get settings:', error)
      return defaultSettings
    }
  })

  ipcMain.handle('settings:set', async (_event, settings: Partial<AppSettings>) => {
    try {
      setSettings(settings)
      return { success: true }
    } catch (error) {
      console.error('Failed to set settings:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('settings:setAutoStart', async (_event, enable: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: true
      })
      setSettings({ autoStart: enable })
      return { success: true }
    } catch (error) {
      console.error('Failed to set auto start:', error)
      return { success: false, error: String(error) }
    }
  })
}
