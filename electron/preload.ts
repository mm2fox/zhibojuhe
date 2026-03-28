import { contextBridge, ipcRenderer } from 'electron'

export type Platform = 'huya' | 'douyin' | 'douyu'

export interface PlatformAccount {
  id: string
  platform: Platform
  nickname: string
  avatar?: string
  cookies: string
  loginTime: number
  lastActiveTime: number
  status: 'active' | 'expired' | 'offline'
}

export interface FollowedAnchor {
  id: string
  platform: Platform
  anchorId: string
  nickname: string
  avatar?: string
  roomId: string
  secUid?: string
  isLive: boolean
  viewerCount?: number
  liveTitle?: string
  liveCover?: string
  updateTime: number
}

export interface DockerTab {
  id: string
  platform: Platform
  roomId: string
  nickname: string
  avatar?: string
  title?: string
  addedTime: number
  muted?: boolean
  inSplit?: boolean
}

export type SplitMode = 'single' | 'split'

export interface DockerData {
  tabs: DockerTab[]
  activeTabId: string | null
  isCollapsed: boolean
  splitMode: SplitMode
}

export interface AppSettings {
  autoStart: boolean
  minimizeToTray: boolean
  theme: 'light' | 'dark'
  language: 'zh-CN'
  enablePassword: boolean
  password?: string
  autoRefreshFollow: boolean
  refreshInterval: number
}

const api = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  account: {
    getAll: () => ipcRenderer.invoke('account:getAll'),
    getByPlatform: (platform: Platform) => ipcRenderer.invoke('account:getByPlatform', platform),
    save: (account: Partial<PlatformAccount>) => ipcRenderer.invoke('account:save', account),
    delete: (id: string) => ipcRenderer.invoke('account:delete', id),
    checkLoginStatus: (platform: Platform) => ipcRenderer.invoke('account:checkLoginStatus', platform)
  },

  platform: {
    switch: (platform: Platform) => ipcRenderer.send('platform:switch', platform),
    getCurrent: () => ipcRenderer.invoke('platform:getCurrent'),
    getLoginUrl: (platform: Platform) => ipcRenderer.invoke('platform:getLoginUrl', platform),
    extractCookies: (platform: Platform) => ipcRenderer.invoke('platform:extractCookies', platform),
    injectCookies: (platform: Platform, cookies: string) => ipcRenderer.invoke('platform:injectCookies', platform, cookies),
    getCookiesFromPartition: (platform: Platform, partition: string) => ipcRenderer.invoke('platform:getCookiesFromPartition', platform, partition)
  },

  follow: {
    getByPlatform: (platform: Platform) => ipcRenderer.invoke('follow:getByPlatform', platform),
    refresh: (platform: Platform) => ipcRenderer.invoke('follow:refresh', platform),
    getLiveStatus: (platform: Platform, anchorIds: string[]) => ipcRenderer.invoke('follow:getLiveStatus', platform, anchorIds),
    save: (anchors: FollowedAnchor[]) => ipcRenderer.invoke('follow:save', anchors),
    updateFromWebview: (platform: Platform, anchorsJson: string) => ipcRenderer.invoke('follow:updateFromWebview', platform, anchorsJson)
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', settings),
    setAutoStart: (enable: boolean) => ipcRenderer.invoke('settings:setAutoStart', enable)
  },

  docker: {
    get: () => ipcRenderer.invoke('docker:get'),
    set: (data: DockerData) => ipcRenderer.invoke('docker:set', data),
    addTab: (tab: DockerTab) => ipcRenderer.invoke('docker:addTab', tab),
    removeTab: (id: string) => ipcRenderer.invoke('docker:removeTab', id),
    setActiveTab: (id: string | null) => ipcRenderer.invoke('docker:setActiveTab', id),
    toggleCollapse: () => ipcRenderer.invoke('docker:toggleCollapse'),
    toggleMute: (id: string) => ipcRenderer.invoke('docker:toggleMute', id),
    onTabSwitched: (callback: (tabId: string) => void) => {
      ipcRenderer.on('docker:tab-switched', (_event, tabId) => callback(tabId))
    },
    removeTabSwitchedListener: () => {
      ipcRenderer.removeAllListeners('docker:tab-switched')
    },
    onMuteToggled: (callback: (tabId: string, muted: boolean) => void) => {
      ipcRenderer.on('docker:mute-toggled', (_event, tabId, muted) => callback(tabId, muted))
    },
    removeMuteToggledListener: () => {
      ipcRenderer.removeAllListeners('docker:mute-toggled')
    },
    onTabClosed: (callback: (tabId: string) => void) => {
      ipcRenderer.on('docker:tab-closed', (_event, tabId) => callback(tabId))
    },
    removeTabClosedListener: () => {
      ipcRenderer.removeAllListeners('docker:tab-closed')
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
