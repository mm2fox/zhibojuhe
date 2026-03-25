<template>
  <div class="docker-wrapper">
    <div 
      class="docker-trigger"
      @mouseenter="showDocker"
    ></div>
    <div 
      class="docker-bar"
      :class="{ 
        collapsed: isCollapsed, 
        hidden: isHidden 
      }"
      @mouseenter="showDocker"
      @mouseleave="scheduleHideDocker"
    >
      <div class="docker-header">
        <div class="docker-title" @click="toggleCollapse">
          <el-icon class="toggle-icon" :class="{ rotated: isCollapsed }">
            <ArrowDown />
          </el-icon>
          <span>直播间</span>
          <el-badge v-if="tabs.length > 0" :value="tabs.length" type="primary" class="tab-count" />
        </div>
        <div v-if="!isCollapsed && tabs.length > 0" class="docker-actions">
          <el-button link size="small" @click="closeAllTabs" title="关闭所有">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
      
      <div v-if="!isCollapsed" class="docker-tabs">
        <div v-if="tabs.length === 0" class="empty-hint">
          <span>点击侧边栏主播添加到Docker</span>
        </div>
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="docker-tab"
          :class="{ active: tab.id === activeTabId, muted: tab.muted }"
          @click="selectTab(tab.id)"
          @contextmenu.prevent="showContextMenu($event, tab)"
        >
          <PlatformIcon :platform="tab.platform" :size="16" />
          <span class="tab-name" :title="tab.nickname">{{ tab.nickname }}</span>
          <el-icon v-if="tab.muted" class="mute-icon" :size="12"><Mute /></el-icon>
          <el-button
            link
            size="small"
            class="close-btn"
            @click.stop="closeTab(tab.id)"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <div class="context-menu-item" @click="handleToggleMute">
        <el-icon><component :is="contextMenuTab?.muted ? 'Microphone' : 'Mute'" /></el-icon>
        <span>{{ contextMenuTab?.muted ? '取消静音' : '静音' }}</span>
      </div>
      <div class="context-menu-item" @click="handleCloseTab">
        <el-icon><Close /></el-icon>
        <span>关闭</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { useDockerStore } from '@/stores/docker'
import PlatformIcon from './PlatformIcon.vue'
import type { DockerTab } from '../../electron/preload'

const dockerStore = useDockerStore()

const tabs = computed(() => dockerStore.tabs)
const activeTabId = computed(() => dockerStore.activeTabId)
const isCollapsed = computed(() => dockerStore.isCollapsed)

const isHidden = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTab = ref<DockerTab | null>(null)

function showDocker() {
  isHidden.value = false
  cancelHideTimer()
}

function scheduleHideDocker() {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  hideTimer = setTimeout(() => {
    isHidden.value = true
  }, 800)
}

function cancelHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function toggleCollapse() {
  dockerStore.toggleCollapse()
}

function selectTab(id: string) {
  dockerStore.setActiveTab(id)
  window.dispatchEvent(new CustomEvent('docker-tab-selected', {
    detail: { tabId: id }
  }))
}

function closeTab(id: string) {
  dockerStore.removeTab(id)
  if (dockerStore.hasTabs && dockerStore.activeTabId) {
    window.dispatchEvent(new CustomEvent('docker-tab-selected', {
      detail: { tabId: dockerStore.activeTabId }
    }))
  } else {
    window.dispatchEvent(new CustomEvent('docker-cleared'))
  }
}

function closeAllTabs() {
  const tabIds = tabs.value.map(t => t.id)
  tabIds.forEach(id => dockerStore.removeTab(id))
  window.dispatchEvent(new CustomEvent('docker-cleared'))
}

function showContextMenu(event: MouseEvent, tab: DockerTab) {
  contextMenuVisible.value = true
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTab.value = tab
}

function hideContextMenu() {
  contextMenuVisible.value = false
  contextMenuTab.value = null
}

function handleToggleMute() {
  if (contextMenuTab.value) {
    dockerStore.toggleMute(contextMenuTab.value.id)
  }
  hideContextMenu()
}

function handleCloseTab() {
  if (contextMenuTab.value) {
    closeTab(contextMenuTab.value.id)
  }
  hideContextMenu()
}

function handleClickOutside(event: MouseEvent) {
  if (contextMenuVisible.value) {
    hideContextMenu()
  }
}

watch(tabs, (newTabs) => {
  if (newTabs.length > 0) {
    isHidden.value = false
  }
})

onUnmounted(() => {
  cancelHideTimer()
  document.removeEventListener('click', handleClickOutside)
})

document.addEventListener('click', handleClickOutside)
</script>

<style lang="scss" scoped>
.docker-wrapper {
  position: relative;
}

.docker-trigger {
  height: 3px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  
  &:hover {
    background-color: var(--primary-color);
  }
}

.docker-bar {
  background-color: var(--sidebar-bg, #f5f7fa);
  border-bottom: 1px solid var(--border-color, #e4e7ed);
  transition: all 0.3s ease;
  
  &.collapsed {
    .docker-header {
      padding: 4px 12px;
    }
  }
  
  &.hidden {
    height: 0;
    overflow: hidden;
    border-bottom: none;
    padding: 0;
    
    .docker-header,
    .docker-tabs {
      opacity: 0;
      margin: 0;
      padding: 0;
      height: 0;
    }
  }
}

.docker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e4e7ed);
  transition: all 0.3s ease;
}

.docker-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  
  &:hover {
    opacity: 0.8;
  }
}

.toggle-icon {
  transition: transform 0.3s ease;
  
  &.rotated {
    transform: rotate(-90deg);
  }
}

.tab-count {
  margin-left: 4px;
}

.docker-actions {
  display: flex;
  gap: 4px;
}

.docker-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  max-height: 80px;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.5;
  padding: 4px 0;
}

.docker-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  max-width: 150px;
  
  &:hover {
    background-color: var(--hover-bg, #ecf5ff);
    border-color: var(--primary-color);
  }
  
  &.active {
    background-color: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    
    .close-btn {
      color: white;
    }
  }
}

.tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.close-btn {
  padding: 0;
  width: 16px;
  height: 16px;
  color: var(--text-color);
  opacity: 0.6;
  
  &:hover {
    opacity: 1;
  }
}

.mute-icon {
  color: var(--text-color);
  opacity: 0.6;
}

.docker-tab.muted {
  opacity: 0.7;
}

.context-menu {
  position: fixed;
  background-color: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  z-index: 9999;
  min-width: 120px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color);
  transition: background-color 0.2s;
  
  &:hover {
    background-color: var(--hover-bg, #ecf5ff);
  }
}
</style>
