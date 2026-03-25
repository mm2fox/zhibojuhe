import axios from 'axios'
import type { FollowedAnchor, Platform } from '../../preload'

export class DouyinAPI {
  private static BASE_URL = 'https://www.douyin.com'

  static async getFollowList(cookies: string): Promise<FollowedAnchor[]> {
    try {
      const response = await axios.get('https://www.douyin.com/aweme/v1/web/user/following/', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.douyin.com/'
        },
        params: {
          user_id: '0',
          sec_user_id: '',
          offset: 0,
          max_time: 0,
          count: 50
        }
      })

      const data = response.data
      if (!data.following_user_list) {
        return []
      }

      return data.following_user_list.map((item: any) => ({
        id: `douyin-${item.uid}`,
        platform: 'douyin' as Platform,
        anchorId: item.uid,
        nickname: item.nickname,
        avatar: item.avatar_thumb?.url_list?.[0] || '',
        roomId: item.room_id || '',
        isLive: item.live_status === 1,
        viewerCount: item.live_info?.user_count || 0,
        liveTitle: item.live_info?.title || '',
        liveCover: item.live_info?.cover?.url_list?.[0] || '',
        updateTime: Date.now()
      }))
    } catch (error) {
      console.error('Failed to get Douyin follow list:', error)
      return []
    }
  }

  static async getLiveStatus(cookies: string, anchorIds: string[]): Promise<{ anchorId: string; isLive: boolean; viewerCount: number }[]> {
    try {
      const response = await axios.get('https://live.douyin.com/webcast/room/reflow/info/', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        params: {
          type_id: 0,
          live_id: 1,
          app_id: 1128,
          sec_user_id: anchorIds.join(',')
        }
      })

      const data = response.data
      if (!data.data?.room) {
        return []
      }

      return data.data.room.map((room: any) => ({
        anchorId: room.owner?.id || '',
        isLive: room.status === 2,
        viewerCount: room.user_count || 0
      }))
    } catch (error) {
      console.error('Failed to get Douyin live status:', error)
      return []
    }
  }

  static getRoomUrl(roomId: string): string {
    return `https://live.douyin.com/${roomId}`
  }
}
