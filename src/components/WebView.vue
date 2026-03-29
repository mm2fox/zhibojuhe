<template>
  <div class="webview-manager" :class="layoutClass">
    <div class="webview-wrapper main-webview" :class="{ active: !activeTab && !isSplitMode }">
      <webview
        ref="mainWebviewRef"
        :src="mainUrl"
        :partition="mainPartition"
        allowpopups
      ></webview>
      <div v-if="mainLoading" class="loading-overlay">
        <el-icon class="loading-icon"><Loading /></el-icon>
      </div>
    </div>
    
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="webview-wrapper"
      :class="getTabClass(tab)"
    >
      <template v-if="isSplitMode && tab.inSplit !== false && !selectedNonSplitTab">
        <div class="split-hover-trigger"></div>
        <div class="split-header">
          <PlatformIcon :platform="tab.platform" :size="14" />
          <span class="split-title">{{ tab.nickname }}</span>
          <el-button
            link
            size="small"
            class="split-close"
            @click.stop="toggleInSplit(tab.id)"
            title="退出分屏"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>
      <webview
        :ref="el => setWebviewRef(tab.id, el)"
        :src="getTabUrl(tab)"
        :partition="getTabPartition(tab)"
        allowpopups
      ></webview>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useDockerStore } from '@/stores/docker'
import PlatformIcon from './PlatformIcon.vue'
import type { Platform, DockerTab } from '../../electron/preload'

const accountStore = useAccountStore()
const dockerStore = useDockerStore()

const mainWebviewRef = ref<Electron.WebviewTag | null>(null)
const webviewRefs = ref<Map<string, Electron.WebviewTag>>(new Map())
const mainLoading = ref(true)
const cookieInjected = ref<Record<Platform, boolean>>({
  huya: false,
  douyin: false,
  douyu: false
})
const dockerCookieInjected = ref<Set<string>>(new Set())

const platformUrls: Record<Platform, string> = {
  huya: 'https://www.huya.com/myfollow',
  douyin: 'https://www.douyin.com/follow',
  douyu: 'https://www.douyu.com/directory/myFollow'
}

const roomUrls: Record<Platform, (roomId: string) => string> = {
  huya: (roomId: string) => `https://www.huya.com/${roomId}`,
  douyin: (roomId: string) => `https://live.douyin.com/${roomId}`,
  douyu: (roomId: string) => `https://www.douyu.com/${roomId}`
}

const currentPlatform = computed(() => accountStore.currentPlatform)
const tabs = computed(() => dockerStore.tabs)
const activeTabId = computed(() => dockerStore.activeTabId)
const activeTab = computed(() => dockerStore.activeTab)
const splitMode = computed(() => dockerStore.splitMode)

const isSplitMode = computed(() => splitMode.value === 'split' && tabs.value.length > 0)

const displayTabs = computed(() => {
  return tabs.value.filter(t => t.inSplit !== false).slice(0, 4)
})

const selectedNonSplitTab = computed(() => {
  if (!isSplitMode.value || !activeTab.value) return false
  return activeTab.value.inSplit === false
})

function shouldShowTab(tab: DockerTab): boolean {
  if (!isSplitMode.value) {
    return activeTabId.value === tab.id
  }
  
  if (selectedNonSplitTab.value) {
    return activeTabId.value === tab.id
  }
  
  if (tab.inSplit === false) {
    return false
  }
  
  const splitTabs = tabs.value.filter(t => t.inSplit !== false)
  const tabIndex = splitTabs.findIndex(t => t.id === tab.id)
  return tabIndex >= 0 && tabIndex < 4
}

function getTabClass(tab: DockerTab): Record<string, boolean> {
  const isVisible = shouldShowTab(tab)
  const isSplitView = isSplitMode.value && tab.inSplit !== false && !selectedNonSplitTab.value
  
  return {
    active: isVisible,
    'split-view': isSplitView,
    'in-split-display': isSplitView,
    'non-split-tab': isSplitMode.value && tab.inSplit === false
  }
}

const layoutClass = computed(() => {
  if (!isSplitMode.value || selectedNonSplitTab.value) return ''
  const count = displayTabs.value.length
  if (count === 1) return 'layout-single'
  if (count === 2) return 'layout-split-2'
  return 'layout-split-4'
})

const mainUrl = computed(() => platformUrls[currentPlatform.value])
const mainPartition = computed(() => `persist:${currentPlatform.value}`)

function setWebviewRef(id: string, el: any) {
  if (el) {
    webviewRefs.value.set(id, el)
    setupDockerWebviewEvents(el, id)
  }
}

function getTabUrl(tab: DockerTab): string {
  return roomUrls[tab.platform](tab.roomId)
}

function getTabPartition(tab: DockerTab): string {
  return `persist:${tab.platform}`
}

function handleNavigateToRoom(event: CustomEvent) {
  const { platform, roomId, nickname, avatar } = event.detail
  const tabId = `${platform}-${roomId}`
  
  const existingTab = dockerStore.getTabById(tabId)
  if (existingTab) {
    dockerStore.setActiveTab(tabId)
  } else {
    dockerStore.addTab({
      id: tabId,
      platform,
      roomId,
      nickname: nickname || roomId,
      avatar: avatar || ''
    })
  }
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

function toggleInSplit(id: string) {
  dockerStore.toggleInSplit(id)
}

async function scrollToLoadMore(webview: Electron.WebviewTag) {
  if (!webview) return
  
  const scrollScript = `
    (function() {
      return new Promise(function(resolve) {
        var maxScrolls = 30;
        var scrollCount = 0;
        var lastCount = 0;
        var noChangeCount = 0;
        
        function getLiCount() {
          return document.querySelectorAll('ul.live-list > li, .live-list li, [class*="follow-list"] li').length;
        }
        
        function doScroll() {
          window.scrollTo(0, document.documentElement.scrollHeight);
          scrollCount++;
          
          setTimeout(function() {
            var newCount = getLiCount();
            
            if (newCount === lastCount) {
              noChangeCount++;
            } else {
              noChangeCount = 0;
              lastCount = newCount;
            }
            
            if (scrollCount < maxScrolls && noChangeCount < 3) {
              setTimeout(doScroll, 1000);
            } else {
              window.scrollTo(0, 0);
              resolve({ scrolls: scrollCount, finalCount: newCount });
            }
          }, 1500);
        }
        
        lastCount = getLiCount();
        doScroll();
      });
    })()
  `
  
  try {
    await webview.executeJavaScript(scrollScript)
  } catch (error) {
    console.error('[WebView] Scroll failed:', error)
  }
}

async function extractFollowsFromWebview(webview: Electron.WebviewTag, platform: Platform) {
  if (!webview) return

  let script = ''

  if (platform === 'huya') {
    script = `
      (function() {
        return new Promise(function(resolve) {
          try {
            var follows = [];
            var liItems = document.querySelectorAll('ul.live-list > li, .live-list li, [class*="follow-list"] li');
            
            liItems.forEach(function(li) {
              var link = li.querySelector('a[href*="huya.com/"]');
              if (!link) return;
              var href = link.getAttribute('href') || '';
              
              var roomId = '';
              var roomIdMatch = href.match(/huya\\.com\\/([a-zA-Z0-9_]+)/) || href.match(/\\/([a-zA-Z0-9_]+)$/);
              if (roomIdMatch) roomId = roomIdMatch[1];
              if (!roomId || roomId.length < 2) return;
              
              var nameEl = li.querySelector('[title], .name, .nick, .anchor-name');
              var name = nameEl ? (nameEl.getAttribute('title') || nameEl.textContent.trim()) : '';
              if (!name) return;
              
              var avatarEl = li.querySelector('img');
              var avatar = avatarEl ? (avatarEl.src || avatarEl.getAttribute('data-src') || '') : '';
              
              var isLive = false;
              var liHtml = li.outerHTML || '';
              if (liHtml.indexOf('直播中') !== -1 || liHtml.indexOf('正在直播') !== -1) isLive = true;
              if (li.querySelector('.is-live, [class*="isLive"]')) isLive = true;
              
              follows.push({
                id: 'huya-' + roomId,
                platform: 'huya',
                anchorId: roomId,
                nickname: name,
                avatar: avatar,
                roomId: roomId,
                isLive: isLive,
                viewerCount: 0,
                liveTitle: '',
                liveCover: '',
                updateTime: Date.now()
              });
            });
            
            resolve({ success: true, follows: follows, count: follows.length });
          } catch (error) {
            resolve({ success: false, follows: [], error: error.message });
          }
        });
      })()
    `
  } else if (platform === 'douyin') {
    script = `
      (function() {
        return new Promise(function(resolve) {
          try {
            var follows = [];
            var liveLinks = document.querySelectorAll('a[href*="live.douyin.com/"]');
            var uniqueRooms = new Map();
            
            liveLinks.forEach(function(link) {
              var href = link.getAttribute('href') || '';
              var match = href.match(/live\\.douyin\\.com\\/(\\d+)/);
              if (match && !uniqueRooms.has(match[1])) {
                uniqueRooms.set(match[1], link);
              }
            });
            
            uniqueRooms.forEach(function(link, roomId) {
              var li = link.closest('li') || link;
              var name = '';
              var imgEl = li.querySelector('img[alt]');
              if (imgEl) name = imgEl.getAttribute('alt') || '';
              if (!name) {
                var nameSpan = li.querySelector('.arnSiSbK, [class*="name"]');
                if (nameSpan) name = (nameSpan.textContent || '').trim();
              }
              
              var avatar = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
              
              if (name && name.length > 0 && name.length < 50) {
                follows.push({
                  id: 'douyin-' + roomId,
                  platform: 'douyin',
                  anchorId: roomId,
                  nickname: name,
                  avatar: avatar,
                  roomId: roomId,
                  secUid: '',
                  isLive: true,
                  viewerCount: 0,
                  liveTitle: '',
                  liveCover: '',
                  updateTime: Date.now()
                });
              }
            });
            
            resolve({ success: true, follows: follows, count: follows.length });
          } catch (error) {
            resolve({ success: false, follows: [], error: error.message });
          }
        });
      })()
    `
  } else if (platform === 'douyu') {
    script = `
      (function() {
        return new Promise(function(resolve) {
          try {
            var follows = [];
            var liItems = document.querySelectorAll('li.DyListCover-item, .follow-list li, ul.follow-list > li, [class*="follow"] li, .layout-Cover-item');
            
            liItems.forEach(function(li) {
              var link = li.querySelector('a[href*="douyu.com/"]');
              if (!link) return;
              var href = link.getAttribute('href') || '';
              
              var roomId = '';
              var roomIdMatch = href.match(/douyu\\.com\\/([a-zA-Z0-9]+)/);
              if (roomIdMatch) roomId = roomIdMatch[1];
              if (!roomId) return;
              
              var nameEl = li.querySelector('.DyListCover-zone, h3, .title, [class*="name"]');
              var name = '';
              if (nameEl) name = nameEl.getAttribute('title') || nameEl.textContent.trim();
              if (!name) {
                var titleEl = li.querySelector('[title]');
                if (titleEl) name = titleEl.getAttribute('title');
              }
              if (!name) return;
              
              var avatarEl = li.querySelector('img');
              var avatar = avatarEl ? (avatarEl.src || avatarEl.getAttribute('data-src') || '') : '';
              
              var isLive = false;
              var liHtml = li.outerHTML || '';
              if (liHtml.indexOf('is-live') !== -1 || liHtml.indexOf('直播中') !== -1) isLive = true;
              if (li.querySelector('.DyListCover-isLive, [class*="isLive"], .is-live')) isLive = true;
              
              var viewerCount = 0;
              var countEl = li.querySelector('.DyListCover-hot, [class*="hot"], [class*="view"]');
              if (countEl) {
                var countText = countEl.textContent.trim();
                if (countText.indexOf('万') !== -1) {
                  viewerCount = parseFloat(countText) * 10000;
                } else {
                  viewerCount = parseInt(countText) || 0;
                }
              }
              
              follows.push({
                id: 'douyu-' + roomId,
                platform: 'douyu',
                anchorId: roomId,
                nickname: name,
                avatar: avatar,
                roomId: roomId,
                isLive: isLive,
                viewerCount: viewerCount,
                liveTitle: '',
                liveCover: '',
                updateTime: Date.now()
              });
            });
            
            resolve({ success: true, follows: follows, count: follows.length });
          } catch (error) {
            resolve({ success: false, follows: [], error: error.message });
          }
        });
      })()
    `
  } else {
    script = 'Promise.resolve({ success: true, follows: [], count: 0 })'
  }

  try {
    const result = await webview.executeJavaScript(script)
    if (result && result.success && result.follows && result.follows.length > 0) {
      await window.api.follow.updateFromWebview(platform, JSON.stringify(result.follows))
      window.dispatchEvent(new CustomEvent('follows-updated', { 
        detail: { platform, count: result.follows.length } 
      }))
    }
  } catch (error) {
    console.error(`[${platform}] Failed to extract follows:`, error)
  }
}

function handleExternalProtocol(url: string): boolean {
  const externalProtocols = [
    'bytedance://', 'aweme://', 'snssdk://', 'toutiao://', 'xigua://',
    'weixin://', 'alipays://', 'mqq://', 'mqqwpa://', 'mttbrowser://',
    'baiduboxapp://', 'sinaweibo://'
  ]
  
  const lowerUrl = url.toLowerCase()
  return externalProtocols.some(p => lowerUrl.startsWith(p))
}

function setupDockerWebviewEvents(webview: Electron.WebviewTag, tabId: string) {
  const tab = dockerStore.getTabById(tabId)
  if (!tab) return

  const platform = tab.platform
  
  webview.addEventListener('did-stop-loading', async () => {
    if (!dockerCookieInjected.value.has(tabId)) {
      const account = accountStore.accounts.find(a => a.platform === platform)
      if (account && account.cookies) {
        console.log(`[Docker ${tabId}] Injecting cookies for ${platform}`)
        const result = await window.api.platform.injectCookies(platform, account.cookies)
        if (result.success && result.injected > 0) {
          dockerCookieInjected.value.add(tabId)
          console.log(`[Docker ${tabId}] Cookies injected, reloading`)
          webview.reload()
        }
      }
    }
    
    const currentTab = dockerStore.getTabById(tabId)
    if (currentTab?.muted) {
      webview.setAudioMuted(true)
    }
  })

  webview.addEventListener('will-navigate', (event: any) => {
    if (handleExternalProtocol(event.url)) {
      event.preventDefault()
    }
  })

  webview.addEventListener('new-window', (event: any) => {
    event.preventDefault()
  })

  webview.addEventListener('did-start-navigation', (event: any) => {
    if (handleExternalProtocol(event.url)) {
      webview.stop()
    }
  })
}

function setupMainWebviewEvents(webview: Electron.WebviewTag, platform: Platform) {
  webview.addEventListener('did-start-loading', () => {
    mainLoading.value = true
  })

  webview.addEventListener('did-stop-loading', async () => {
    mainLoading.value = false

    const account = accountStore.accounts.find(a => a.platform === platform)
    if (account && account.cookies && !cookieInjected.value[platform]) {
      console.log(`[Main] Injecting cookies for ${platform}`)
      const result = await window.api.platform.injectCookies(platform, account.cookies)
      if (result.success && result.injected > 0) {
        cookieInjected.value[platform] = true
        console.log(`[Main] Cookies injected, reloading`)
        webview.reload()
        return
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000))
    
    if (platform === 'huya' || platform === 'douyu') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await scrollToLoadMore(webview)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    await extractFollowsFromWebview(webview, platform)
  })

  webview.addEventListener('did-finish-load', () => {
    mainLoading.value = false
  })

  webview.addEventListener('did-fail-load', (event: any) => {
    console.error('Webview failed to load:', event)
    mainLoading.value = false
  })

  webview.addEventListener('will-navigate', (event: any) => {
    if (handleExternalProtocol(event.url)) {
      event.preventDefault()
    }
  })

  webview.addEventListener('new-window', (event: any) => {
    event.preventDefault()
  })

  webview.addEventListener('did-start-navigation', (event: any) => {
    if (handleExternalProtocol(event.url)) {
      webview.stop()
    }
  })
}

watch(currentPlatform, () => {
  cookieInjected.value[currentPlatform.value] = false
})

watch(tabs, (newTabs, oldTabs) => {
  const oldIds = new Set(oldTabs?.map(t => t.id) || [])
  newTabs.forEach(tab => {
    if (!oldIds.has(tab.id)) {
      dockerCookieInjected.value.delete(tab.id)
    }
  })
}, { deep: true })

onMounted(async () => {
  await accountStore.loadAccounts()
  
  window.addEventListener('navigate-to-room', handleNavigateToRoom as EventListener)
  
  window.addEventListener('refresh-follows', async () => {
    dockerStore.setActiveTab(null)
    if (mainWebviewRef.value) {
      mainWebviewRef.value.src = platformUrls[currentPlatform.value]
    }
  })
  
  window.addEventListener('docker-cleared', () => {
    if (mainWebviewRef.value) {
      mainWebviewRef.value.src = platformUrls[currentPlatform.value]
    }
  })

  window.addEventListener('docker-mute-changed', ((event: CustomEvent) => {
    const { tabId, muted } = event.detail
    const webview = webviewRefs.value.get(tabId)
    if (webview) {
      webview.setAudioMuted(muted)
    }
  }) as EventListener)

  window.api.docker.onTabSwitched((tabId: string) => {
    dockerStore.setActiveTab(tabId)
    window.dispatchEvent(new CustomEvent('docker-tab-selected', {
      detail: { tabId }
    }))
  })

  window.api.docker.onMuteToggled((tabId: string, muted: boolean) => {
    const tab = dockerStore.getTabById(tabId)
    if (tab) {
      tab.muted = muted
    }
    const webview = webviewRefs.value.get(tabId)
    if (webview) {
      webview.setAudioMuted(muted)
    }
  })

  window.api.docker.onTabClosed((tabId: string) => {
    webviewRefs.value.delete(tabId)
    dockerCookieInjected.value.delete(tabId)
    
    const index = dockerStore.tabs.findIndex(t => t.id === tabId)
    if (index >= 0) {
      dockerStore.tabs.splice(index, 1)
    }
    
    if (dockerStore.tabs.length === 0) {
      dockerStore.activeTabId = null
      window.dispatchEvent(new CustomEvent('docker-cleared'))
    } else if (dockerStore.activeTabId === tabId) {
      const newIndex = Math.min(index, dockerStore.tabs.length - 1)
      dockerStore.activeTabId = dockerStore.tabs[newIndex]?.id || null
      if (dockerStore.activeTabId) {
        window.dispatchEvent(new CustomEvent('docker-tab-selected', {
          detail: { tabId: dockerStore.activeTabId }
        }))
      }
    }
  })

  nextTick(() => {
    if (mainWebviewRef.value) {
      setupMainWebviewEvents(mainWebviewRef.value, currentPlatform.value)
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('navigate-to-room', handleNavigateToRoom as EventListener)
  window.removeEventListener('refresh-follows', () => {})
  window.removeEventListener('docker-cleared', () => {})
  window.removeEventListener('docker-mute-changed', () => {})
  window.api.docker.removeTabSwitchedListener()
  window.api.docker.removeMuteToggledListener()
  window.api.docker.removeTabClosedListener()
})
</script>

<style lang="scss" scoped>
.webview-manager {
  flex: 1;
  position: relative;
  overflow: hidden;
  
  &.layout-single {
    .webview-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    
    .main-webview {
      z-index: 2;
    }
  }
  
  &.layout-split-2 {
    display: flex;
    flex-direction: row;
    
    .webview-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;
      pointer-events: none;
      visibility: hidden;
      
      &.in-split-display {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;
        width: 50%;
        border: 1px solid var(--border-color, #e4e7ed);
        z-index: 1;
        pointer-events: auto;
        visibility: visible;
        
        webview {
          flex: 1;
        }
      }
      
      &.non-split-tab.active {
        z-index: 10;
        pointer-events: auto;
        visibility: visible;
      }
    }
    
    .main-webview {
      z-index: 0;
    }
  }
  
  &.layout-split-4 {
    display: flex;
    flex-wrap: wrap;
    
    .webview-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;
      pointer-events: none;
      visibility: hidden;
      
      &.in-split-display {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 50%;
        height: 50%;
        border: 1px solid var(--border-color, #e4e7ed);
        z-index: 1;
        pointer-events: auto;
        visibility: visible;
        
        webview {
          flex: 1;
        }
      }
      
      &.non-split-tab.active {
        z-index: 10;
        pointer-events: auto;
        visibility: visible;
      }
    }
    
    .main-webview {
      z-index: 0;
    }
  }
}

.webview-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  
  &.active {
    z-index: 1;
    pointer-events: auto;
  }
  
  &.split-view {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color, #e4e7ed);
    position: relative;
    
    webview {
      flex: 1;
    }
    
    .split-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .split-hover-trigger {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      z-index: 5;
    }
    
    .split-hover-trigger:hover ~ .split-header,
    .split-header:hover {
      opacity: 1;
    }
  }
}

.split-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: rgba(245, 247, 250, 0.95);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--border-color, #e4e7ed);
  font-size: 12px;
  
  :global(.dark) & {
    background-color: rgba(37, 37, 37, 0.95);
  }
}

.split-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-color);
}

.split-close {
  padding: 0;
  width: 20px;
  height: 20px;
  color: var(--text-color);
  opacity: 0.6;
  
  &:hover {
    opacity: 1;
  }
}

webview {
  width: 100%;
  height: 100%;
  border: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color);
  z-index: 10;
}

.loading-icon {
  font-size: 32px;
  color: var(--primary-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
