import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './services/ThemeContext.tsx'
import { runStorageMigrations } from './services/migrate'

// 早于 React 渲染执行存储迁移，保证组件读取到的已是当前结构
runStorageMigrations()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
