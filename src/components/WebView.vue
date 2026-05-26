<template>
  <div class="webview-manager" :class="layoutClass">
    <div 
      v-for="platform in platforms" 
      :key="platform"
      class="webview-wrapper main-webview" 
      :class="{ active: currentPlatform === platform && !activeTab && !isSplitMode }"
    >
      <webview
        :ref="el => setMainWebviewRef(platform, el)"
        :src="platformUrls[platform]"
        :partition="`persist:${platform}`"
        allowpopups
        v-show="currentPlatform === platform"
      ></webview>
      <div v-if="mainLoading && currentPlatform === platform" class="loading-overlay">
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

    <div
      v-if="backgroundRefreshPlatform"
      :key="backgroundRefreshKey"
      class="webview-wrapper background-refresh-webview"
    >
      <webview
        :ref="setBackgroundRefreshWebviewRef"
        :src="platformUrls[backgroundRefreshPlatform]"
        :partition="`persist:${backgroundRefreshPlatform}`"
        allowpopups
      ></webview>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useDockerStore } from '@/stores/docker'
import PlatformIcon from './PlatformIcon.vue'
import type { Platform, DockerTab } from '../../electron/preload'

const accountStore = useAccountStore()
const dockerStore = useDockerStore()

const platforms: Platform[] = ['huya', 'douyin', 'douyu']
const mainWebviewRefs = ref<Record<Platform, Electron.WebviewTag | null>>({
  huya: null,
  douyin: null,
  douyu: null
})
const webviewRefs = ref<Map<string, Electron.WebviewTag>>(new Map())
const mainLoading = ref(true)
const cookieInjected = ref<Record<Platform, boolean>>({
  huya: false,
  douyin: false,
  douyu: false
})
const dockerCookieInjected = ref<Set<string>>(new Set())
const webviewEventsSet = ref<Set<string>>(new Set())
const pendingMuteState = ref<Map<string, boolean>>(new Map())
const lastExtractionTime = ref<Record<Platform, number>>({
  huya: 0,
  douyin: 0,
  douyu: 0
})
const extractionId = ref<Record<Platform, number>>({
  huya: 0,
  douyin: 0,
  douyu: 0
})
const backgroundRefreshPlatform = ref<Platform | null>(null)
const backgroundRefreshWebviewRef = ref<Electron.WebviewTag | null>(null)
const backgroundRefreshExtractionId = ref(0)
const backgroundRefreshKey = ref(0)

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

function setMainWebviewRef(platform: Platform, el: any) {
  if (el) {
    const existingRef = mainWebviewRefs.value[platform]
    if (existingRef === el) {
      return
    }
    mainWebviewRefs.value[platform] = el
    if (!webviewEventsSet.value.has(`main-${platform}`)) {
      webviewEventsSet.value.add(`main-${platform}`)
      setupMainWebviewEvents(el, platform)
    }
  }
}

function setWebviewRef(id: string, el: any) {
  if (el) {
    const existingRef = webviewRefs.value.get(id)
    if (existingRef === el) {
      return
    }
    webviewRefs.value.set(id, el)
    
    const tab = dockerStore.getTabById(id)
    if (tab) {
      try {
        el.setAudioMuted(tab.muted !== false)
      } catch (error) {
        // Webview not ready yet, will be set in events
      }
    }
    
    if (!webviewEventsSet.value.has(id)) {
      webviewEventsSet.value.add(id)
      setupDockerWebviewEvents(el, id)
    }
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
    // Webview not ready, ignore
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
            var uniqueRooms = new Map();
            
            var selectors = [
              'ul.live-list > li',
              '.live-list li',
              '[class*="follow-list"] li',
              '.follow-list-item',
              '[class*="subscribe"] li',
              '.subscribe-list li',
              '.my-follow-list li',
              'li[class*="item"]'
            ];
            
            var liItems = [];
            for (var i = 0; i < selectors.length; i++) {
              var items = document.querySelectorAll(selectors[i]);
              if (items.length > 0) {
                liItems = items;
                break;
              }
            }
            
            if (liItems.length === 0) {
              liItems = document.querySelectorAll('li');
            }
            
            liItems.forEach(function(li) {
              var link = li.querySelector('a[href*="huya.com/"]');
              if (!link) return;
              var href = link.getAttribute('href') || '';
              
              var roomId = '';
              var roomIdMatch = href.match(/huya\\.com\\/([a-zA-Z0-9_]+)/) || href.match(/\\/([a-zA-Z0-9_]+)$/);
              if (roomIdMatch) roomId = roomIdMatch[1];
              if (!roomId || roomId.length < 2) return;
              
              if (uniqueRooms.has(roomId)) return;
              
              var nameEl = li.querySelector('[title], .name, .nick, .anchor-name, .txt, [class*="name"]');
              var name = nameEl ? (nameEl.getAttribute('title') || nameEl.textContent.trim()) : '';
              if (!name) {
                var titleAttr = li.getAttribute('title');
                if (titleAttr) name = titleAttr;
              }
              if (!name || name.length > 50) return;
              
              var avatarEl = li.querySelector('img');
              var avatar = avatarEl ? (avatarEl.src || avatarEl.getAttribute('data-src') || '') : '';
              
              var isLive = false;
              var liHtml = li.outerHTML || '';
              var liClass = li.className || '';
              
              if (liHtml.indexOf('直播中') !== -1 || liHtml.indexOf('正在直播') !== -1) isLive = true;
              if (liClass.indexOf('is-live') !== -1 || liClass.indexOf('on-live') !== -1) isLive = true;
              
              var liveBadge = li.querySelector('.live-badge, .live-tag, .LiveBadge');
              if (liveBadge) {
                var badgeText = liveBadge.textContent || '';
                if (badgeText.indexOf('直播') !== -1 || badgeText === 'LIVE') isLive = true;
              }
              
              var liveIcon = li.querySelector('.live-icon, .icon-live, [class*="liveIcon"]');
              if (liveIcon) isLive = true;
              
              // Extract viewer count
              var viewerCount = 0;
              var countEl = li.querySelector('.num, .count, .viewer-count, .hot, [class*="num"], [class*="count"], [class*="hot"]');
              if (countEl) {
                var countText = countEl.textContent.trim();
                var countMatch = countText.match(/[\\d.]+/);
                if (countMatch) {
                  var num = parseFloat(countMatch[0]);
                  if (countText.indexOf('万') !== -1) {
                    viewerCount = Math.floor(num * 10000);
                  } else {
                    viewerCount = Math.floor(num);
                  }
                }
              }
              if (!viewerCount) {
                var numMatch = liHtml.match(/([\\d.]+)\\s*万|([\\d]+)\\s*人/);
                if (numMatch) {
                  if (numMatch[1]) {
                    viewerCount = Math.floor(parseFloat(numMatch[1]) * 10000);
                  } else if (numMatch[2]) {
                    viewerCount = parseInt(numMatch[2]);
                  }
                }
              }
              
              uniqueRooms.set(roomId, true);
              
              follows.push({
                id: 'huya-' + roomId,
                platform: 'huya',
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
            
            var selectors = [
              'li.DyListCover-item',
              '.follow-list li',
              'ul.follow-list > li',
              '[class*="follow"] li',
              '.layout-Cover-item',
              '.List-item',
              '[class*="ListCover"]',
              '.dy-list-con li',
              '.con-box li'
            ];
            
            var liItems = [];
            for (var i = 0; i < selectors.length; i++) {
              var items = document.querySelectorAll(selectors[i]);
              if (items.length > 0) {
                liItems = items;
                break;
              }
            }
            
            if (liItems.length === 0) {
              liItems = document.querySelectorAll('li');
            }
            
            liItems.forEach(function(li) {
              var link = li.querySelector('a[href*="douyu.com/"]');
              if (!link) return;
              var href = link.getAttribute('href') || '';
              
              var roomId = '';
              var roomIdMatch = href.match(/douyu\\.com\\/([a-zA-Z0-9]+)/);
              if (roomIdMatch) roomId = roomIdMatch[1];
              if (!roomId) return;
              
              var nameEl = li.querySelector('.DyListCover-zone, h3, .title, [class*="name"], [class*="nick"]');
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
              if (liHtml.indexOf('is-live') !== -1 || liHtml.indexOf('直播中') !== -1 || liHtml.indexOf('on-live') !== -1) isLive = true;
              if (li.querySelector('.DyListCover-isLive, [class*="isLive"], .is-live, [class*="live"]')) isLive = true;
              
              var viewerCount = 0;
              var countEl = li.querySelector('.DyListCover-hot, [class*="hot"], [class*="view"], [class*="count"]');
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
    console.error(`[WebView] extractFollowsFromWebview error for ${platform}:`, error)
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
  
  function applyMuteState() {
    try {
      const currentTab = dockerStore.getTabById(tabId)
      const shouldMute = currentTab?.muted !== false
      webview.setAudioMuted(shouldMute)
    } catch (error) {
      // Webview not ready, ignore
    }
  }
  
  webview.addEventListener('dom-ready', () => {
    setTimeout(applyMuteState, 100)
  })
  webview.addEventListener('did-start-loading', applyMuteState)
  webview.addEventListener('did-stop-loading', async () => {
    setTimeout(applyMuteState, 100)
    
    if (!dockerCookieInjected.value.has(tabId)) {
      const sessionCookies = await window.api.platform.extractCookies(platform)
      const sessionCookieCount = sessionCookies.count || 0
      const hasSessionCookies = sessionCookieCount > 5
      
      if (!hasSessionCookies) {
        const account = accountStore.accounts.find(a => a.platform === platform)
        if (account && account.cookies) {
          await window.api.platform.injectCookies(platform, account.cookies)
          dockerCookieInjected.value.add(tabId)
          webview.reload()
        }
      } else {
        dockerCookieInjected.value.add(tabId)
      }
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
    setTimeout(applyMuteState, 100)
    if (handleExternalProtocol(event.url)) {
      webview.stop()
    }
  })
}

function setupMainWebviewEvents(webview: Electron.WebviewTag, platform: Platform) {
  function applyMainMuteState() {
    try {
      webview.setAudioMuted(true)
    } catch (error) {
      // Webview not ready, ignore
    }
  }
  
  webview.addEventListener('dom-ready', () => {
    setTimeout(applyMainMuteState, 100)
  })
  
  webview.addEventListener('did-start-loading', () => {
    mainLoading.value = true
    applyMainMuteState()
  })

  webview.addEventListener('did-stop-loading', async () => {
    mainLoading.value = false
    setTimeout(applyMainMuteState, 100)

    const now = Date.now()
    const timeSinceLastExtraction = now - lastExtractionTime.value[platform]
    
    if (timeSinceLastExtraction < 10000) {
      return
    }

    if (!cookieInjected.value[platform]) {
      const sessionCookies = await window.api.platform.extractCookies(platform)
      const sessionCookieCount = sessionCookies.count || 0
      const hasSessionCookies = sessionCookieCount > 5
      
      if (!hasSessionCookies) {
        const account = accountStore.accounts.find(a => a.platform === platform)
        if (account && account.cookies) {
          await window.api.platform.injectCookies(platform, account.cookies)
          cookieInjected.value[platform] = true
          webview.reload()
          return
        }
      } else {
        cookieInjected.value[platform] = true
      }
    }

    lastExtractionTime.value[platform] = now
    const currentExtractionId = ++extractionId.value[platform]
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    if (extractionId.value[platform] !== currentExtractionId) {
      return
    }
    
    if (platform === 'huya' || platform === 'douyu') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await scrollToLoadMore(webview)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    if (extractionId.value[platform] !== currentExtractionId) {
      return
    }
    
    await extractFollowsFromWebview(webview, platform)
  })

  webview.addEventListener('did-finish-load', () => {
    mainLoading.value = false
    setTimeout(applyMainMuteState, 100)
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
    setTimeout(applyMainMuteState, 100)
    if (handleExternalProtocol(event.url)) {
      webview.stop()
    }
  })
  
  applyMainMuteState()
}

function setBackgroundRefreshWebviewRef(el: any) {
  if (el) {
    backgroundRefreshWebviewRef.value = el
    setupBackgroundRefreshWebviewEvents(el)
  }
}

function setupBackgroundRefreshWebviewEvents(webview: Electron.WebviewTag) {
  const platform = backgroundRefreshPlatform.value!
  const refreshId = backgroundRefreshExtractionId.value
  
  let cookieInjected = false
  let isProcessing = false

  const cleanup = () => {
    if (backgroundRefreshExtractionId.value === refreshId) {
      backgroundRefreshPlatform.value = null
    }
  }

  webview.addEventListener('dom-ready', () => {
    try {
      webview.setAudioMuted(true)
    } catch (error) {
      // ignore
    }
  })

  webview.addEventListener('did-stop-loading', async () => {
    if (isProcessing) return
    if (backgroundRefreshExtractionId.value !== refreshId) {
      cleanup()
      return
    }

    try {
      webview.setAudioMuted(true)
    } catch (error) {
      // ignore
    }

    if (!cookieInjected) {
      const sessionCookies = await window.api.platform.extractCookies(platform)
      const sessionCookieCount = sessionCookies.count || 0
      const hasSessionCookies = sessionCookieCount > 5
      
      if (!hasSessionCookies) {
        const account = accountStore.accounts.find(a => a.platform === platform)
        if (account && account.cookies) {
          await window.api.platform.injectCookies(platform, account.cookies)
          cookieInjected = true
          webview.reload()
          return
        }
      } else {
        cookieInjected = true
      }
    }

    isProcessing = true

    await new Promise(resolve => setTimeout(resolve, 3000))
    
    if (backgroundRefreshExtractionId.value !== refreshId) {
      cleanup()
      return
    }
    
    if (platform === 'huya' || platform === 'douyu') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await scrollToLoadMore(webview)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    if (backgroundRefreshExtractionId.value !== refreshId) {
      cleanup()
      return
    }
    
    await extractFollowsFromWebview(webview, platform)
    
    cleanup()
  })

  webview.addEventListener('did-fail-load', (event: any) => {
    console.error('[WebView] Background refresh webview failed to load:', event)
    cleanup()
  })

  webview.addEventListener('will-navigate', (event: any) => {
    if (handleExternalProtocol(event.url)) {
      event.preventDefault()
    }
  })

  webview.addEventListener('new-window', (event: any) => {
    event.preventDefault()
  })

  try {
    webview.setAudioMuted(true)
  } catch (error) {
    // ignore
  }
}

watch(currentPlatform, () => {
  cookieInjected.value[currentPlatform.value] = false
})

watch(tabs, (newTabs, oldTabs) => {
  const oldIds = new Set(oldTabs?.map(t => t.id) || [])
  const newIds = new Set(newTabs?.map(t => t.id) || [])
  
  oldIds.forEach(id => {
    if (!newIds.has(id)) {
      dockerCookieInjected.value.delete(id)
      webviewEventsSet.value.delete(id)
      webviewRefs.value.delete(id)
    }
  })
  
  newTabs.forEach(tab => {
    if (!oldIds.has(tab.id)) {
      dockerCookieInjected.value.delete(tab.id)
    }
  })
}, { deep: true })

onMounted(async () => {
  await accountStore.loadAccounts()
  
  window.addEventListener('navigate-to-room', handleNavigateToRoom as EventListener)
  
  window.addEventListener('refresh-follows', async (event: Event) => {
    const customEvent = event as CustomEvent<{ platform: Platform }>
    const platform = customEvent.detail?.platform || currentPlatform.value
    lastExtractionTime.value[platform] = 0
    
    backgroundRefreshExtractionId.value++
    backgroundRefreshKey.value++
    backgroundRefreshPlatform.value = platform
  })
  
  window.addEventListener('docker-cleared', () => {
    const webview = mainWebviewRefs.value[currentPlatform.value]
    if (webview) {
      webview.src = platformUrls[currentPlatform.value]
    }
  })

  window.addEventListener('docker-mute-changed', ((event: CustomEvent) => {
    const { tabId, muted } = event.detail
    const webview = webviewRefs.value.get(tabId)
    if (webview) {
      webview.setAudioMuted(muted)
    }
  }) as EventListener)

  window.addEventListener('docker-tab-selected', ((event: CustomEvent) => {
    const { tabId } = event.detail
    dockerStore.setActiveTab(tabId)
  }) as EventListener)

  window.addEventListener('cancel-extraction', ((event: CustomEvent) => {
    const { platform } = event.detail
    extractionId.value[platform]++
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
    webviewEventsSet.value.delete(tabId)
    
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

  window.api.docker.onTabRefresh((tabId: string) => {
    const webview = webviewRefs.value.get(tabId)
    if (webview) {
      webview.reload()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('navigate-to-room', handleNavigateToRoom as EventListener)
  window.removeEventListener('refresh-follows', () => {})
  window.removeEventListener('docker-cleared', () => {})
  window.removeEventListener('docker-mute-changed', () => {})
  window.removeEventListener('cancel-extraction', () => {})
  window.api.docker.removeTabSwitchedListener()
  window.api.docker.removeMuteToggledListener()
  window.api.docker.removeTabClosedListener()
  window.api.docker.removeTabRefreshListener()
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

.background-refresh-webview {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  z-index: -9999;
  overflow: hidden;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
