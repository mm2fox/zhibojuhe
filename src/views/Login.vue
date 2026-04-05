<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>登录账号</span>
        </div>
      </template>

      <div class="platform-select">
        <div class="label">选择平台</div>
        <div class="platform-buttons">
          <el-button
            v-for="platform in platforms"
            :key="platform.id"
            :type="selectedPlatform === platform.id ? 'primary' : 'default'"
            @click="selectPlatform(platform.id)"
          >
            <PlatformIcon :platform="platform.id" :size="20" />
            <span style="margin-left: 8px">{{ platform.name }}</span>
          </el-button>
        </div>
      </div>

      <el-divider />

      <div class="login-area">
        <div v-if="existingAccount" class="already-logged-in">
          <el-alert type="success" :closable="false">
            <template #title>
              已登录账号: {{ existingAccount.nickname || '未设置昵称' }}
            </template>
          </el-alert>
          <div class="account-actions">
            <el-button type="danger" @click="removeAccount">移除账号并重新登录</el-button>
          </div>
        </div>
        
        <div v-else-if="!isLoggingIn" class="login-prompt">
          <p>点击下方按钮开始登录</p>
          <p class="hint">登录成功后会自动保存账号信息</p>
          <el-button type="primary" size="large" @click="startLogin">
            开始登录
          </el-button>
        </div>

        <div v-else class="webview-wrapper">
          <webview
            ref="loginWebviewRef"
            :src="loginUrl"
            :partition="partition"
            allowpopups
            @did-stop-loading="onWebviewLoaded"
          ></webview>
          <div class="login-actions">
            <el-button @click="cancelLogin">取消</el-button>
            <el-button type="primary" @click="extractCookiesFromWebview">提取登录信息</el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAccountStore } from '@/stores/account'
import PlatformIcon from '@/components/PlatformIcon.vue'
import type { Platform } from '../../electron/preload'

const router = useRouter()
const accountStore = useAccountStore()

const platforms = [
  { id: 'huya' as Platform, name: '虎牙' },
  { id: 'douyin' as Platform, name: '抖音' },
  { id: 'douyu' as Platform, name: '斗鱼' }
]

const selectedPlatform = ref<Platform>('huya')
const isLoggingIn = ref(false)
const loginWebviewRef = ref<Electron.WebviewTag | null>(null)

const loginUrls: Record<Platform, string> = {
  huya: 'https://www.huya.com',
  douyin: 'https://www.douyin.com',
  douyu: 'https://www.douyu.com'
}

const loginUrl = computed(() => loginUrls[selectedPlatform.value])
const partition = computed(() => `persist:${selectedPlatform.value}`)

const existingAccount = computed(() => {
  return accountStore.accounts.find(a => a.platform === selectedPlatform.value)
})

function selectPlatform(platform: Platform) {
  selectedPlatform.value = platform
  isLoggingIn.value = false
}

async function startLogin() {
  if (existingAccount.value) {
    await removeAccount()
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  await window.api.platform.clearCookies(selectedPlatform.value)
  isLoggingIn.value = true
  await nextTick()
  setTimeout(() => {
    setupWebviewEvents()
  }, 500)
}

function cancelLogin() {
  isLoggingIn.value = false
}

function onWebviewLoaded() {
  console.log('Webview loaded for', selectedPlatform.value)
}

function handleExternalProtocol(url: string): boolean {
  const externalProtocols = [
    'bytedance://',
    'aweme://',
    'snssdk://',
    'toutiao://',
    'xigua://',
    'weixin://',
    'alipays://',
    'mqq://',
    'mqqwpa://',
    'mttbrowser://',
    'baiduboxapp://',
    'sinaweibo://'
  ]
  
  const lowerUrl = url.toLowerCase()
  for (const protocol of externalProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.log('[Login] Blocked external protocol:', url)
      return true
    }
  }
  return false
}

function handleWillNavigate(event: any) {
  const url = event.url || ''
  console.log('[Login] will-navigate to:', url)
  
  if (handleExternalProtocol(url)) {
    event.preventDefault()
    return
  }
}

function handleNewWindow(event: any) {
  const url = event.url || event.disposition || ''
  console.log('[Login] new-window request:', url)
  
  if (typeof url === 'string' && handleExternalProtocol(url)) {
    event.preventDefault()
    return
  }
  
  if (event.preventDefault) {
    event.preventDefault()
  }
}

function applyMuteState() {
  if (!loginWebviewRef.value) return
  try {
    loginWebviewRef.value.setAudioMuted(true)
    console.log('[Login] Mute state applied: true')
  } catch (error) {
    console.log('[Login] Failed to set mute state:', error)
  }
}

function setupWebviewEvents() {
  if (!loginWebviewRef.value) return
  
  loginWebviewRef.value.addEventListener('will-navigate', handleWillNavigate)
  loginWebviewRef.value.addEventListener('new-window', handleNewWindow)
  
  loginWebviewRef.value.addEventListener('dom-ready', () => {
    setTimeout(applyMuteState, 100)
  })
  
  loginWebviewRef.value.addEventListener('did-start-loading', applyMuteState)
  
  loginWebviewRef.value.addEventListener('did-stop-loading', () => {
    setTimeout(applyMuteState, 100)
  })
  
  loginWebviewRef.value.addEventListener('did-start-navigation', () => {
    setTimeout(applyMuteState, 100)
  })
  
  applyMuteState()
}

function verifyLogin(platform: Platform, cookieString: string): { isLoggedIn: boolean; reason: string } {
  switch (platform) {
    case 'huya': {
      const hasUid = cookieString.includes('yyuid=') || cookieString.includes('uid=') || cookieString.includes('userName')
      return {
        isLoggedIn: hasUid,
        reason: hasUid ? '' : '未检测到虎牙用户信息，请确保已完成登录'
      }
    }
    case 'douyin': {
      const hasSid = cookieString.includes('sessionid=') ||
                     cookieString.includes('sid_tt=') ||
                     cookieString.includes('sid_guard=') ||
                     cookieString.includes('uid_tt=')
      const hasAc = cookieString.includes('__ac_nonce=') && cookieString.includes('__ac_signature=')
      return {
        isLoggedIn: hasSid || hasAc,
        reason: (!hasSid && !hasAc) ? '未检测到抖音登录凭证 (sessionid/sid_tt/uid_tt 或 __ac_nonce/__ac_signature)' : ''
      }
    }
    case 'douyu': {
      const hasUid = cookieString.includes('acf_uid=') || cookieString.includes('dy_username=') || cookieString.includes('acf_auth=')
      return {
        isLoggedIn: hasUid,
        reason: hasUid ? '' : '未检测到斗鱼用户ID (acf_uid/dy_username)'
      }
    }
    default:
      return { isLoggedIn: false, reason: '未知平台' }
  }
}

async function extractCookiesFromWebview() {
  if (!loginWebviewRef.value) {
    ElMessage.error('WebView 未加载')
    return
  }

  try {
    ElMessage.info('正在提取登录信息...')

    const script = `
      new Promise((resolve, reject) => {
        try {
          const cookies = document.cookie;
          const result = {
            success: true,
            cookies: cookies,
            platform: '${selectedPlatform.value}'
          };
          resolve(result);
        } catch (error) {
          reject({ success: false, error: error.message });
        }
      })
    `

    loginWebviewRef.value.executeJavaScript(script).then(async (result: any) => {
      if (result && result.success) {
        const platform = selectedPlatform.value
        
        await new Promise(resolve => setTimeout(resolve, 500))

        const sessionCookies = await window.api.platform.extractCookies(platform)
        const allCookies = sessionCookies.cookies || result.cookies || ''

        const verification = verifyLogin(platform, allCookies)

        if (!verification.isLoggedIn) {
          ElMessage.error(verification.reason)
          return
        }

        await accountStore.saveAccount({
          platform: platform,
          cookies: allCookies,
          nickname: '',
          status: 'active',
          loginTime: Date.now(),
          lastActiveTime: Date.now()
        })

        ElMessage.success('登录成功！')
        isLoggingIn.value = false
      } else {
        ElMessage.error('获取登录信息失败，请确保已完成登录')
      }
    }).catch((error: any) => {
      console.error('Execute script failed:', error)
      ElMessage.error('提取登录信息失败: ' + (error.message || '未知错误'))
    })
  } catch (error: any) {
    console.error('Failed to extract cookies:', error)
    ElMessage.error('提取登录信息失败: ' + (error.message || '未知错误'))
  }
}

async function removeAccount() {
  if (existingAccount.value) {
    const platform = existingAccount.value.platform
    await accountStore.deleteAccount(existingAccount.value.id)
    await window.api.platform.clearCookies(platform)
    ElMessage.success('账号已移除，请重新登录')
    await accountStore.loadAccounts()
  }
}

watch(selectedPlatform, () => {
  isLoggingIn.value = false
})
</script>

<style lang="scss" scoped>
.login-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  align-items: center;
  min-height: 0;
}

.login-card {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  flex-shrink: 0;
}

.card-header {
  font-size: 16px;
  font-weight: 500;
}

.platform-select {
  .label {
    font-size: 14px;
    color: var(--text-color);
    margin-bottom: 12px;
  }
}

.platform-buttons {
  display: flex;
  gap: 12px;
}

.login-area {
  min-height: 200px;
}

.login-prompt {
  text-align: center;
  padding: 40px 0;

  p {
    margin-bottom: 8px;
    color: var(--text-color);
  }

  .hint {
    font-size: 12px;
    opacity: 0.6;
    margin-bottom: 20px;
  }
}

.webview-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;

  webview {
    width: 100%;
    height: 600px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: auto;
  }
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.already-logged-in {
  text-align: center;
  padding: 20px 0;
}

.account-actions {
  margin-top: 20px;
}
</style>
