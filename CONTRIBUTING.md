# 贡献指南

感谢你愿意为 Bismuth Player 做出贡献。

## 先开 issue，再提交 PR

较大的改动（新功能、重构、行为调整）请先开一个 issue 登记你要做什么，目的是：

- 让作者知道有人在处理这件事，避免遗漏
- 让其他人看到，避免重复提交同样的 PR

小的修复（文档、文案、明显的 bug）可以直接提 PR，不必先开 issue。

开好 issue 后不需要等待回复，直接动手即可。

## 本地开发

要求 Node.js >= 20.19.0。

```bash
npm install      # 也可使用 bun install
npm run dev      # 本地开发
npm run build    # 生产构建（含 tsc 类型检查）
npm run lint     # ESLint
```

`npm run dev` 由浏览器直连影视源，容易被 CORS 拦截。请求失败时可尝试：

- 在「设置 → CORS 代理」填写一个可用代理
- 或对照内置代理的 Android CORS 版，确认问题是否只出在 Web 端

## 代码约定

- TypeScript；不要新增类型错误或 ESLint 问题
- 提交信息使用 `feat:` / `fix:` / `docs:` / `chore:` 前缀（可参考现有提交记录）
- 一个 PR 只做一件事
- 新增依赖或修改 `vite.config` 等构建配置前，请先在 issue 中说明理由
- 界面或动效改动请附截图或录屏；修复类请说明复现步骤
- 欢迎 AI 辅助完成的 PR，但请自己跑通 `npm run build`，并在 PR 中说明验证方式

## 不要提交的内容

- 构建产物：`dist/`、`*.zip`
- 版本号改动：CHANGELOG 与版本号由作者发版时统一更新；涉及新功能的，请在 PR 描述里附一句可直接放进 CHANGELOG 的说明
- 本地配置、个人影视源列表

## 关于 SimPlayer

`src/components/SimPlayer.tsx` 来源于 [Eq52/Sim-Player](https://github.com/Eq52/Sim-Player)，
本地仅做过少量适配（见文件头部注释）。如需修改，请先在 issue 中说明原因。

## 许可

本项目使用 Apache-2.0 许可。提交 PR 即表示你同意以该许可授权你的贡献。
