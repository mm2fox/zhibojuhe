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
        <el-button link @click="refreshFollows" :loading="followStore.loading">
          <el-icon><Refresh /></el-icon>
        </el-button>
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
  { id: 'douyu' as Platform, name: '斗鱼' }
]

const currentPlatform = computed(() => accountStore.currentPlatform)

function selectPlatform(platform: Platform) {
  accountStore.setCurrentPlatform(platform)
  followStore.loadFollows(platform)
}

function getLiveCount(platform: Platform): number {
  return followStore.getLiveAnchors(platform).length
}

async function refreshFollows() {
  const platform = currentPlatform.value
  console.log('[Sidebar] Refreshing follows for:', platform)
  
  const result = await followStore.refreshFollows(platform)
  console.log('[Sidebar] API refresh result:', result)
  
  if (result.success && result.anchors && result.anchors.length > 0) {
    console.log('[Sidebar] API returned', result.anchors.length, 'follows')
    return
  }
  
  console.log('[Sidebar] API returned empty, trying WebView refresh')
  window.dispatchEvent(new CustomEvent('refresh-follows', { detail: { platform } }))
}

function goToSettings() {
  router.push('/settings')
}

function handleFollowsUpdated(event: CustomEvent) {
  const { platform, count } = event.detail
  console.log('[Sidebar] Follows updated:', platform, count)
  followStore.loadFollows(platform).then(() => {
    console.log('[Sidebar] loadFollows completed, follows count:', followStore.follows[platform]?.length)
  })
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

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-color, #e4e7ed);
}
</style>
