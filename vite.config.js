import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 使用相对路径，支持直接打开index.html
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 生成相对路径的资源引用
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/timetable/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        // 不需要重写路径，直接转发
      },
    },
  },
  preview: {
    port: 3001,
    host: true,
  },
}) 