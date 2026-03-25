import Store from 'electron-store'
import type { AppSettings } from './preload'

export const store = new Store<{ settings: AppSettings }>()

export const defaultSettings: AppSettings = {
  autoStart: false,
  minimizeToTray: true,
  theme: 'light',
  language: 'zh-CN',
  enablePassword: false,
  autoRefreshFollow: true,
  refreshInterval: 5
}

export function getSettings(): AppSettings {
  return store.get('settings', defaultSettings)
}

export function setSettings(settings: Partial<AppSettings>): void {
  const currentSettings = getSettings()
  store.set('settings', { ...currentSettings, ...settings })
}
