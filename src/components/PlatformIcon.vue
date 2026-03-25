<template>
  <div class="platform-icon">
    <svg v-if="platform === 'huya'" :width="size" :height="size" viewBox="0 0 24 24">
      <path :fill="color" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </svg>
    <svg v-else-if="platform === 'douyin'" :width="size" :height="size" viewBox="0 0 24 24">
      <path :fill="color" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
    <svg v-else-if="platform === 'douyu'" :width="size" :height="size" viewBox="0 0 24 24">
      <path :fill="color" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Platform } from '../../electron/preload'

const props = defineProps<{
  platform: Platform
  size?: number
  color?: string
}>()

const size = computed(() => props.size || 24)
const color = computed(() => props.color || 'currentColor')
</script>

<style lang="scss" scoped>
.platform-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
