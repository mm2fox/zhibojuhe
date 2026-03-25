# 直播平台账号聚合管理器 - 规格说明

## 1. 项目概述

### 1.1 项目名称
直播平台账号聚合管理器 (Live Stream Account Manager)

### 1.2 项目目标
开发一个桌面应用程序，支持用户登录三个主流直播平台（虎牙、抖音、斗鱼）的账号，并实现账号的无缝切换管理。

### 1.3 目标用户
- 需要管理多个直播平台账号的主播
- 需要在多个平台观看直播的用户
- 直播运营人员

## 2. 技术架构

### 2.1 技术选型

| 层级 | 技术方案 | 说明 |
|------|----------|------|
| 框架 | Electron + Vue 3 | 跨平台桌面应用，支持 Windows/macOS/Linux |
| UI框架 | Element Plus | 成熟的 Vue 3 组件库 |
| 状态管理 | Pinia | Vue 3 官方推荐的状态管理 |
| 构建工具 | Vite | 快速的开发构建工具 |
| 数据存储 | SQLite / electron-store | 本地数据持久化 |

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron 主进程                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  窗口管理    │  │  数据存储    │  │  平台 WebView 管理   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     渲染进程 (Vue 3)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  账号管理    │  │  平台切换    │  │  设置页面           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 3. 功能需求

### 3.1 核心功能

#### 3.1.1 账号登录
- 支持虎牙直播账号登录
- 支持抖音直播账号登录
- 支持斗鱼直播账号登录
- 每个平台仅支持登录一个账号
- 登录状态持久化保存

#### 3.1.2 平台切换
- 一键切换不同平台
- 切换时保持登录状态
- 快速切换面板（侧边栏）

#### 3.1.3 主页展示
- 嵌入式 WebView 展示平台内容
- 支持全屏模式
- 支持窗口大小调整

#### 3.1.4 关注列表
- 读取虎牙关注的主播列表
- 读取抖音关注的主播列表
- 读取斗鱼关注的主播列表
- 显示主播在线状态
- 显示主播直播状态（直播中/未开播）
- 点击关注主播直接跳转直播间
- 关注列表本地缓存

### 3.2 辅助功能

#### 3.2.1 系统设置
- 开机自启动
- 最小化到托盘
- 主题切换（亮色/暗色）
- 快捷键设置

#### 3.2.2 安全功能
- 账号数据本地加密存储
- 应用启动密码保护（可选）

## 4. 平台适配详情

### 4.1 虎牙直播 (Huya)
- 登录页面 URL: `https://www.huya.com/`
- 直播间 URL 格式: `https://www.huya.com/{room_id}`
- 登录状态检测: Cookie 中的 `yyuid`
- 关注列表 API: `https://follow.huya.com/users/getFollowList`

### 4.2 抖音直播 (Douyin)
- 登录页面 URL: `https://www.douyin.com/`
- 直播间 URL 格式: `https://live.douyin.com/{room_id}`
- 登录状态检测: Cookie 中的 `sessionid`
- 关注列表 API: 通过 WebView 注入脚本获取或 API 请求

### 4.3 斗鱼直播 (Douyu)
- 登录页面 URL: `https://www.douyu.com/`
- 直播间 URL 格式: `https://www.douyu.com/{room_id}`
- 登录状态检测: Cookie 中的 `acf_uid`
- 关注列表 API: `https://www.douyu.com/wgapi/livenc/liveweb/follow/list`

## 5. 数据结构设计

### 5.1 账号数据结构

```typescript
interface PlatformAccount {
  id: string;                              // 唯一标识
  platform: 'huya' | 'douyin' | 'douyu';   // 平台类型
  nickname: string;                        // 账号昵称
  avatar?: string;                         // 头像 URL
  cookies: string;                         // 登录凭证（加密存储）
  loginTime: number;                       // 登录时间戳
  lastActiveTime: number;                  // 最后活跃时间
  status: 'active' | 'expired' | 'offline'; // 账号状态
}

interface FollowedAnchor {
  id: string;                              // 唯一标识
  platform: 'huya' | 'douyin' | 'douyu';   // 所属平台
  anchorId: string;                        // 主播ID（平台原始ID）
  nickname: string;                        // 主播昵称
  avatar?: string;                         // 主播头像
  roomId: string;                          // 直播间ID
  isLive: boolean;                         // 是否正在直播
  viewerCount?: number;                    // 观看人数
  liveTitle?: string;                      // 直播标题
  liveCover?: string;                      // 直播封面
  updateTime: number;                      // 更新时间戳
}

interface AppSettings {
  autoStart: boolean;                      // 开机自启
  minimizeToTray: boolean;                 // 最小化到托盘
  theme: 'light' | 'dark';                 // 主题
  language: 'zh-CN';                       // 语言
  enablePassword: boolean;                 // 启用密码保护
  password?: string;                       // 应用密码（加密）
  autoRefreshFollow: boolean;              // 自动刷新关注列表
  refreshInterval: number;                 // 刷新间隔（分钟）
}
```

### 5.2 本地存储结构

```
userData/
├── accounts.db          # SQLite 数据库（账号信息、关注列表）
├── settings.json        # 应用设置
└── cookies/             # 各平台 Cookie 存储
    ├── huya/
    ├── douyin/
    └── douyu/
```

## 6. 用户界面设计

### 6.1 主界面布局

```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────┐  ┌────────────────────────────────────────────┐    │
│  │            │  │                                            │    │
│  │  侧边栏     │  │                                            │    │
│  │            │  │                                            │    │
│  │ ┌────────┐ │  │                                            │    │
│  │ │ 虎牙   │ │  │                                            │    │
│  │ └────────┘ │  │                                            │    │
│  │ ┌────────┐ │  │         WebView 内容区域                    │    │
│  │ │ 抖音   │ │  │                                            │    │
│  │ └────────┘ │  │       （显示直播平台页面内容）               │    │
│  │ ┌────────┐ │  │                                            │    │
│  │ │ 斗鱼   │ │  │                                            │    │
│  │ └────────┘ │  │                                            │    │
│  │            │  │                                            │    │
│  │ ──────────│  │                                            │    │
│  │  关注列表  │  │                                            │    │
│  │ ┌────────┐ │  │                                            │    │
│  │ │🔴主播A │ │  │                                            │    │
│  │ │⚫主播B │ │  │                                            │    │
│  │ │🔴主播C │ │  │                                            │    │
│  │ └────────┘ │  └────────────────────────────────────────────┘    │
│  └────────────┘                                                    │
└────────────────────────────────────────────────────────────────────┘

🔴 = 直播中    ⚫ = 未开播
```

### 6.2 页面清单

| 页面 | 路由 | 说明 |
|------|------|------|
| 主页 | `/` | WebView 展示区 + 侧边栏 + 关注列表 |
| 登录 | `/login` | 选择平台并登录 |
| 设置 | `/settings` | 应用设置 |

## 7. 非功能需求

### 7.1 性能要求
- 应用启动时间 < 3 秒
- 平台切换时间 < 1 秒
- 内存占用 < 300MB（空闲状态）

### 7.2 安全要求
- Cookie 数据加密存储
- 敏感数据不明文显示
- 支持数据导出备份

### 7.3 兼容性要求
- Windows 10/11
- macOS 10.15+
- 主流分辨率适配

## 8. 项目目录结构

```
zhibojuhe/
├── electron/                  # Electron 主进程代码
│   ├── main.ts               # 主进程入口
│   ├── preload.ts            # 预加载脚本
│   ├── ipc/                  # IPC 通信模块
│   │   ├── account.ts        # 账号相关 IPC
│   │   ├── settings.ts       # 设置相关 IPC
│   │   ├── platform.ts       # 平台管理 IPC
│   │   └── follow.ts         # 关注列表 IPC
│   ├── store/                # 数据存储
│   │   ├── database.ts       # SQLite 数据库
│   │   └── encryption.ts     # 加密工具
│   └── utils/                # 工具函数
│       ├── cookie.ts         # Cookie 管理
│       ├── platform.ts       # 平台工具
│       └── api/              # 平台 API 封装
│           ├── huya.ts       # 虎牙 API
│           ├── douyin.ts     # 抖音 API
│           └── douyu.ts      # 斗鱼 API
├── src/                      # 渲染进程（Vue 3）
│   ├── App.vue               # 根组件
│   ├── main.ts               # 入口文件
│   ├── views/                # 页面组件
│   │   ├── Home.vue          # 主页
│   │   ├── Login.vue         # 登录页面
│   │   └── Settings.vue      # 设置页面
│   ├── components/           # 通用组件
│   │   ├── Sidebar.vue       # 侧边栏
│   │   ├── PlatformIcon.vue  # 平台图标
│   │   ├── WebView.vue       # WebView 组件
│   │   ├── FollowList.vue    # 关注列表组件
│   │   └── AnchorCard.vue    # 主播卡片组件
│   ├── stores/               # Pinia 状态管理
│   │   ├── account.ts        # 账号状态
│   │   ├── follow.ts         # 关注列表状态
│   │   └── settings.ts       # 设置状态
│   ├── router/               # 路由配置
│   │   └── index.ts
│   ├── styles/               # 样式文件
│   │   ├── variables.scss    # 变量定义
│   │   └── global.scss       # 全局样式
│   └── utils/                # 工具函数
│       └── api.ts            # API 调用
├── package.json
├── vite.config.ts
├── electron-builder.json      # 打包配置
└── tsconfig.json
```

## 9. 开发里程碑

### Phase 1: 基础框架搭建
- Electron + Vue 3 项目初始化
- 基础 UI 框架搭建
- IPC 通信机制实现

### Phase 2: 核心功能开发
- 账号登录功能
- Cookie 管理与存储
- 平台切换功能

### Phase 3: 功能完善
- 账号管理功能
- 设置页面
- 托盘功能

### Phase 4: 优化与打包
- 性能优化
- 安全加固
- 应用打包发布

## 10. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 平台登录机制变更 | 高 | 使用 WebView 方案，跟随平台更新 |
| Cookie 失效 | 中 | 实现自动刷新机制，提示用户重新登录 |
| 跨域限制 | 中 | 使用 Electron 主进程代理请求 |
| 账号安全 | 高 | 本地加密存储，不上传服务器 |
