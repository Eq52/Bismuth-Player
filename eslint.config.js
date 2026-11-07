import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // SimPlayer 是冻结的历史模块，源码禁止改动；仅对该文件放宽其历史规则，不影响其他文件
    files: ['src/components/SimPlayer.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
