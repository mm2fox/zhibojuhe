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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useDockerStore } from './stores/docker'
import Sidebar from './components/Sidebar.vue'
import DockerBar from './components/DockerBar.vue'

const settingsStore = useSettingsStore()
const dockerStore = useDockerStore()
const isDark = computed(() => settingsStore.theme === 'dark')

const sidebarCollapsed = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

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

onMounted(() => {
  dockerStore.loadDocker()
})

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
