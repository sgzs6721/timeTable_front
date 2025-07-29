import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 导入统一的API配置
import { API_CONFIG, PROXY } from './src/config/api.js';

// 配置代理日志记录函数
const configureProxyLogs = (proxy) => {
  proxy.on('error', (err, req, res) => {
    console.error('❌ 代理错误:', err.message);
  });
  proxy.on('proxyReq', (proxyReq, req, res) => {
    console.log('🔄 代理请求:', req.method, req.url, '-> 目标:', proxyReq.protocol + '//' + proxyReq.getHeader('host') + proxyReq.path);
    // 强制设置协议为HTTP，防止重定向
    Object.entries(PROXY.HEADERS).forEach(([key, value]) => {
      proxyReq.setHeader(key, value);
    });
    // 移除可能导致重定向的头部
    proxyReq.removeHeader('upgrade-insecure-requests');
  });
  proxy.on('proxyRes', (proxyRes, req, res) => {
    console.log('✅ 代理响应:', proxyRes.statusCode, req.url);
    // 移除可能导致重定向的响应头
    delete proxyRes.headers['strict-transport-security'];
    delete proxyRes.headers['upgrade-insecure-requests'];
    // 强制设置为HTTP
    proxyRes.headers['x-forwarded-proto'] = 'http';
  });
};

// 代理配置
const proxyConfig = {
  [API_CONFIG.API_BASE_PATH]: {
    target: API_CONFIG.REMOTE_HOST,
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path,
    headers: {
      'Host': new URL(API_CONFIG.REMOTE_HOST).hostname,
      'Origin': API_CONFIG.REMOTE_HOST,
      'Referer': API_CONFIG.REMOTE_HOST,
      ...PROXY.HEADERS
    },
    configure: configureProxyLogs,
    followRedirects: PROXY.FOLLOW_REDIRECTS,
    timeout: PROXY.TIMEOUT
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 使用相对路径，支持直接打开index.html
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
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
    proxy: proxyConfig,
  },
  preview: {
    port: 3001,
    host: true,
    proxy: proxyConfig,
  },
}) 