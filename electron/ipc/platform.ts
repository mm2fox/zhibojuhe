import { ipcMain, session } from 'electron'
import type { Platform } from '../preload'

const platformUrls: Record<Platform, { login: string; home: string }> = {
  huya: {
    login: 'https://www.huya.com/',
    home: 'https://www.huya.com/'
  },
  douyin: {
    login: 'https://www.douyin.com/',
    home: 'https://www.douyin.com/'
  },
  douyu: {
    login: 'https://www.douyu.com/',
    home: 'https://www.douyu.com/'
  },
  bilibili: {
    login: 'https://live.bilibili.com/',
    home: 'https://live.bilibili.com/'
  }
}

let currentPlatform: Platform = 'huya'

export function registerPlatformIPC() {
  ipcMain.on('platform:switch', async (_event, platform: Platform) => {
    currentPlatform = platform
  })

  ipcMain.handle('platform:getCurrent', async () => {
    return currentPlatform
  })

  ipcMain.handle('platform:getLoginUrl', async (_event, platform: Platform) => {
    return platformUrls[platform].login
  })

  ipcMain.handle('platform:extractCookies', async (_event, platform: Platform) => {
    try {
      const partition = `persist:${platform}`
      const partitionSession = session.fromPartition(partition)
      const allCookies = await partitionSession.cookies.get({})
      const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
      return { success: true, cookies: cookieString, count: allCookies.length }
    } catch (error) {
      console.error(`[${platform}] Failed to extract cookies:`, error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('platform:injectCookies', async (_event, platform: Platform, cookies: string) => {
    try {
      const url = platformUrls[platform].home
      const partition = `persist:${platform}`
      const partitionSession = session.fromPartition(partition)

      const hostname = new URL(url).hostname
      let domain = hostname
      if (platform === 'douyin') {
        domain = '.douyin.com'
      } else if (platform === 'huya') {
        domain = '.huya.com'
      } else if (platform === 'douyu') {
        domain = '.douyu.com'
      } else if (platform === 'bilibili') {
        domain = '.bilibili.com'
      }

      console.log(`[${platform}] Injecting cookies to partition: ${partition}, domain: ${domain}`)
      console.log(`[${platform}] Cookies string length: ${cookies.length}`)

      const cookiePairs = cookies.split(';').map(c => c.trim())
      let successCount = 0
      let failCount = 0
      const failedCookies: string[] = []
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
              domain: domain,
              path: '/'
            })
            successCount++
          } catch (err) {
            failCount++
            failedCookies.push(name.trim())
          }
        }
      }
      console.log(`[${platform}] Injected ${successCount} cookies, failed ${failCount}`)
      if (failedCookies.length > 0) {
        console.log(`[${platform}] Failed cookies: ${failedCookies.join(', ')}`)
      }
      
      const allCookies = await partitionSession.cookies.get({})
      console.log(`[${platform}] Total cookies in session: ${allCookies.length}`)
      
      return { success: true, injected: successCount, failed: failCount, total: allCookies.length }
    } catch (error) {
      console.error(`[${platform}] Failed to inject cookies:`, error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('platform:getCookiesFromPartition', async (_event, platform: Platform, partitionStr: string) => {
    try {
      const url = platformUrls[platform].home
      const partitionSession = session.fromPartition(partitionStr)

      const cookies = await partitionSession.cookies.get({ url })
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')

      console.log(`[${platform}] Extracted ${cookies.length} cookies from partition ${partitionStr}`)

      return { success: true, cookies: cookieString }
    } catch (error) {
      console.error(`[${platform}] Failed to extract cookies from partition:`, error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('platform:clearCookies', async (_event, platform: Platform) => {
    try {
      const partition = `persist:${platform}`
      const partitionSession = session.fromPartition(partition)
      
      const allCookies = await partitionSession.cookies.get({})
      console.log(`[${platform}] Clearing ${allCookies.length} cookies from partition ${partition}`)
      
      const hostname = new URL(platformUrls[platform].home).hostname
      
      console.log(`[${platform}] Clearing cookies for hostname: ${hostname}`)
      
      for (const cookie of allCookies) {
        try {
          const domain = cookie.domain || ''
          const cookieUrl = `https://${domain.startsWith('.') ? domain.slice(1) : domain}${cookie.path || '/'}`
          await partitionSession.cookies.remove(cookieUrl, cookie.name)
        } catch (err) {
          console.log(`[${platform}] Failed to remove cookie ${cookie.name}:`, err)
        }
      }
      
      const remainingCookies = await partitionSession.cookies.get({})
      console.log(`[${platform}] Cleared cookies, ${remainingCookies.length} remaining`)
      
      return { success: true, cleared: allCookies.length, remaining: remainingCookies.length }
    } catch (error) {
      console.error(`[${platform}] Failed to clear cookies:`, error)
      return { success: false, error: String(error) }
    }
  })
}

export { currentPlatform, platformUrls }
