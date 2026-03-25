import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlatformAccount, Platform } from '../../electron/preload'

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<PlatformAccount[]>([])
  const currentPlatform = ref<Platform>('huya')
  const loading = ref(false)

  const currentAccount = computed(() => {
    return accounts.value.find(a => a.platform === currentPlatform.value)
  })

  const isLoggedIn = computed(() => {
    return currentAccount.value?.status === 'active'
  })

  async function loadAccounts() {
    loading.value = true
    try {
      accounts.value = await window.api.account.getAll()
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      loading.value = false
    }
  }

  async function getAccountByPlatform(platform: Platform) {
    try {
      const account = await window.api.account.getByPlatform(platform)
      return account
    } catch (error) {
      console.error('Failed to get account:', error)
      return null
    }
  }

  async function saveAccount(account: Partial<PlatformAccount>) {
    try {
      await window.api.account.save(account)
      await loadAccounts()
      return true
    } catch (error) {
      console.error('Failed to save account:', error)
      return false
    }
  }

  async function deleteAccount(id: string) {
    try {
      await window.api.account.delete(id)
      await loadAccounts()
      return true
    } catch (error) {
      console.error('Failed to delete account:', error)
      return false
    }
  }

  function setCurrentPlatform(platform: Platform) {
    currentPlatform.value = platform
    window.api.platform.switch(platform)
  }

  return {
    accounts,
    currentPlatform,
    loading,
    currentAccount,
    isLoggedIn,
    loadAccounts,
    getAccountByPlatform,
    saveAccount,
    deleteAccount,
    setCurrentPlatform
  }
})
