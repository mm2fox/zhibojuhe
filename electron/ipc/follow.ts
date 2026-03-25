import { ipcMain } from 'electron'
import { Database } from '../store/database'
import { HuyaAPI } from '../utils/api/huya'
import { DouyinAPI } from '../utils/api/douyin'
import { DouyuAPI } from '../utils/api/douyu'
import type { Platform, FollowedAnchor } from '../preload'

const db = Database.getInstance()

export function registerFollowIPC() {
  ipcMain.handle('follow:getByPlatform', async (_event, platform: Platform) => {
    try {
      const list = db.getFollowsByPlatform(platform)
      console.log(`[follow:getByPlatform] Returning ${list?.length || 0} follows for ${platform}`)
      return list
    } catch (error) {
      console.error('Failed to get follows:', error)
      return []
    }
  })

  ipcMain.handle('follow:refresh', async (_event, platform: Platform) => {
    try {
      const account = db.getAccountByPlatform(platform)
      if (!account) {
        return { success: false, error: '请先登录账号', needsRelogin: true }
      }

      console.log(`[${platform}] Refreshing follow list...`)
      console.log(`[${platform}] Account cookies length:`, account.cookies?.length || 0)

      let anchors: FollowedAnchor[] = []

      switch (platform) {
        case 'huya':
          anchors = await HuyaAPI.getFollowList(account.cookies)
          break
        case 'douyin':
          anchors = await DouyinAPI.getFollowList(account.cookies)
          break
        case 'douyu':
          anchors = await DouyuAPI.getFollowList(account.cookies)
          break
      }

      console.log(`[${platform}] API returned ${anchors.length} anchors`)

      if (anchors.length > 0) {
        db.deleteFollowsByPlatform(platform)
        db.saveFollows(anchors)
        console.log(`[${platform}] Saved ${anchors.length} follows`)
        return { success: true, anchors }
      }

      const cachedFollows = db.getFollowsByPlatform(platform)
      if (cachedFollows.length > 0) {
        console.log(`[${platform}] API returned empty, using ${cachedFollows.length} cached follows`)
        return { success: true, anchors: cachedFollows, fromCache: true }
      }

      console.log(`[${platform}] No follows found`)
      return { success: true, anchors: [] }
    } catch (error) {
      console.error('Failed to refresh follows:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('follow:getLiveStatus', async (_event, platform: Platform, anchorIds: string[]) => {
    try {
      const account = db.getAccountByPlatform(platform)
      if (!account) {
        return []
      }

      switch (platform) {
        case 'huya':
          return await HuyaAPI.getLiveStatus(account.cookies, anchorIds)
        case 'douyin':
          return await DouyinAPI.getLiveStatus(account.cookies, anchorIds)
        case 'douyu':
          return await DouyuAPI.getLiveStatus(account.cookies, anchorIds)
        default:
          return []
      }
    } catch (error) {
      console.error('Failed to get live status:', error)
      return []
    }
  })

  ipcMain.handle('follow:save', async (_event, anchors: FollowedAnchor[]) => {
    try {
      db.saveFollows(anchors)
      return { success: true }
    } catch (error) {
      console.error('Failed to save follows:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('follow:updateFromWebview', async (_event, platform: Platform, anchorsJson: string) => {
    try {
      const anchors = JSON.parse(anchorsJson) as FollowedAnchor[]
      db.deleteFollowsByPlatform(platform)
      db.saveFollows(anchors)
      console.log(`[${platform}] Replaced with ${anchors.length} follows from webview`)
      return { success: true, count: anchors.length }
    } catch (error) {
      console.error('Failed to update follows from webview:', error)
      return { success: false, error: String(error) }
    }
  })
}
