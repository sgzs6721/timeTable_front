import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 定义API主机常量
const LOCAL_API_HOST = 'http://localhost:8088';
const REMOTE_API_HOST = 'http://timetabledev.devtesting.top'; // 可根据实际情况修改
// 开发环境使用远程服务器
const CURRENT_API_HOST = REMOTE_API_HOST;

// 配置代理日志记录函数
const configureProxyLogs = (proxy) => {
  proxy.on('error', (err, req, res) => {
    console.error('代理错误:', err);
  });
  proxy.on('proxyReq', (proxyReq, req, res) => {
    console.log('代理请求:', req.method, req.url);
  });
  proxy.on('proxyRes', (proxyRes, req, res) => {
    console.log('代理响应:', proxyRes.statusCode, req.url);
  });
};

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
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: CURRENT_API_HOST,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: configureProxyLogs
      },
      '/timetable/api': {
        target: CURRENT_API_HOST,
        changeOrigin: true,
        secure: false,
        configure: configureProxyLogs
      },
      '/remote': {
        target: REMOTE_API_HOST,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/remote/, ''),
        headers: {
          'Referer': REMOTE_API_HOST,
          'Origin': REMOTE_API_HOST
        },
        configure: configureProxyLogs
      },
    },
  },
  preview: {
    port: 3001,
    host: true,
  },
}) 