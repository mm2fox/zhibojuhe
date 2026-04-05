import axios from './axios-config'
import type { FollowedAnchor, Platform } from '../../preload'

export class DouyuAPI {
  private static BASE_URL = 'https://www.douyu.com'

  static async getFollowList(cookies: string): Promise<FollowedAnchor[]> {
    try {
      console.log('[DouyuAPI] Fetching follow list...')
      console.log('[DouyuAPI] Cookies length:', cookies.length)
      console.log('[DouyuAPI] Cookies preview:', cookies.substring(0, 300))
      
      const hasAcfUid = cookies.includes('acf_uid=')
      const hasAcfAuth = cookies.includes('acf_auth=')
      const hasAcfStk = cookies.includes('acf_stk=')
      const hasDyUsername = cookies.includes('dy_username=')
      
      console.log('[DouyuAPI] Cookie check - acf_uid:', hasAcfUid, 'acf_auth:', hasAcfAuth, 'acf_stk:', hasAcfStk, 'dy_username:', hasDyUsername)
      
      if (!hasAcfUid && !hasDyUsername) {
        console.log('[DouyuAPI] Error: Missing required cookies (acf_uid or dy_username)')
        return []
      }
      
      const response = await axios.get('https://www.douyu.com/wgapi/livenc/liveweb/follow/list', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.douyu.com/directory/myFollow',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Origin': 'https://www.douyu.com',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        params: {
          page: 1,
          type: 0
        }
      })

      const data = response.data
      console.log('[DouyuAPI] Response status:', response.status)
      console.log('[DouyuAPI] Response data:', JSON.stringify(data).substring(0, 500))
      
      if (data.error !== 0) {
        console.log('[DouyuAPI] API returned error:', data.error, data.msg || '')
        return []
      }
      
      if (!data.data?.list) {
        console.log('[DouyuAPI] No list in response data')
        return []
      }

      console.log('[DouyuAPI] Found', data.data.list.length, 'follows')
      
      if (data.data.list.length > 0) {
        console.log('[DouyuAPI] First item sample:', JSON.stringify(data.data.list[0]))
      }
      
      return data.data.list.map((item: any) => ({
        id: `douyu-${item.room_id}`,
        platform: 'douyu' as Platform,
        anchorId: String(item.uid || item.room_id || ''),
        nickname: item.nickname || '',
        avatar: item.avatar || '',
        roomId: String(item.room_id),
        isLive: item.show_status === 1 || item.isLive === 1 || item.room_status === '1',
        viewerCount: item.online || 0,
        liveTitle: item.room_name || '',
        liveCover: item.room_src || '',
        updateTime: Date.now()
      }))
    } catch (error: any) {
      console.error('[DouyuAPI] Failed to get follow list:', error.message || error)
      if (error.response) {
        console.error('[DouyuAPI] Response status:', error.response.status)
        console.error('[DouyuAPI] Response data:', error.response.data)
      }
      return []
    }
  }

  static async getLiveStatus(cookies: string, anchorIds: string[]): Promise<{ anchorId: string; isLive: boolean; viewerCount: number }[]> {
    try {
      console.log('[DouyuAPI] Getting live status for', anchorIds.length, 'anchors')
      
      const response = await axios.get('https://www.douyu.com/wgapi/livenc/liveweb/room/info', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.douyu.com/',
          'Accept': 'application/json, text/plain, */*'
        },
        params: {
          rids: anchorIds.join(',')
        }
      })

      const data = response.data
      if (data.error !== 0 || !data.data) {
        console.log('[DouyuAPI] getLiveStatus error:', data.error)
        return []
      }

      const result = Object.entries(data.data).map(([roomId, info]: [string, any]) => ({
        anchorId: String(info.uid || roomId),
        isLive: info.room_status === '1' || info.show_status === 1,
        viewerCount: info.online || 0
      }))
      
      console.log('[DouyuAPI] Live status result:', result.length, 'items')
      return result
    } catch (error) {
      console.error('[DouyuAPI] Failed to get live status:', error)
      return []
    }
  }

  static getRoomUrl(roomId: string): string {
    return `https://www.douyu.com/${roomId}`
  }
}
