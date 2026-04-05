<template>
  <div class="follow-list" v-loading="loading">
    <div v-if="list.length === 0" class="empty-state">
      <el-empty description="暂无关注" :image-size="80" />
    </div>
    <div v-else class="anchor-list">
      <div class="live-section" v-if="liveAnchors.length > 0">
        <div class="section-title">
          <span class="live-dot"></span>
          直播中 ({{ liveAnchors.length }})
        </div>
        <AnchorCard
          v-for="anchor in liveAnchors"
          :key="anchor.id"
          :anchor="anchor"
          @click="goToRoom(anchor)"
        />
      </div>
      <div class="offline-section" v-if="offlineAnchors.length > 0">
        <div class="section-title">
          未开播 ({{ offlineAnchors.length }})
        </div>
        <AnchorCard
          v-for="anchor in offlineAnchors"
          :key="anchor.id"
          :anchor="anchor"
          @click="goToRoom(anchor)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFollowStore } from '@/stores/follow'
import { useAccountStore } from '@/stores/account'
import AnchorCard from './AnchorCard.vue'
import type { Platform, FollowedAnchor } from '../../electron/preload'

const props = defineProps<{
  platform: Platform
}>()

const followStore = useFollowStore()
const accountStore = useAccountStore()

const loading = computed(() => followStore.loading)
const list = computed(() => followStore.follows[props.platform] || [])
const liveAnchors = computed(() => followStore.getLiveAnchors(props.platform))
const offlineAnchors = computed(() => followStore.getOfflineAnchors(props.platform))

function goToRoom(anchor: FollowedAnchor) {
  accountStore.setCurrentPlatform(props.platform)
  window.dispatchEvent(new CustomEvent('navigate-to-room', { 
    detail: { 
      platform: props.platform, 
      roomId: anchor.roomId,
      nickname: anchor.nickname,
      avatar: anchor.avatar
    } 
  }))
}
</script>

<style lang="scss" scoped>
.follow-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.empty-state {
  padding: 20px;
}

.anchor-list {
  padding: 4px;
}

.section-title {
  font-size: 12px;
  color: var(--text-color);
  opacity: 0.6;
  padding: 8px 4px 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--live-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
