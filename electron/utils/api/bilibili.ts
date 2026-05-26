import axios from './axios-config'
import type { FollowedAnchor, Platform } from '../../preload'

export class BilibiliAPI {
  private static BASE_URL = 'https://live.bilibili.com'

  static async getFollowList(cookies: string): Promise<FollowedAnchor[]> {
    try {
      console.log('[Bilibili] Fetching follow list from myfollow page...')
      const htmlResult = await this.getFollowListFromHTML(cookies)
      if (htmlResult.length > 0) {
        return htmlResult
      }

      console.log('[Bilibili] No follows found from HTML, trying API...')
      const apiResult = await this.tryGetFromAPI(cookies)
      if (apiResult.length > 0) {
        return apiResult
      }

      console.log('[Bilibili] No follows found')
      return []
    } catch (error: any) {
      console.error('[Bilibili] Failed to get follow list:', error.message)
      if (error.response) {
        console.error('[Bilibili] Response status:', error.response.status)
        console.error('[Bilibili] Response data:', String(error.response.data).substring(0, 300))
      }
      return []
    }
  }

  private static async getFollowListFromHTML(cookies: string): Promise<FollowedAnchor[]> {
    try {
      const response = await axios.get('https://live.bilibili.com/p/eden/follow', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Referer': 'https://live.bilibili.com/'
        },
        timeout: 15000
      })

      const html = response.data
      console.log('[Bilibili] HTML response length:', html.length)

      const follows = this.parseHTMLResponse(html)
      console.log('[Bilibili] Parsed', follows.length, 'follows from HTML')
      return follows
    } catch (error: any) {
      console.error('[Bilibili] HTML parsing failed:', error.message)
      return []
    }
  }

  private static async tryGetFromAPI(cookies: string): Promise<FollowedAnchor[]> {
    try {
      const response = await axios.get('https://api.live.bilibili.com/relation/v1/feed/anchor/live', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://live.bilibili.com/p/eden/follow',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        params: {
          page: 1,
          page_size: 50
        },
        timeout: 10000
      })

      const data = response.data
      if (data.code === 0 && data.data && Array.isArray(data.data.list)) {
        console.log('[Bilibili] Found', data.data.list.length, 'follows from API')
        return this.parseAPIResponse(data.data.list)
      }

      return []
    } catch (error: any) {
      console.error('[Bilibili] API request failed:', error.message)
      return []
    }
  }

  private static parseAPIResponse(list: any[]): FollowedAnchor[] {
    return list.map((item: any) => ({
      id: `bilibili-${item.anchor_info.room_id}`,
      platform: 'bilibili' as Platform,
      anchorId: String(item.anchor_info.uid),
      nickname: item.anchor_info.uname || '',
      avatar: item.anchor_info.face || '',
      roomId: String(item.anchor_info.room_id),
      isLive: item.live_status === 1,
      viewerCount: item.online || 0,
      followerCount: item.anchor_info.fans || 0,
      liveTitle: item.room_info.title || '',
      liveCover: item.room_info.cover || '',
      updateTime: Date.now()
    }))
  }

  private static parseHTMLResponse(html: string): FollowedAnchor[] {
    const follows: FollowedAnchor[] = []

    const scriptMatches = html.match(/<script[^>]*>*window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i)
    if (scriptMatches) {
      try {
        let jsonStr = scriptMatches[1]
        const jsonData = JSON.parse(jsonStr)
        console.log('[Bilibili] Found __INITIAL_STATE__ in HTML, keys:', Object.keys(jsonData))

        const possibleKeys = ['followList', 'liveList', 'list', 'anchorList']
        for (const key of possibleKeys) {
          const list = jsonData[key]
          if (Array.isArray(list) && list.length > 0) {
            console.log('[Bilibili] Found list in key:', key, 'length:', list.length)
            return list.map((item: any) => this.parseAnchorItem(item))
          }
        }

        if (jsonData.data && typeof jsonData.data === 'object') {
          for (const key of possibleKeys) {
            const list = jsonData.data[key]
            if (Array.isArray(list) && list.length > 0) {
              console.log('[Bilibili] Found list in data.' + key, 'length:', list.length)
              return list.map((item: any) => this.parseAnchorItem(item))
            }
          }
        }
      } catch (e) {
        console.error('[Bilibili] Failed to parse __INITIAL_STATE__:', e)
      }
    } else {
      console.log('[Bilibili] No __INITIAL_STATE__ found in HTML')
    }

    const stateMatch = html.match(/window\.__NEXT_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i)
    if (stateMatch) {
      try {
        const jsonData = JSON.parse(stateMatch[1])
        console.log('[Bilibili] Found __NEXT_STATE__ in HTML')
        
        const possibleKeys = ['followList', 'liveList', 'list']
        for (const key of possibleKeys) {
          const list = jsonData[key]
          if (Array.isArray(list) && list.length > 0) {
            return list.map((item: any) => this.parseAnchorItem(item))
          }
        }
      } catch (e) {
        console.error('[Bilibili] Failed to parse __NEXT_STATE__:', e)
      }
    }

    const liveListMatch = html.match(/<ul[^>]*class="[^\"]*live-list[^\"]*"[^>]*>([\s\S]*?)<\/ul>/i)
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
        console.log('[Bilibili] Parsed', follows.length, 'follows from live-list')
        return follows
      }
    }

    const allLiPattern = /<li[^>]*class="[^\"]*"[^>]*>([\s\S]*?)<\/li>/gi
    let match
    let totalLi = 0
    while ((match = allLiPattern.exec(html)) !== null) {
      const liContent = match[1]
      totalLi++
      if (liContent.includes('live.bilibili.com') || liContent.includes('data-roomid') || liContent.includes('data-room-id')) {
        const anchor = this.parseListItem(liContent)
        if (anchor) {
          follows.push(anchor)
        }
      }
    }

    console.log('[Bilibili] Scanned', totalLi, 'li elements, found', follows.length, 'potential anchors')

    return follows
  }

  private static parseAnchorItem(item: any): FollowedAnchor {
    return {
      id: `bilibili-${item.room_id || item.roomId || item.id}`,
      platform: 'bilibili' as Platform,
      anchorId: String(item.uid || item.user_id || item.id),
      nickname: item.uname || item.nickname || item.name || '',
      avatar: item.face || item.avatar || '',
      roomId: String(item.room_id || item.roomId || ''),
      isLive: item.live_status === 1 || item.is_live === true || item.live === true,
      viewerCount: item.online || item.viewers || item.count || 0,
      followerCount: item.fans || item.followerCount || 0,
      liveTitle: item.title || item.room_title || '',
      liveCover: item.cover || item.room_cover || '',
      updateTime: Date.now()
    }
  }

  private static parseListItem(liContent: string): FollowedAnchor | null {
    const excludePaths = ['eden', 'follow', 'live', 'game', 'search', 'vip', 'rank', 'activity']
    
    const roomIdMatch = liContent.match(/href="https?:\/\/live\.bilibili\.com\/(\d+)"/i) ||
                        liContent.match(/href="\/(\d+)"/i) ||
                        liContent.match(/data-roomid="(\d+)"/i) ||
                        liContent.match(/data-room-id="(\d+)"/i)
    
    if (!roomIdMatch) return null
    
    const roomId = roomIdMatch[1]
    if (!/^\d{4,}$/.test(roomId)) return null
    
    const nameMatch = liContent.match(/title="([^"]+)"/i) ||
                      liContent.match(/class="[^\"]*name[^\"]*"[^>]*>([^<]+)</i) ||
                      liContent.match(/class="[^\"]*nick[^\"]*"[^>]*>([^<]+)</i)
    
    if (!nameMatch) return null
    
    const nickname = nameMatch[1].trim()
    if (!nickname || nickname.length < 1 || nickname.length > 30) return null
    
    for (const exclude of excludePaths) {
      if (liContent.toLowerCase().includes(`/${exclude}`) || 
          liContent.toLowerCase().includes(`"${exclude}"`)) {
        return null
      }
    }
    
    const avatarMatch = liContent.match(/src="(https?:\/\/[^"\n]+\.(jpg|jpeg|png|webp)[^"\n]*)"/i) ||
                        liContent.match(/data-src="(https?:\/\/[^"\n]+\.(jpg|jpeg|png|webp)[^"\n]*)"/i)
    
    const isLiveMatch = liContent.match(/class="[^\"]*(?:live|直播|on)[^\"]*"/i) ||
                        liContent.includes('直播中')

    return {
      id: `bilibili-${roomId}`,
      platform: 'bilibili' as Platform,
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
    if (!anchorIds || anchorIds.length === 0) {
      return []
    }

    try {
      console.log('[Bilibili] Getting live status for', anchorIds.length, 'anchors')

      const roomIds = anchorIds.filter(id => /^\d+$/.test(id))
      if (roomIds.length === 0) {
        return []
      }

      const response = await axios.get('https://api.live.bilibili.com/room/v1/Room/get_status_info_by_ids', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://live.bilibili.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        params: {
          ids: roomIds.join(',')
        },
        timeout: 15000
      })

      const data = response.data
      
      if (data.code !== 0 || !data.data) {
        return []
      }

      const result: { anchorId: string; isLive: boolean; viewerCount: number }[] = []
      
      for (const roomId of roomIds) {
        const roomInfo = data.data[roomId]
        if (roomInfo) {
          const isLive = roomInfo.live_status === 1
          const viewerCount = roomInfo.online || 0
          
          result.push({
            anchorId: roomId,
            isLive: isLive,
            viewerCount: viewerCount
          })
        } else {
          result.push({
            anchorId: roomId,
            isLive: false,
            viewerCount: 0
          })
        }
      }

      console.log('[Bilibili] Live status result:', result.filter(r => r.isLive).length, 'live,', result.length, 'total')
      return result
    } catch (error: any) {
      console.error('[Bilibili] Failed to get live status:', error.message)
      return []
    }
  }

  static getRoomUrl(roomId: string): string {
    return `https://live.bilibili.com/${roomId}`
  }
}
