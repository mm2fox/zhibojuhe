import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FollowedAnchor, Platform } from '../../electron/preload'

export const useFollowStore = defineStore('follow', () => {
  const follows = ref<Record<Platform, FollowedAnchor[]>>({
    huya: [],
    douyin: [],
    douyu: [],
    bilibili: []
  })
  const loading = ref(false)
  const lastRefreshTime = ref<Record<Platform, number>>({
    huya: 0,
    douyin: 0,
    douyu: 0,
    bilibili: 0
  })

  function updateFollows(platform: Platform, list: FollowedAnchor[]) {
    follows.value = {
      ...follows.value,
      [platform]: list
    }
  }

  function setRefreshTime(platform: Platform) {
    lastRefreshTime.value = {
      ...lastRefreshTime.value,
      [platform]: Date.now()
    }
  }

  async function loadFollows(platform: Platform) {
    loading.value = true
    try {
      const list = await window.api.follow.getByPlatform(platform)
      updateFollows(platform, list || [])
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
        updateFollows(platform, result.anchors)
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
    const list = follows.value[platform] || []
    return list.filter(a => a.isLive)
  }

  function getOfflineAnchors(platform: Platform) {
    const list = follows.value[platform] || []
    return list.filter(a => !a.isLive)
  }

  return {
    follows,
    loading,
    lastRefreshTime,
    loadFollows,
    refreshFollows,
    updateFollows,
    setRefreshTime,
    getLiveStatus,
    getLiveAnchors,
    getOfflineAnchors
  }
})
