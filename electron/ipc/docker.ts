import { ipcMain } from 'electron'
import Store from 'electron-store'
import type { DockerData, DockerTab } from '../preload'

interface DockerStoreData {
  docker: DockerData
}

const dockerStore = new Store<DockerStoreData>({
  name: 'docker',
  defaults: {
    docker: {
      tabs: [],
      activeTabId: null,
      isCollapsed: false,
      splitMode: 'single'
    }
  }
})

export function registerDockerIPC() {
  ipcMain.handle('docker:get', () => {
    return dockerStore.get('docker')
  })

  ipcMain.handle('docker:set', (_event, data: DockerData) => {
    dockerStore.set('docker', data)
    return { success: true }
  })

  ipcMain.handle('docker:addTab', (_event, tab: DockerTab) => {
    const docker = dockerStore.get('docker')
    const existingIndex = docker.tabs.findIndex(t => t.id === tab.id)
    
    if (existingIndex < 0) {
      docker.tabs.push(tab)
    }
    
    docker.activeTabId = tab.id
    dockerStore.set('docker', docker)
    return { success: true, docker }
  })

  ipcMain.handle('docker:removeTab', (_event, id: string) => {
    const docker = dockerStore.get('docker')
    docker.tabs = docker.tabs.filter(t => t.id !== id)
    
    if (docker.activeTabId === id) {
      docker.activeTabId = docker.tabs.length > 0 ? docker.tabs[docker.tabs.length - 1].id : null
    }
    
    dockerStore.set('docker', docker)
    return { success: true, docker }
  })

  ipcMain.handle('docker:setActiveTab', (_event, id: string | null) => {
    const docker = dockerStore.get('docker')
    docker.activeTabId = id
    dockerStore.set('docker', docker)
    return { success: true, docker }
  })

  ipcMain.handle('docker:toggleCollapse', () => {
    const docker = dockerStore.get('docker')
    docker.isCollapsed = !docker.isCollapsed
    dockerStore.set('docker', docker)
    return { success: true, docker }
  })

  ipcMain.handle('docker:toggleMute', (_event, id: string) => {
    const docker = dockerStore.get('docker')
    const tab = docker.tabs.find(t => t.id === id)
    if (tab) {
      tab.muted = !tab.muted
      dockerStore.set('docker', docker)
      return { success: true, docker, muted: tab.muted }
    }
    return { success: false, docker }
  })
}
