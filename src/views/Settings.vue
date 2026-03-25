<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span>设置</span>
        </div>
      </template>

      <el-form label-width="120px">
        <el-form-item label="主题">
          <el-radio-group v-model="theme" @change="updateTheme">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">深色</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="开机自启动">
          <el-switch v-model="autoStart" @change="updateAutoStart" />
        </el-form-item>

        <el-form-item label="最小化到托盘">
          <el-switch v-model="minimizeToTray" @change="updateSettings" />
        </el-form-item>

        <el-divider content-position="left">关注列表</el-divider>

        <el-form-item label="自动刷新">
          <el-switch v-model="autoRefreshFollow" @change="updateSettings" />
        </el-form-item>

        <el-form-item label="刷新间隔">
          <el-select v-model="refreshInterval" @change="updateSettings" :disabled="!autoRefreshFollow">
            <el-option :value="1" label="1 分钟" />
            <el-option :value="5" label="5 分钟" />
            <el-option :value="10" label="10 分钟" />
            <el-option :value="30" label="30 分钟" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">数据管理</el-divider>

        <el-form-item label="账号管理">
          <div class="account-list">
            <div v-for="account in accounts" :key="account.id" class="account-item">
              <div class="account-info">
                <PlatformIcon :platform="account.platform" :size="20" />
                <span class="platform-name">{{ getPlatformName(account.platform) }}</span>
                <span class="nickname">{{ account.nickname || '未设置昵称' }}</span>
              </div>
              <el-button type="danger" text size="small" @click="removeAccount(account.id)">
                移除
              </el-button>
            </div>
            <el-empty v-if="accounts.length === 0" description="暂无已登录账号" :image-size="60" />
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useAccountStore } from '@/stores/account'
import PlatformIcon from '@/components/PlatformIcon.vue'
import type { Platform, PlatformAccount } from '../../electron/preload'

const settingsStore = useSettingsStore()
const accountStore = useAccountStore()

const theme = ref<'light' | 'dark'>('light')
const autoStart = ref(false)
const minimizeToTray = ref(true)
const autoRefreshFollow = ref(true)
const refreshInterval = ref(5)

const accounts = computed(() => accountStore.accounts)

const platformNames: Record<Platform, string> = {
  huya: '虎牙',
  douyin: '抖音',
  douyu: '斗鱼'
}

function getPlatformName(platform: Platform): string {
  return platformNames[platform]
}

async function updateTheme(value: 'light' | 'dark') {
  await settingsStore.updateSettings({ theme: value })
  ElMessage.success('主题已更新')
}

async function updateAutoStart(value: boolean) {
  await settingsStore.setAutoStart(value)
  ElMessage.success(value ? '已开启开机自启动' : '已关闭开机自启动')
}

async function updateSettings() {
  await settingsStore.updateSettings({
    minimizeToTray: minimizeToTray.value,
    autoRefreshFollow: autoRefreshFollow.value,
    refreshInterval: refreshInterval.value
  })
}

async function removeAccount(id: string) {
  try {
    await ElMessageBox.confirm('确定要移除此账号吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await accountStore.deleteAccount(id)
    ElMessage.success('账号已移除')
  } catch {
    // 用户取消
  }
}

onMounted(async () => {
  await settingsStore.loadSettings()
  await accountStore.loadAccounts()
  
  theme.value = settingsStore.settings.theme
  autoStart.value = settingsStore.settings.autoStart
  minimizeToTray.value = settingsStore.settings.minimizeToTray
  autoRefreshFollow.value = settingsStore.settings.autoRefreshFollow
  refreshInterval.value = settingsStore.settings.refreshInterval
})
</script>

<style lang="scss" scoped>
.settings-page {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 20px;
  overflow: auto;
}

.settings-card {
  width: 100%;
  max-width: 600px;
}

.card-header {
  font-size: 16px;
  font-weight: 500;
}

.account-list {
  width: 100%;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
}

.account-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.platform-name {
  font-weight: 500;
}

.nickname {
  color: var(--text-color);
  opacity: 0.6;
  font-size: 13px;
}
</style>
