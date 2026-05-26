import { ipcMain } from 'electron'
import { Database } from '../store/database'
import { HuyaAPI } from '../utils/api/huya'
import { DouyinAPI } from '../utils/api/douyin'
import { DouyuAPI } from '../utils/api/douyu'
import { BilibiliAPI } from '../utils/api/bilibili'
import type { Platform, FollowedAnchor } from '../preload'
import { mainWindow } from '../main'

const db = Database.getInstance()

let backgroundRefreshTimers: Map<Platform, NodeJS.Timeout> = new Map()

function getAPIForPlatform(platform: Platform) {
  switch (platform) {
    case 'huya': return HuyaAPI
    case 'douyin': return DouyinAPI
    case 'douyu': return DouyuAPI
    case 'bilibili': return BilibiliAPI
  }
}

async function refreshLiveStatusForPlatform(platform: Platform, anchors: FollowedAnchor[]): Promise<FollowedAnchor[]> {
  if (anchors.length === 0) return anchors

  const account = db.getAccountByPlatform(platform)
  if (!account) return anchors

  const roomIds = anchors.map(a => a.roomId).filter(id => id)
  if (roomIds.length === 0) return anchors

  try {
    const api = getAPIForPlatform(platform)
    const liveStatusResult = await api.getLiveStatus(account.cookies, roomIds)
    const liveStatusMap = new Map<string, { isLive: boolean; viewerCount: number }>()

    for (const status of liveStatusResult) {
      liveStatusMap.set(status.anchorId, { isLive: status.isLive, viewerCount: status.viewerCount })
    }

    return anchors.map(anchor => {
      const status = liveStatusMap.get(anchor.roomId) || liveStatusMap.get(anchor.anchorId)
      if (status) {
        return {
          ...anchor,
          isLive: status.isLive,
          viewerCount: status.viewerCount,
          updateTime: Date.now()
        }
      }
      return { ...anchor, updateTime: Date.now() }
    })
  } catch (error) {
    console.error(`[BackgroundRefresh] Failed to refresh live status for ${platform}:`, error)
    return anchors
  }
}

async function refreshFollowListForPlatform(platform: Platform): Promise<{ success: boolean; anchors: FollowedAnchor[]; fromCache: boolean }> {
  const account = db.getAccountByPlatform(platform)
  if (!account) {
    return { success: false, anchors: [], fromCache: false }
  }

  const api = getAPIForPlatform(platform)
  const anchors = await api.getFollowList(account.cookies)

  if (anchors.length > 0) {
    const updatedAnchors = await refreshLiveStatusForPlatform(platform, anchors)
    db.deleteFollowsByPlatform(platform)
    db.saveFollows(updatedAnchors)
    return { success: true, anchors: updatedAnchors, fromCache: false }
  }

  const cachedFollows = db.getFollowsByPlatform(platform)
  if (cachedFollows.length > 0) {
    const updatedCached = await refreshLiveStatusForPlatform(platform, cachedFollows)
    db.saveFollows(updatedCached)
    return { success: true, anchors: updatedCached, fromCache: true }
  }

  return { success: true, anchors: [], fromCache: false }
}

function startBackgroundRefresh(platform: Platform, intervalMs: number) {
  stopBackgroundRefresh(platform)

  const timer = setInterval(async () => {
    console.log(`[BackgroundRefresh] Refreshing ${platform}...`)
    try {
      const result = await refreshFollowListForPlatform(platform)
      if (result.success && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('follow:backgroundRefreshed', platform, result.anchors, result.fromCache)
        console.log(`[BackgroundRefresh] ${platform} refreshed: ${result.anchors.length} anchors${result.fromCache ? ' (cache+status updated)' : ''}`)
      }
    } catch (error) {
      console.error(`[BackgroundRefresh] Failed to refresh ${platform}:`, error)
    }
  }, intervalMs)

  backgroundRefreshTimers.set(platform, timer)
  console.log(`[BackgroundRefresh] Started for ${platform}, interval: ${intervalMs / 60000} minutes`)
}

function stopBackgroundRefresh(platform: Platform) {
  const timer = backgroundRefreshTimers.get(platform)
  if (timer) {
    clearInterval(timer)
    backgroundRefreshTimers.delete(platform)
    console.log(`[BackgroundRefresh] Stopped for ${platform}`)
  }
}

function stopAllBackgroundRefresh() {
  for (const platform of backgroundRefreshTimers.keys()) {
    stopBackgroundRefresh(platform)
  }
}

export function registerFollowIPC() {
  ipcMain.handle('follow:getByPlatform', async (_event, platform: Platform) => {
    try {
      const list = db.getFollowsByPlatform(platform)
      return list
    } catch (error) {
      console.error('Failed to get follows:', error)
      return []
    }
  })

  ipcMain.handle('follow:refresh', async (_event, platform: Platform) => {
    try {
      const result = await refreshFollowListForPlatform(platform)
      return { success: result.success, anchors: result.anchors, fromCache: result.fromCache }
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

      const api = getAPIForPlatform(platform)
      return await api.getLiveStatus(account.cookies, anchorIds)
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
      if (anchors.length === 0) {
        return { success: true, count: 0 }
      }
      db.deleteFollowsByPlatform(platform)
      db.saveFollows(anchors)
      return { success: true, count: anchors.length }
    } catch (error) {
      console.error('Failed to update follows from webview:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.on('follow:startBackgroundRefresh', (_event, platform: Platform, intervalMs: number) => {
    startBackgroundRefresh(platform, intervalMs)
  })

  ipcMain.on('follow:stopBackgroundRefresh', (_event, platform: Platform) => {
    stopBackgroundRefresh(platform)
  })

  ipcMain.on('follow:stopAllBackgroundRefresh', () => {
    stopAllBackgroundRefresh()
  })
}

export { startBackgroundRefresh, stopBackgroundRefresh, stopAllBackgroundRefresh }
