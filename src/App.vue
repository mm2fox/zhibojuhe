<template>
  <div class="app-container" :class="{ 'dark': isDark }">
    <div class="title-bar">
      <div class="title-bar-drag">
        <span class="app-title">直播平台账号聚合管理器</span>
      </div>
      <div class="title-bar-controls">
        <el-button class="control-btn" @click="minimize" text>
          <el-icon><Minus /></el-icon>
        </el-button>
        <el-button class="control-btn" @click="maximize" text>
          <el-icon><FullScreen /></el-icon>
        </el-button>
        <el-button class="control-btn close-btn" @click="close" text>
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>
    <DockerBar />
    <div class="main-content">
      <div 
        class="sidebar-trigger"
        @mouseenter="showSidebar"
        v-show="sidebarCollapsed"
      ></div>
      <div 
        class="sidebar-wrapper"
        :class="{ 'collapsed': sidebarCollapsed }"
        @mouseleave="scheduleHideSidebar"
        @mouseenter="cancelHideSidebar"
      >
        <Sidebar />
      </div>
      <div class="content-area">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useDockerStore } from './stores/docker'
import { useFollowStore } from './stores/follow'
import { useAccountStore } from './stores/account'
import Sidebar from './components/Sidebar.vue'
import DockerBar from './components/DockerBar.vue'

const settingsStore = useSettingsStore()
const dockerStore = useDockerStore()
const followStore = useFollowStore()
const accountStore = useAccountStore()
const isDark = computed(() => settingsStore.theme === 'dark')

const sidebarCollapsed = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

const minimize = () => {
  window.api.window.minimize()
}

const maximize = () => {
  window.api.window.maximize()
}

const close = () => {
  window.api.window.close()
}

function showSidebar() {
  sidebarCollapsed.value = false
  cancelHideSidebar()
}

function scheduleHideSidebar() {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  hideTimer = setTimeout(() => {
    sidebarCollapsed.value = true
  }, 500)
}

function cancelHideSidebar() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  
  const { autoRefreshFollow, refreshInterval } = settingsStore.settings
  if (!autoRefreshFollow) return
  
  const intervalMs = refreshInterval * 60 * 1000
  refreshTimer = setInterval(async () => {
    const accounts = accountStore.accounts.filter(a => a.status === 'active')
    for (const account of accounts) {
      try {
        console.log(`[AutoRefresh] Refreshing follows for ${account.platform}`)
        await followStore.refreshFollows(account.platform)
      } catch (error) {
        console.error(`[AutoRefresh] Failed to refresh ${account.platform}:`, error)
      }
    }
  }, intervalMs)
  
  console.log(`[AutoRefresh] Started with interval ${refreshInterval} minutes`)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('[AutoRefresh] Stopped')
  }
}

watch(
  () => settingsStore.settings.autoRefreshFollow,
  () => {
    if (settingsStore.settings.autoRefreshFollow) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }
)

watch(
  () => settingsStore.settings.refreshInterval,
  () => {
    if (settingsStore.settings.autoRefreshFollow) {
      startAutoRefresh()
    }
  }
)

onMounted(async () => {
  await settingsStore.loadSettings()
  await accountStore.loadAccounts()
  dockerStore.loadDocker()
  startAutoRefresh()
  window.api.follow.onBackgroundRefreshed((platform, anchors, fromCache) => {
    if (anchors && anchors.length > 0) {
      followStore.updateFollows(platform, anchors)
      followStore.setRefreshTime(platform)
      console.log(`[App] Background refresh updated ${platform}: ${anchors.length} anchors${fromCache ? ' (cache+status)' : ''}`)
    }
  })
})

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  stopAutoRefresh()
  window.api.follow.removeBackgroundRefreshedListener()
})
</script>

<style lang="scss">
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  color: var(--text-color);
  overflow: hidden;

  &.dark {
    --bg-color: #1a1a1a;
    --text-color: #ffffff;
    --sidebar-bg: #252525;
    --card-bg: #2a2a2a;
    --border-color: #333333;
    --hover-bg: #333333;
  }
}

.title-bar {
  height: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--sidebar-bg, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  -webkit-app-region: drag;
}

.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 12px;
}

.app-title {
  font-size: 13px;
  color: var(--text-color);
  opacity: 0.8;
}

.title-bar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 32px;
  border-radius: 0;
  color: var(--text-color);
  
  &:hover {
    background-color: var(--hover-bg, #e0e0e0);
  }
}

.close-btn:hover {
  background-color: #e81123 !important;
  color: white !important;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.sidebar-trigger {
  width: 8px;
  height: 100%;
  background-color: var(--sidebar-bg, #f5f7fa);
  border-right: 1px solid var(--border-color, #e4e7ed);
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:hover {
    background-color: var(--hover-bg, #ecf5ff);
  }
}

.sidebar-wrapper {
  height: 100%;
  flex-shrink: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  overflow: hidden;

  &.collapsed {
    position: absolute;
    left: 0;
    top: 0;
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    z-index: 100;
  }
}

.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}
</style>
