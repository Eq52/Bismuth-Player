🎬 Bismuth Player

---

> 本项目98%为AI创作，就连这个README.md文件也是AI做的

✨ 功能特性

- 📱 PWA 支持 - 可安装为桌面或移动应用，提供原生应用体验
- 🎞️ 多源管理 - 支持添加和管理多个苹果CMS影视源
- 🔍 智能搜索 - 快速搜索全网影视资源
- 📚 分类浏览 - 按类型、地区、年份等多维度筛选
- ⏯️ 播放历史 - 自动记录播放进度，随时续看
- 💾 进度记忆 - 自动保存每部影片的播放位置
- 🎨 精美UI - 基于 shadcn/ui 的现代化深色主题设计
- ⚡ 极速加载 - 智能缓存策略，优化图片和API数据缓存
- 📐 响应式布局 - 完美适配手机、平板和桌面设备

🖼️ 界面预览

首页	搜索	详情	播放	
分类推荐	智能搜索	影片信息	流畅播放	

🚀 快速开始

环境要求

- Node.js >= 18
- npm >= 9

安装

```bash
# 克隆项目
git clone https://github.com/Eq52/Bismuth-Player.git
cd Bismuth-Player

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

构建

```bash
# 生产构建
npm run build

# 预览生产构建
npm run preview
```

📖 使用指南

添加影视源

1. 打开应用，点击底部导航栏的 设置
2. 在"影视源管理"区域点击 添加源
3. 输入源名称和苹果CMS API 地址
4. 点击保存，即可开始使用

> 💡 提示: 可以在网上搜索"苹果CMS资源站"获取可用的API地址

搜索影片

1. 点击底部导航栏的 搜索
2. 输入影片名称或关键词
3. 点击搜索结果即可查看详情

播放控制

- 点击集数开始播放
- 播放进度会自动保存
- 下次观看时会自动恢复到上次位置

🛠️ 技术栈

类别	技术	
框架	React 19 + TypeScript	
构建工具	Vite 6	
样式	Tailwind CSS 4	
UI组件	shadcn/ui + Radix UI	
PWA	vite-plugin-pwa + Workbox	
图标	Lucide React	
表单	React Hook Form + Zod	
状态管理	React Hooks	

📁 项目结构

```
Bismuth-Player/
├── Demo/                   # 预构建演示版本
├── public/                 # 静态资源
├── src/
│   ├── components/         # 可复用组件
│   │   └── ui/            # shadcn/ui 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具函数
│   ├── pages/              # 页面组件
│   │   ├── HomePage.tsx   # 首页
│   │   ├── SearchPage.tsx # 搜索页
│   │   ├── HistoryPage.tsx# 历史记录
│   │   ├── SettingsPage.tsx# 设置页
│   │   ├── DetailPage.tsx # 详情页
│   │   └── PlayerPage.tsx # 播放页
│   ├── services/           # API 服务
│   ├── types/              # TypeScript 类型
│   ├── App.tsx             # 应用入口
│   └── main.tsx            # 渲染入口
├── index.html              # HTML 模板
├── manifest.webmanifest    # PWA 配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # Tailwind 配置
└── package.json            # 依赖管理
```

⚙️ 配置说明

PWA 配置

应用已配置为 PWA，支持：
- 离线访问
- 自动更新
- 图片缓存 (30天)
- API 数据缓存 (1天)

缓存策略

资源类型	策略	有效期	
图片	CacheFirst	30天	
API 数据	NetworkFirst	1天	

🌐 部署

静态托管

构建后的 `dist` 目录可以部署到任何静态托管服务：

- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [GitHub Pages](https://pages.github.com)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

Docker 部署

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
```

🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

🙏 致谢

- [shadcn/ui](https://ui.shadcn.com/) - 精美的 UI 组件库
- [Radix UI](https://www.radix-ui.com/) - 无障碍组件原语
- [Vite](https://vitejs.dev/) - 极速构建工具
- [苹果CMS](https://github.com/magicblack) - 影视内容管理系统

---