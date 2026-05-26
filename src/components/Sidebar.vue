<template>
  <div class="sidebar">
    <div class="platform-list">
      <div
        v-for="platform in platforms"
        :key="platform.id"
        class="platform-item"
        :class="{ active: currentPlatform === platform.id }"
        @click="selectPlatform(platform.id)"
      >
        <PlatformIcon :platform="platform.id" :size="24" />
        <span class="platform-name">{{ platform.name }}</span>
        <el-badge v-if="getLiveCount(platform.id) > 0" :value="getLiveCount(platform.id)" type="success" />
      </div>
    </div>

    <el-divider />

    <div class="follow-section">
      <div class="section-header">
        <span>关注列表</span>
        <div class="header-actions">
          <span v-if="lastRefreshText" class="refresh-time">{{ lastRefreshText }}</span>
          <el-button link @click="refreshFollows" :loading="followStore.loading">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>
      <FollowList :platform="currentPlatform" />
    </div>

    <div class="sidebar-footer">
      <el-button link @click="goToSettings">
        <el-icon><Setting /></el-icon>
        <span>设置</span>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useFollowStore } from '@/stores/follow'
import PlatformIcon from './PlatformIcon.vue'
import FollowList from './FollowList.vue'
import type { Platform } from '../../electron/preload'

const router = useRouter()
const accountStore = useAccountStore()
const followStore = useFollowStore()

const platforms = [
  { id: 'huya' as Platform, name: '虎牙' },
  { id: 'douyin' as Platform, name: '抖音' },
  { id: 'douyu' as Platform, name: '斗鱼' },
  { id: 'bilibili' as Platform, name: 'B站' }
]

const currentPlatform = computed(() => accountStore.currentPlatform)

const lastRefreshText = computed(() => {
  const ts = followStore.lastRefreshTime[currentPlatform.value]
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return '刚刚'
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

function selectPlatform(platform: Platform) {
  accountStore.setCurrentPlatform(platform)
  followStore.loadFollows(platform)
}

function getLiveCount(platform: Platform): number {
  return followStore.getLiveAnchors(platform).length
}

async function refreshFollows() {
  const platform = currentPlatform.value
  window.dispatchEvent(new CustomEvent('cancel-extraction', { detail: { platform } }))
  const result = await followStore.refreshFollows(platform)
  followStore.setRefreshTime(platform)
  
  if (result.success && result.anchors && result.anchors.length > 0 && !result.fromCache) {
    return
  }
  
  window.dispatchEvent(new CustomEvent('refresh-follows', { detail: { platform } }))
}

function goToSettings() {
  router.push('/settings')
}

function handleFollowsUpdated(event: CustomEvent) {
  const { platform } = event.detail
  followStore.loadFollows(platform)
}

onMounted(() => {
  followStore.loadFollows(currentPlatform.value)
  window.addEventListener('follows-updated', handleFollowsUpdated as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('follows-updated', handleFollowsUpdated as EventListener)
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background-color: var(--sidebar-bg, #f5f7fa);
  border-right: 1px solid var(--border-color, #e4e7ed);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.platform-list {
  padding: 8px;
}

.platform-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;

  &:hover {
    background-color: var(--hover-bg, #ecf5ff);
  }

  &.active {
    background-color: var(--primary-color);
    color: white;
  }

  .platform-name {
    margin-left: 12px;
    flex: 1;
    font-size: 14px;
  }
}

.el-divider {
  margin: 8px 0;
}

.follow-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
  font-size: 13px;
  color: var(--text-color);
  opacity: 0.7;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.refresh-time {
  font-size: 11px;
  color: var(--text-color);
  opacity: 0.5;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-color, #e4e7ed);
}
</style>
