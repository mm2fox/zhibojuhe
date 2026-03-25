import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '../../electron/preload'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    autoStart: false,
    minimizeToTray: true,
    theme: 'light',
    language: 'zh-CN',
    enablePassword: false,
    autoRefreshFollow: true,
    refreshInterval: 5
  })

  async function loadSettings() {
    try {
      const loaded = await window.api.settings.get()
      settings.value = loaded
      applyTheme(loaded.theme)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  async function updateSettings(newSettings: Partial<AppSettings>) {
    try {
      await window.api.settings.set(newSettings)
      settings.value = { ...settings.value, ...newSettings }
      if (newSettings.theme) {
        applyTheme(newSettings.theme)
      }
      return true
    } catch (error) {
      console.error('Failed to update settings:', error)
      return false
    }
  }

  async function setAutoStart(enable: boolean) {
    try {
      await window.api.settings.setAutoStart(enable)
      settings.value.autoStart = enable
      return true
    } catch (error) {
      console.error('Failed to set auto start:', error)
      return false
    }
  }

  function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  return {
    settings,
    loadSettings,
    updateSettings,
    setAutoStart
  }
})

export const theme = ref<'light' | 'dark'>('light')
