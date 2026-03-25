import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { DockerTab, DockerData, Platform } from '../../electron/preload'

export const useDockerStore = defineStore('docker', () => {
  const tabs = ref<DockerTab[]>([])
  const activeTabId = ref<string | null>(null)
  const isCollapsed = ref(false)
  const loading = ref(false)

  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value) || null
  })

  const hasTabs = computed(() => tabs.value.length > 0)

  async function loadDocker() {
    loading.value = true
    try {
      const data: DockerData = await window.api.docker.get()
      tabs.value = data.tabs || []
      activeTabId.value = data.activeTabId || null
      isCollapsed.value = data.isCollapsed || false
    } catch (error) {
      console.error('Failed to load docker:', error)
    } finally {
      loading.value = false
    }
  }

  async function saveDocker() {
    try {
      const data: DockerData = {
        tabs: toRaw(tabs.value),
        activeTabId: toRaw(activeTabId.value),
        isCollapsed: toRaw(isCollapsed.value)
      }
      await window.api.docker.set(data)
    } catch (error) {
      console.error('Failed to save docker:', error)
    }
  }

  async function addTab(tab: Omit<DockerTab, 'addedTime'>) {
    const existingTab = tabs.value.find(t => t.id === tab.id)
    if (existingTab) {
      activeTabId.value = existingTab.id
      await saveDocker()
      return existingTab
    }

    const newTab: DockerTab = {
      ...toRaw(tab),
      addedTime: Date.now()
    }
    
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    await saveDocker()
    return newTab
  }

  async function removeTab(id: string) {
    const index = tabs.value.findIndex(t => t.id === id)
    if (index >= 0) {
      tabs.value.splice(index, 1)
      
      if (activeTabId.value === id) {
        if (tabs.value.length > 0) {
          const newIndex = Math.min(index, tabs.value.length - 1)
          activeTabId.value = tabs.value[newIndex].id
        } else {
          activeTabId.value = null
        }
      }
      
      await saveDocker()
    }
  }

  async function setActiveTab(id: string | null) {
    activeTabId.value = id
    await saveDocker()
  }

  async function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value
    await saveDocker()
  }

  function getTabById(id: string) {
    return tabs.value.find(t => t.id === id) || null
  }

  function getTabsByPlatform(platform: Platform) {
    return tabs.value.filter(t => t.platform === platform)
  }

  async function toggleMute(id: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.muted = !tab.muted
      await saveDocker()
      window.dispatchEvent(new CustomEvent('docker-mute-changed', {
        detail: { tabId: id, muted: tab.muted }
      }))
      return tab.muted
    }
    return false
  }

  return {
    tabs,
    activeTabId,
    isCollapsed,
    loading,
    activeTab,
    hasTabs,
    loadDocker,
    saveDocker,
    addTab,
    removeTab,
    setActiveTab,
    toggleCollapse,
    getTabById,
    getTabsByPlatform,
    toggleMute
  }
})
