/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  api: {
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
    }
    account: {
      getAll: () => Promise<import('../electron/preload').PlatformAccount[]>
      getByPlatform: (platform: import('../electron/preload').Platform) => Promise<import('../electron/preload').PlatformAccount | null>
      save: (account: Partial<import('../electron/preload').PlatformAccount>) => Promise<{ success: boolean; error?: string }>
      delete: (id: string) => Promise<{ success: boolean; error?: string }>
      checkLoginStatus: (platform: import('../electron/preload').Platform) => Promise<{ isLoggedIn: boolean; account?: import('../electron/preload').PlatformAccount }>
    }
    platform: {
      switch: (platform: import('../electron/preload').Platform) => void
      getCurrent: () => Promise<import('../electron/preload').Platform>
      getLoginUrl: (platform: import('../electron/preload').Platform) => Promise<string>
      extractCookies: (platform: import('../electron/preload').Platform) => Promise<{ success: boolean; cookies?: string; error?: string; count?: number }>
      injectCookies: (platform: import('../electron/preload').Platform, cookies: string) => Promise<{ success: boolean; error?: string }>
      getCookiesFromPartition: (platform: import('../electron/preload').Platform, partition: string) => Promise<{ success: boolean; cookies?: string; error?: string }>
      clearCookies: (platform: import('../electron/preload').Platform) => Promise<{ success: boolean; error?: string }>
    }
    follow: {
      getByPlatform: (platform: import('../electron/preload').Platform) => Promise<import('../electron/preload').FollowedAnchor[]>
      refresh: (platform: import('../electron/preload').Platform) => Promise<{ success: boolean; anchors?: import('../electron/preload').FollowedAnchor[]; error?: string; fromCache?: boolean }>
      getLiveStatus: (platform: import('../electron/preload').Platform, anchorIds: string[]) => Promise<{ anchorId: string; isLive: boolean; viewerCount: number }[]>
      save: (anchors: import('../electron/preload').FollowedAnchor[]) => Promise<{ success: boolean; error?: string }>
      updateFromWebview: (platform: import('../electron/preload').Platform, anchorsJson: string) => Promise<{ success: boolean; error?: string }>
      startBackgroundRefresh: (platform: import('../electron/preload').Platform, intervalMs: number) => void
      stopBackgroundRefresh: (platform: import('../electron/preload').Platform) => void
      stopAllBackgroundRefresh: () => void
      onBackgroundRefreshed: (callback: (platform: import('../electron/preload').Platform, anchors: import('../electron/preload').FollowedAnchor[], fromCache: boolean) => void) => void
      removeBackgroundRefreshedListener: () => void
    }
    settings: {
      get: () => Promise<import('../electron/preload').AppSettings>
      set: (settings: Partial<import('../electron/preload').AppSettings>) => Promise<{ success: boolean; error?: string }>
      setAutoStart: (enable: boolean) => Promise<{ success: boolean; error?: string }>
    }
    docker: {
      get: () => Promise<import('../electron/preload').DockerData>
      set: (data: import('../electron/preload').DockerData) => Promise<{ success: boolean }>
      addTab: (tab: import('../electron/preload').DockerTab) => Promise<{ success: boolean; docker: import('../electron/preload').DockerData }>
      removeTab: (id: string) => Promise<{ success: boolean; docker: import('../electron/preload').DockerData }>
      setActiveTab: (id: string | null) => Promise<{ success: boolean; docker: import('../electron/preload').DockerData }>
      toggleCollapse: () => Promise<{ success: boolean; docker: import('../electron/preload').DockerData }>
      toggleMute: (id: string) => Promise<{ success: boolean; docker: import('../electron/preload').DockerData; muted?: boolean }>
      onTabSwitched: (callback: (tabId: string) => void) => void
      removeTabSwitchedListener: () => void
      onMuteToggled: (callback: (tabId: string, muted: boolean) => void) => void
      removeMuteToggledListener: () => void
      onTabClosed: (callback: (tabId: string) => void) => void
      removeTabClosedListener: () => void
      onTabRefresh: (callback: (tabId: string) => void) => void
      removeTabRefreshListener: () => void
    }
  }
}
