# Bismuth Player V7

<div align="center">
  <img src="https://img.shields.io/badge/version-V7-purple?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7-blue?style=for-the-badge&logo=vite" alt="Vite">
</div>

<div align="center">
  <h3>如"秘"般美丽的影视播放壳子</h3>
  <p>一款精心设计的Web端影视播放应用，支持自定义影视源、优雅的动画效果和完善的缓存机制</p>
</div>

---

## ✨ 特性

> 本项目约等于是AI生成的,我只是检测问题、提出优化方向,使用模型如下：GLM-5 (Agent)，Kimi (Agent)，GLM-4.7/GLM-4.6 (项目启动想法萌芽时提供帮助)

### 🎨 精美界面
- **深色主题** - 护眼的暗黑配色方案
- **渐变设计** - 紫色到粉色的优雅渐变
- **宋体字体** - 中文显示更加清晰美观
- **响应式布局** - 完美适配手机和桌面端

### 🎬 核心功能
- **自定义影视源** - 支持添加多个苹果CMS API源
- **分类浏览** - 按分类筛选影片
- **搜索功能** - 快速搜索你想要的内容
- **播放历史** - 自动记录观看进度
- **选集播放** - 清晰的剧集选择界面

### 🚀 性能优化
- **API缓存** - 智能缓存API响应，减少网络请求
- **图片懒加载** - 按需加载图片，节省流量
- **骨架屏加载** - 优雅的加载状态展示
- **页面切换动画** - 流畅的过渡效果

### 💫 动画效果
- **启动屏幕** - 优雅的应用启动动画
- **页面切换** - 滑动进入/退出的页面转场
- **图片加载** - 渐显动画加载图片
- **交互反馈** - 按钮悬停和点击动效

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2 | 前端框架 |
| TypeScript | 5.9 | 类型安全 |
| Vite | 7.2 | 构建工具 |
| Tailwind CSS | 3.4 | 样式框架 |
| shadcn/ui | - | UI组件库 |
| Lucide React | 0.562 | 图标库 |

---

## 📦 快速开始

### 环境要求
- Node.js >= 18
- npm 或 bun

### 安装依赖
```bash
npm install
# 或
bun install
```

### 开发模式
```bash
npm run dev
# 或
bun run dev
```

### 构建生产版本
```bash
npm run build
# 或
bun run build
```

### 预览构建结果
```bash
npm run preview
# 或
bun run preview
```

---

## ⚙️ 配置说明

### 添加影视源
1. 进入「设置」页面
2. 点击「添加」按钮
3. 填写影视源信息：
   - **ID**: 唯一标识符（如：mysource）
   - **名称**: 显示名称（如：我的源）
   - **API地址**: 苹果CMS API地址

### 播放器配置
在设置页面可以配置自定义播放器地址，支持任何支持URL参数的播放器。

### CORS代理
如果遇到跨域问题，可以在设置中配置CORS代理地址。

### 缓存管理
- 启用/禁用API缓存
- 查看缓存统计
- 清除缓存

---

## 📱 界面预览

### 移动端
- 底部导航栏
- 紧凑的卡片布局
- 手势友好的交互

### 桌面端
- 左侧固定侧边栏
- 宽屏网格布局
- 悬停预览效果

---

## 🔧 API支持

支持标准苹果CMS API格式：
- 列表接口: `?ac=videolist&pg=1`
- 详情接口: `?ac=videolist&ids=123`
- 搜索接口: `?ac=videolist&wd=关键词`

---

## 📁 项目结构

```
Bismuth-Player/
├── src/
│   ├── components/       # 可复用组件
│   │   ├── ui/          # shadcn/ui 组件
│   │   ├── BottomNav.tsx
│   │   └── VideoCard.tsx
│   ├── pages/           # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── DetailPage.tsx
│   │   ├── PlayerPage.tsx
│   │   ├── HistoryPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/        # 服务层
│   │   ├── api.ts       # API请求
│   │   ├── cache.ts     # 缓存服务
│   │   └── storage.ts   # 本地存储
│   ├── types/           # TypeScript类型
│   ├── App.tsx          # 主应用组件
│   ├── App.css          # 全局样式
│   └── main.tsx         # 入口文件
├── public/              # 静态资源
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🎯 版本更新

### V7 (当前版本)
- ✨ 新增启动屏幕动画
- ✨ 新增页面切换动画
- ✨ 新增图片加载动画
- ✨ 新增优雅的SVG占位图
- ✨ 新增骨架屏加载效果
- 🐛 移除PWA功能，简化部署
- 💄 优化加载状态显示
- 💄 优化桌面端侧边栏

### V6
- 🔧 修复Firebase部署路径问题
- ✨ 新增GitHub链接

### V5
- 🔧 修复API图片获取问题
- 💄 优化桌面端布局

### V4
- ✨ 新增桌面端侧边栏导航
- 💄 优化响应式布局

### V3
- ✨ 新增宋体字体支持
- 💄 优化全局样式

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 免责声明

**Bismuth Player 仅为播放工具壳子，不提供任何影视内容或资源。**

- 本应用不存储、不托管、不传播任何影视内容
- 所有内容来源于用户自行配置的第三方影视源
- 用户需确保所使用的内容来源合法合规
- 使用者应自行承担因使用非法来源产生的法律责任
- 开发者不对任何第三方内容或用户行为负责

**使用本应用即表示您已阅读并同意以上条款。**

---

<div align="center">
  <p>Made with 💜 by <a href="https://github.com/Eq52">Eq52</a></p>
  <a href="https://github.com/Eq52/Bismuth-Player">
    <img src="https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github" alt="GitHub">
  </a>
</div>
