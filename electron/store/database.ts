import Store from 'electron-store'
import type { PlatformAccount, Platform, FollowedAnchor } from '../preload'

interface StoreData {
  accounts: PlatformAccount[]
  follows: Record<Platform, FollowedAnchor[]>
}

export class Database {
  private static instance: Database
  private store: Store<StoreData>

  private constructor() {
    this.store = new Store<StoreData>({
      name: 'data',
      defaults: {
        accounts: [],
        follows: {
          huya: [],
          douyin: [],
          douyu: []
        }
      }
    })
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database()
    }
    return Database.instance
  }

  getAllAccounts(): PlatformAccount[] {
    return this.store.get('accounts', [])
  }

  getAccountByPlatform(platform: Platform): PlatformAccount | null {
    const accounts = this.store.get('accounts', [])
    return accounts.find(a => a.platform === platform) || null
  }

  saveAccount(account: Partial<PlatformAccount>) {
    const accounts = this.store.get('accounts', [])
    const id = account.id || `${account.platform}-${Date.now()}`
    const existingIndex = accounts.findIndex(a => a.platform === account.platform)
    
    const newAccount: PlatformAccount = {
      id,
      platform: account.platform!,
      nickname: account.nickname || '',
      avatar: account.avatar || '',
      cookies: account.cookies || '',
      loginTime: account.loginTime || Date.now(),
      lastActiveTime: account.lastActiveTime || Date.now(),
      status: account.status || 'active'
    }

    if (existingIndex >= 0) {
      accounts[existingIndex] = newAccount
    } else {
      accounts.push(newAccount)
    }
    
    this.store.set('accounts', accounts)
  }

  deleteAccount(id: string) {
    const accounts = this.store.get('accounts', [])
    const filtered = accounts.filter(a => a.id !== id)
    this.store.set('accounts', filtered)
  }

  getFollowsByPlatform(platform: Platform): FollowedAnchor[] {
    const follows = this.store.get('follows', { huya: [], douyin: [], douyu: [] })
    return follows[platform] || []
  }

  saveFollows(anchors: FollowedAnchor[]) {
    const follows = this.store.get('follows', { huya: [], douyin: [], douyu: [] })
    
    for (const anchor of anchors) {
      const platform = anchor.platform
      if (!follows[platform]) {
        follows[platform] = []
      }
      
      const existingIndex = follows[platform].findIndex(a => a.anchorId === anchor.anchorId)
      const newAnchor: FollowedAnchor = {
        id: anchor.id || `${anchor.platform}-${anchor.anchorId}`,
        platform: anchor.platform,
        anchorId: anchor.anchorId,
        nickname: anchor.nickname,
        avatar: anchor.avatar || '',
        roomId: anchor.roomId,
        isLive: anchor.isLive,
        viewerCount: anchor.viewerCount || 0,
        liveTitle: anchor.liveTitle || '',
        liveCover: anchor.liveCover || '',
        updateTime: anchor.updateTime || Date.now()
      }
      
      if (existingIndex >= 0) {
        follows[platform][existingIndex] = newAnchor
      } else {
        follows[platform].push(newAnchor)
      }
    }
    
    this.store.set('follows', follows)
  }

  deleteFollowsByPlatform(platform: Platform) {
    const follows = this.store.get('follows', { huya: [], douyin: [], douyu: [] })
    follows[platform] = []
    this.store.set('follows', follows)
  }
}
