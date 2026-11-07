import path from "path"
import react from "@vitejs/plugin-react"
// 从 vitest/config 导入：在 vite 的 defineConfig 基础上额外支持 test 字段
import { defineConfig } from "vitest/config"
import pkg from "./package.json"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
  ],
  esbuild: {
    // 生产压缩时移除调试日志（dev 不压缩，仍可在控制台看到）；保留 console.error/warn 用于线上问题诊断
    pure: ['console.log', 'console.debug'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // 可用环境变量 BISMUTH_VERSION 临时覆盖，默认取 package.json
    __APP_VERSION__: JSON.stringify(process.env.BISMUTH_VERSION || pkg.version),
  },
  build: {
    // hls chunk 独立按需加载约 522KB，属合理的按需内核；调高阈值消除该预期内警告，
    // 同时仍能对意外的超大 chunk 保留报警
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 按依赖拆分 chunk:hls.js 体积最大且可独立缓存,react 运行时单独成块
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/hls.js")) return "hls";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
  test: {
    // 纯函数测试用 node 环境即可（无 DOM 依赖），零额外配置、启动快
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
