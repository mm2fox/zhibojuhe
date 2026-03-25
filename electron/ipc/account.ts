import { ipcMain } from 'electron'
import { Database } from '../store/database'
import type { PlatformAccount, Platform } from '../preload'

const db = Database.getInstance()

export function registerAccountIPC() {
  ipcMain.handle('account:getAll', async () => {
    try {
      return db.getAllAccounts()
    } catch (error) {
      console.error('Failed to get accounts:', error)
      return []
    }
  })

  ipcMain.handle('account:getByPlatform', async (_event, platform: Platform) => {
    try {
      return db.getAccountByPlatform(platform)
    } catch (error) {
      console.error('Failed to get account by platform:', error)
      return null
    }
  })

  ipcMain.handle('account:save', async (_event, account: Partial<PlatformAccount>) => {
    try {
      db.saveAccount(account)
      return { success: true }
    } catch (error) {
      console.error('Failed to save account:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('account:delete', async (_event, id: string) => {
    try {
      db.deleteAccount(id)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete account:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('account:checkLoginStatus', async (_event, platform: Platform) => {
    try {
      const account = db.getAccountByPlatform(platform)
      if (!account) {
        return { isLoggedIn: false }
      }
      return { isLoggedIn: account.status === 'active', account }
    } catch (error) {
      console.error('Failed to check login status:', error)
      return { isLoggedIn: false }
    }
  })
}
