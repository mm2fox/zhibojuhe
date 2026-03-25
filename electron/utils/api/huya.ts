import axios from 'axios'
import type { FollowedAnchor, Platform } from '../preload'

export class HuyaAPI {
  private static BASE_URL = 'https://www.huya.com'

  static async getFollowList(cookies: string): Promise<FollowedAnchor[]> {
    try {
      const yyuidMatch = cookies.match(/yyuid=(\d+)/)
      if (!yyuidMatch) {
        console.log('[Huya] No yyuid found in cookies')
        return []
      }
      console.log('[Huya] Found yyuid:', yyuidMatch[1])

      console.log('[Huya] Fetching follow list from myfollow page...')
      const htmlResult = await this.getFollowListFromHTML(cookies)
      if (htmlResult.length > 0) {
        return htmlResult
      }

      console.log('[Huya] No follows found from HTML, trying API...')
      const apiResult = await this.tryGetFromAPI(cookies, yyuidMatch[1])
      if (apiResult.length > 0) {
        return apiResult
      }

      console.log('[Huya] No follows found')
      return []
    } catch (error: any) {
      console.error('[Huya] Failed to get follow list:', error.message)
      if (error.response) {
        console.error('[Huya] Response status:', error.response.status)
        console.error('[Huya] Response data:', String(error.response.data).substring(0, 300))
      }
      return []
    }
  }

  private static async getFollowListFromHTML(cookies: string): Promise<FollowedAnchor[]> {
    try {
      const response = await axios.get('https://www.huya.com/myfollow', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.huya.com/'
        },
        timeout: 15000
      })

      const html = response.data
      console.log('[Huya] HTML response length:', html.length)

      const follows = this.parseHTMLResponse(html)
      console.log('[Huya] Parsed', follows.length, 'follows from HTML')
      return follows
    } catch (error: any) {
      console.error('[Huya] HTML parsing failed:', error.message)
      return []
    }
  }

  private static async tryGetFromAPI(cookies: string, yyuid: string): Promise<FollowedAnchor[]> {
    try {
      const response = await axios.get('https://www.huya.com/cache.php', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.huya.com/myfollow',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        params: {
          m: 'Subscribe',
          do: 'getSubscribeList',
          uid: yyuid,
          page: 1,
          callback: ''
        },
        timeout: 10000
      })

      const data = response.data
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        if (data.status === 200 || data.status === 0 || data.code === 0) {
          const list = data.data?.list || data.data || []
          if (Array.isArray(list) && list.length > 0) {
            console.log('[Huya] Found', list.length, 'follows from API')
            return this.parseAPIResponse(list)
          }
        }
      }

      return []
    } catch (error: any) {
      console.error('[Huya] API request failed:', error.message)
      return []
    }
  }

  private static parseAPIResponse(list: any[]): FollowedAnchor[] {
    return list.map((item: any) => ({
      id: `huya-${item.profileRoom || item.roomId || item.uid || item.id}`,
      platform: 'huya' as Platform,
      anchorId: String(item.uid || item.anchorUid || item.id),
      nickname: item.nick || item.nickname || item.name || '',
      avatar: item.avatar || item.avatarUrl || '',
      roomId: String(item.profileRoom || item.roomId || item.room_id || item.rid || ''),
      isLive: item.isLive === true || item.liveStatus === 1 || item.isOn === true,
      viewerCount: item.activityCount || item.popularity || item.online || item.count || 0,
      liveTitle: item.introduction || item.title || item.roomName || '',
      liveCover: item.screenshot || item.cover || item.thumb || '',
      updateTime: Date.now()
    }))
  }

  private static parseHTMLResponse(html: string): FollowedAnchor[] {
    const follows: FollowedAnchor[] = []

    const scriptMatches = html.match(/<script[^>]*>\s*window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i)
    if (scriptMatches) {
      try {
        let jsonStr = scriptMatches[1]
        const jsonData = JSON.parse(jsonStr)
        console.log('[Huya] Found __INITIAL_STATE__ in HTML, keys:', Object.keys(jsonData))

        const possibleKeys = ['subscribeList', 'followList', 'myFollowList', 'follows', 'list', 'anchorList']
        for (const key of possibleKeys) {
          const list = jsonData[key]
          if (Array.isArray(list) && list.length > 0) {
            console.log('[Huya] Found list in key:', key, 'length:', list.length)
            return list.map((item: any) => this.parseAnchorItem(item))
          }
        }

        if (jsonData.data && typeof jsonData.data === 'object') {
          for (const key of possibleKeys) {
            const list = jsonData.data[key]
            if (Array.isArray(list) && list.length > 0) {
              console.log('[Huya] Found list in data.' + key, 'length:', list.length)
              return list.map((item: any) => this.parseAnchorItem(item))
            }
          }
        }
      } catch (e) {
        console.error('[Huya] Failed to parse __INITIAL_STATE__:', e)
      }
    } else {
      console.log('[Huya] No __INITIAL_STATE__ found in HTML')
    }

    const stateMatch = html.match(/window\.__NEXT_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i)
    if (stateMatch) {
      try {
        const jsonData = JSON.parse(stateMatch[1])
        console.log('[Huya] Found __NEXT_STATE__ in HTML')
        
        const possibleKeys = ['subscribeList', 'followList', 'myFollowList', 'follows', 'list']
        for (const key of possibleKeys) {
          const list = jsonData[key]
          if (Array.isArray(list) && list.length > 0) {
            return list.map((item: any) => this.parseAnchorItem(item))
          }
        }
      } catch (e) {
        console.error('[Huya] Failed to parse __NEXT_STATE__:', e)
      }
    }

    const liveListMatch = html.match(/<ul[^>]*class="[^"]*live-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)
    if (liveListMatch) {
      const ulContent = liveListMatch[1]
      const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let liMatch
      while ((liMatch = liPattern.exec(ulContent)) !== null) {
        const liContent = liMatch[1]
        const anchor = this.parseListItem(liContent)
        if (anchor) {
          follows.push(anchor)
        }
      }
      if (follows.length > 0) {
        console.log('[Huya] Parsed', follows.length, 'follows from live-list')
        return follows
      }
    }

    const allLiPattern = /<li[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    let match
    let totalLi = 0
    while ((match = allLiPattern.exec(html)) !== null) {
      const liContent = match[1]
      totalLi++
      if (liContent.includes('huya.com') || liContent.includes('data-rid') || liContent.includes('data-room')) {
        const anchor = this.parseListItem(liContent)
        if (anchor) {
          follows.push(anchor)
        }
      }
    }

    console.log('[Huya] Scanned', totalLi, 'li elements, found', follows.length, 'potential anchors')

    return follows
  }

  private static parseAnchorItem(item: any): FollowedAnchor {
    return {
      id: `huya-${item.profileRoom || item.roomId || item.uid || item.id}`,
      platform: 'huya' as Platform,
      anchorId: String(item.uid || item.anchorUid || item.id),
      nickname: item.nick || item.nickname || item.name || '',
      avatar: item.avatar || item.avatarUrl || item.avatar180 || '',
      roomId: String(item.profileRoom || item.roomId || item.room_id || item.rid || ''),
      isLive: item.isLive === true || item.liveStatus === 1 || item.isOn === true || item.live === true,
      viewerCount: item.activityCount || item.popularity || item.online || item.count || 0,
      liveTitle: item.introduction || item.title || item.roomName || '',
      liveCover: item.screenshot || item.cover || item.thumb || '',
      updateTime: Date.now()
    }
  }

  private static parseListItem(liContent: string): FollowedAnchor | null {
    const excludePaths = ['myfollow', 'live', 'match', 'game', 'g', 'search', 'vip', 'ranklist', 'activity', 'subject']
    
    const roomIdMatch = liContent.match(/href="https?:\/\/www\.huya\.com\/(\d+)"/i) ||
                        liContent.match(/href="\/(\d+)"/i) ||
                        liContent.match(/data-rid="(\d+)"/i) ||
                        liContent.match(/data-room-id="(\d+)"/i)
    
    if (!roomIdMatch) return null
    
    const roomId = roomIdMatch[1]
    if (!/^\d{4,}$/.test(roomId)) return null
    
    const nameMatch = liContent.match(/title="([^"]+)"/i) ||
                      liContent.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</i) ||
                      liContent.match(/class="[^"]*nick[^"]*"[^>]*>([^<]+)</i)
    
    if (!nameMatch) return null
    
    const nickname = nameMatch[1].trim()
    if (!nickname || nickname.length < 1 || nickname.length > 30) return null
    
    for (const exclude of excludePaths) {
      if (liContent.toLowerCase().includes(`/${exclude}`) || 
          liContent.toLowerCase().includes(`"${exclude}"`)) {
        return null
      }
    }
    
    const avatarMatch = liContent.match(/src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i) ||
                        liContent.match(/data-src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i)
    
    const isLiveMatch = liContent.match(/class="[^"]*(?:live|直播|on)[^"]*"/i) ||
                        liContent.includes('直播中')

    return {
      id: `huya-${roomId}`,
      platform: 'huya' as Platform,
      anchorId: roomId,
      nickname: nickname,
      avatar: avatarMatch ? avatarMatch[1] : '',
      roomId: roomId,
      isLive: !!isLiveMatch,
      viewerCount: 0,
      liveTitle: '',
      liveCover: '',
      updateTime: Date.now()
    }
  }

  static async getLiveStatus(cookies: string, anchorIds: string[]): Promise<{ anchorId: string; isLive: boolean; viewerCount: number }[]> {
    return []
  }

  static getRoomUrl(roomId: string): string {
    return `https://www.huya.com/${roomId}`
  }
}
