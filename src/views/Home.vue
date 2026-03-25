<template>
  <div class="home-page">
    <div v-if="!hasAccount" class="login-prompt">
      <el-card class="prompt-card">
        <template #header>
          <div class="card-header">
            <span>欢迎使用直播平台账号聚合管理器</span>
          </div>
        </template>
        <div class="prompt-content">
          <p>请先登录您的直播平台账号</p>
          <el-button type="primary" @click="goToLogin">立即登录</el-button>
        </div>
      </el-card>
    </div>
    <WebView v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useSettingsStore } from '@/stores/settings'
import WebView from '@/components/WebView.vue'

const router = useRouter()
const accountStore = useAccountStore()
const settingsStore = useSettingsStore()

const hasAccount = computed(() => {
  return accountStore.accounts.some(a => a.platform === accountStore.currentPlatform)
})

function goToLogin() {
  router.push('/login')
}

onMounted(() => {
  accountStore.loadAccounts()
  settingsStore.loadSettings()
})
</script>

<style lang="scss" scoped>
.home-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-card {
  width: 400px;
}

.card-header {
  font-size: 16px;
  font-weight: 500;
}

.prompt-content {
  text-align: center;
  padding: 20px 0;

  p {
    margin-bottom: 20px;
    color: var(--text-color);
    opacity: 0.7;
  }
}
</style>
