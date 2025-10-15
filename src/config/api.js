// API配置文件 - 统一管理所有API相关配置

// 环境配置
const ENVIRONMENTS = {
  // 开发环境
  development: {
    REMOTE_HOST: 'http://121.36.91.199:8088',
    API_BASE_PATH: '/timetable/api',
    USE_PROXY: false,
    PROTO: 'http',
    PORT: '80',
  },
  
  // 测试环境
  testing: {
    REMOTE_HOST: 'https://timetable.devtesting.top',
    API_BASE_PATH: '/timetable/api',
    USE_PROXY: false,
    PROTO: 'https',
    PORT: '443',
  },
  
  // 生产环境
  production: {
    REMOTE_HOST: 'https://timetable.devtesting.top',
    API_BASE_PATH: '/timetable/api',
    USE_PROXY: false,
    PROTO: 'https',
    PORT: '443',
  }
};

// 当前环境 - 自动判断
let CURRENT_ENV = 'production';
if (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
) {
  CURRENT_ENV = 'development';
}

// 获取当前环境配置
const getCurrentConfig = () => ENVIRONMENTS[CURRENT_ENV];

// API配置
export const API_CONFIG = {
  // 当前环境配置
  ...getCurrentConfig(),
  
  // 请求超时时间
  TIMEOUT: 60000,
  
  // 请求头配置
  get HEADERS() {
    const c = getCurrentConfig();
    return {
      'Content-Type': 'application/json',
      'X-Forwarded-Proto': c.PROTO,
      'Cache-Control': 'no-cache',
      'X-Requested-With': 'XMLHttpRequest'
    };
  },
  
  // 代理配置
  get PROXY() {
    const c = getCurrentConfig();
    return {
      TIMEOUT: 30000,
      FOLLOW_REDIRECTS: false,
      HEADERS: {
        'X-Forwarded-Proto': c.PROTO,
        'X-Forwarded-Port': c.PORT,
        'X-Real-IP': '127.0.0.1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };
  }
};

// 获取API基础URL
export const getApiBaseUrl = () => {
  const config = getCurrentConfig();
  
  // 如果使用代理，返回代理路径
  if (config.USE_PROXY) {
    return config.API_BASE_PATH;
  }
  
  // 否则返回完整URL
  return config.REMOTE_HOST + config.API_BASE_PATH;
};

// 导出常用配置
export const REMOTE_HOST = getCurrentConfig().REMOTE_HOST;
export const API_BASE_PATH = getCurrentConfig().API_BASE_PATH;
export const TIMEOUT = API_CONFIG.TIMEOUT;
export const HEADERS = API_CONFIG.HEADERS;
export const PROXY = API_CONFIG.PROXY;

// 导出环境切换函数（用于调试）
export const switchEnvironment = (env) => {
  if (ENVIRONMENTS[env]) {
    return ENVIRONMENTS[env];
  }
  console.warn(`环境 ${env} 不存在`);
  return getCurrentConfig();
};

// 调试信息
console.log('当前API配置:', {
  环境: CURRENT_ENV,
  远程主机: REMOTE_HOST,
  API路径: API_BASE_PATH,
  使用代理: getCurrentConfig().USE_PROXY,
  基础URL: getApiBaseUrl()
}); 