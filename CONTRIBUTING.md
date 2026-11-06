# 贡献指南

感谢你愿意为 Bismuth Player 做出贡献。

## 先开 issue，再提交 PR

提交 PR 前请先开一个 issue 简单说明你要做什么，目的是：

- 让作者知道有人在处理这件事，避免遗漏
- 让其他人看到，避免重复提交同样的 PR

把要改的内容说清楚即可，不需要等待回复，开好之后就可以提交 PR。

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
