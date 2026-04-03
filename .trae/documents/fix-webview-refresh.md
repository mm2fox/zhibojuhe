# 修复直播间页面自动刷新问题

## 问题分析

经过代码分析，发现页面自动刷新的可能原因：

### 1. 事件监听器重复添加
在 `setWebviewRef` 函数中，每次 Vue 渲染时都会调用 `setupDockerWebviewEvents`，导致同一个 webview 元素上重复添加多个事件监听器。

```javascript
function setWebviewRef(id: string, el: any) {
  if (el) {
    webviewRefs.value.set(id, el)
    setupDockerWebviewEvents(el, id)  // 每次渲染都会调用
  }
}
```

### 2. `did-stop-loading` 事件中的 cookie 注入逻辑
每次页面加载完成时，如果 cookie 注入成功会调用 `webview.reload()`，多个监听器可能导致重复刷新。

### 3. `tabs` 的深度监听
`watch(tabs, ..., { deep: true })` 会在 tabs 中任何属性变化时触发，可能导致不必要的重新渲染。

## 修复方案

### 步骤 1: 防止事件监听器重复添加
在 `setupDockerWebviewEvents` 中添加检查，确保每个 webview 只设置一次事件监听器。

### 步骤 2: 优化 `setWebviewRef` 函数
只在 webview 元素是新创建时才调用 `setupDockerWebviewEvents`。

### 步骤 3: 确保 cookie 注入只执行一次
使用 `dockerCookieInjected` Set 来跟踪已注入 cookie 的 tab，避免重复注入和刷新。

## 具体修改

### 修改 `src/components/WebView.vue`

1. 添加一个 Set 来跟踪已设置事件的 webview
2. 修改 `setWebviewRef` 函数，只在新的 webview 元素上设置事件
3. 确保 cookie 注入逻辑不会重复执行
