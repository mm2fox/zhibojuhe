<template>
  <div class="anchor-card" :class="{ live: anchor.isLive }">
    <div class="avatar">
      <el-avatar :size="36" :src="anchor.avatar">
        {{ anchor.nickname.charAt(0) }}
      </el-avatar>
      <span v-if="anchor.isLive" class="live-badge">直播中</span>
    </div>
    <div class="info">
      <div class="nickname">{{ anchor.nickname }}</div>
      <div class="meta">
        <span v-if="anchor.isLive" class="viewer-count">
          <el-icon><View /></el-icon>
          {{ formatViewerCount(anchor.viewerCount) }}
        </span>
        <span v-if="anchor.followerCount" class="follower-count">
          <el-icon><User /></el-icon>
          {{ formatViewerCount(anchor.followerCount) }}
        </span>
        <span v-if="anchor.liveTitle" class="title">{{ anchor.liveTitle }}</span>
      </div>
    </div>
    <el-button
      v-if="showAddToDocker"
      link
      size="small"
      class="add-docker-btn"
      @click.stop="addToDocker"
      title="添加到Docker"
    >
      <el-icon><Plus /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { useDockerStore } from '@/stores/docker'
import { User } from '@element-plus/icons-vue'
import type { FollowedAnchor } from '../../electron/preload'

const props = defineProps<{
  anchor: FollowedAnchor
}>()

const dockerStore = useDockerStore()

const showAddToDocker = computed(() => {
  const tabId = `${props.anchor.platform}-${props.anchor.roomId}`
  return !dockerStore.tabs.find(t => t.id === tabId)
})

function formatViewerCount(count?: number): string {
  if (!count) return '0'
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return String(count)
}

function addToDocker() {
  const anchor = toRaw(props.anchor)
  const tabId = `${anchor.platform}-${anchor.roomId}`
  dockerStore.addTab({
    id: tabId,
    platform: anchor.platform,
    roomId: anchor.roomId,
    nickname: anchor.nickname,
    avatar: anchor.avatar
  })
  
  window.dispatchEvent(new CustomEvent('docker-tab-added', {
    detail: { tabId }
  }))
}
</script>

<style lang="scss" scoped>
.anchor-card {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--hover-bg, #ecf5ff);
    
    .add-docker-btn {
      opacity: 1;
    }
  }

  &.live {
    .nickname {
      color: var(--live-color);
    }
  }
}

.add-docker-btn {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 4px;
  color: var(--primary-color);
  
  &:hover {
    color: var(--primary-color);
  }
}

.avatar {
  position: relative;
  margin-right: 10px;
}

.live-badge {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--live-color);
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  white-space: nowrap;
}

.info {
  flex: 1;
  min-width: 0;
}

.nickname {
  font-size: 13px;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-color);
  opacity: 0.6;
}

.viewer-count {
  display: flex;
  align-items: center;
  gap: 2px;
}

.follower-count {
  display: flex;
  align-items: center;
  gap: 2px;
}

.title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
