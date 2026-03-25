# 直播平台账号聚合管理器

一个支持虎牙、抖音、斗鱼三个直播平台的账号登录和无缝切换的桌面应用程序。

## 功能特性

- ✅ 支持虎牙、抖音、斗鱼三个平台登录
- ✅ 每个平台仅支持登录一个账号
- ✅ 一键切换不同平台
- ✅ 读取关注的主播列表
- ✅ 显示主播直播状态（直播中/未开播）
- ✅ 点击关注主播直接跳转直播间
- ✅ 关注列表自动刷新和本地缓存
- ✅ 系统托盘支持
- ✅ 主题切换（亮色/暗色）
- ✅ 开机自启动设置

## 技术栈

- **框架**: Electron + Vue 3
- **UI**: Element Plus
- **状态管理**: Pinia
- **构建工具**: Vite
- **数据存储**: electron-store

## 安装依赖

```bash
npm install
```

如果 Electron 安装失败，可以尝试：

```bash
npm install electron --force
```

或者使用国内镜像：

```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm install
```

## 开发运行

```bash
npm run dev
```

## 构建打包

```bash
npm run build:win
```

## 使用说明

1. 首次启动后，点击"立即登录"按钮
2. 选择要登录的平台（虎牙/抖音/斗鱼）
3. 点击"开始登录"，在弹出的窗口中完成登录
4. 登录完成后点击"确认登录完成"
5. 在侧边栏可以切换不同平台
6. 关注列表会自动加载，显示关注的主播及其直播状态
7. 点击关注的主播可以跳转到对应的直播间

## 项目结构

```
zhibojuhe/
├── electron/                  # Electron 主进程代码
│   ├── main.ts               # 主进程入口
│   ├── preload.ts            # 预加载脚本
│   ├── ipc/                  # IPC 通信模块
│   ├── store/                # 数据存储
│   └── utils/api/            # 平台 API 封装
├── src/                      # 渲染进程（Vue 3）
│   ├── views/                # 页面组件
│   ├── components/           # 通用组件
│   ├── stores/               # Pinia 状态管理
│   ├── router/               # 路由配置
│   └── styles/               # 样式文件
├── build/                    # 构建资源
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 注意事项

- 应用使用 WebView 嵌入平台页面，需要网络连接
- Cookie 数据本地加密存储
- 关注列表数据会自动缓存，减少网络请求
- 如遇网络问题，可以手动刷新关注列表

## 许可证

MIT
