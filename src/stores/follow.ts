import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FollowedAnchor, Platform } from '../../electron/preload'

export const useFollowStore = defineStore('follow', () => {
  const follows = ref<Record<Platform, FollowedAnchor[]>>({
    huya: [],
    douyin: [],
    douyu: []
  })
  const loading = ref(false)

  async function loadFollows(platform: Platform) {
    loading.value = true
    try {
      console.log('[FollowStore] Loading follows for', platform)
      const list = await window.api.follow.getByPlatform(platform)
      console.log('[FollowStore] Got list:', list?.length || 0, 'items')
      
      follows.value[platform] = list || []
      
      console.log('[FollowStore] After update, follows[' + platform + ']:', follows.value[platform].length)
      console.log('[FollowStore] Full follows object:', JSON.stringify(Object.keys(follows.value).map(k => `${k}:${follows.value[k as Platform].length}`)))
    } catch (error) {
      console.error('[FollowStore] Failed to load follows:', error)
    } finally {
      loading.value = false
    }
  }

  async function refreshFollows(platform: Platform) {
    loading.value = true
    try {
      const result = await window.api.follow.refresh(platform)
      if (result.success && result.anchors) {
        follows.value[platform] = result.anchors
      }
      return result
    } catch (error) {
      console.error('Failed to refresh follows:', error)
      return { success: false, error: String(error) }
    } finally {
      loading.value = false
    }
  }

  async function getLiveStatus(platform: Platform, anchorIds: string[]) {
    try {
      return await window.api.follow.getLiveStatus(platform, anchorIds)
    } catch (error) {
      console.error('Failed to get live status:', error)
      return []
    }
  }

  function getLiveAnchors(platform: Platform) {
    return follows.value[platform].filter(a => a.isLive)
  }

  function getOfflineAnchors(platform: Platform) {
    return follows.value[platform].filter(a => !a.isLive)
  }

  return {
    follows,
    loading,
    loadFollows,
    refreshFollows,
    getLiveStatus,
    getLiveAnchors,
    getOfflineAnchors
  }
})
