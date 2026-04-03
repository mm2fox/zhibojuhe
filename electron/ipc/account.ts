import { ipcMain, session } from 'electron'
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
      const account = db.getAllAccounts().find(a => a.id === id)
      if (account) {
        const platform = account.platform
        const partition = `persist:${platform}`
        const partitionSession = session.fromPartition(partition)
        
        const allCookies = await partitionSession.cookies.get({})
        console.log(`[Account] Clearing ${allCookies.length} cookies for ${platform} on account deletion`)
        
        for (const cookie of allCookies) {
          try {
            const domain = cookie.domain || ''
            const cookieUrl = `https://${domain.startsWith('.') ? domain.slice(1) : domain}${cookie.path || '/'}`
            await partitionSession.cookies.remove(cookieUrl, cookie.name)
          } catch (err) {
            console.log(`[Account] Failed to remove cookie ${cookie.name}:`, err)
          }
        }
        
        db.deleteAccount(id)
        console.log(`[Account] Deleted account ${id} and cleared session for ${platform}`)
      }
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
