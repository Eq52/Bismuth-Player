# 贡献指南

感谢你愿意为 Bismuth Player 做出贡献。

## 先开 issue，再提交 PR

这个项目由作者一人维护。**任何 PR 都请先开一个 issue 说明你想做什么**，确认方向后再动手，
避免大改动做完才发现与项目方向不符。未经讨论直接提交的 PR 可能会被关闭。

## 本地开发

要求 Node.js >= 20.19.0。

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建（含 tsc 类型检查）
npm run lint     # ESLint
```

## 代码约定

- TypeScript；不要新增类型错误或 ESLint 问题
- 提交信息使用 `feat:` / `fix:` / `docs:` / `chore:` 前缀（可参考现有提交记录）
- 一个 PR 只做一件事
- 界面改动附截图；修复类请说明复现步骤

## 不要提交的内容

- 构建产物：`dist/`、`*.zip`
- 版本号改动（发版由作者统一处理）
- 本地配置、个人影视源列表

## 关于 SimPlayer

`src/components/SimPlayer.tsx` 来源于 [Eq52/Sim-Player](https://github.com/Eq52/Sim-Player)，
本地仅做过少量适配（见文件头部注释）。如需修改，请在 issue 中说明原因。

## 许可

本项目使用 Apache-2.0 许可。提交 PR 即表示你同意以该许可授权你的贡献。
