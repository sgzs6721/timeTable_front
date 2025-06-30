import axios from 'axios';

// 在开发环境使用代理，生产环境使用完整URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '/api' : 'http://localhost:8080');

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 登录
export const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response;
  } catch (error) {
    throw error;
  }
};

// 注册
export const register = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 验证token
export const validateToken = async () => {
  try {
    const response = await api.get('/auth/validate');
    return response;
  } catch (error) {
    throw error;
  }
};

// 测试账号登录 - 用于前端开发调试，正式环境需要删除
export const loginWithTestAccount = async () => {
  return new Promise((resolve) => {
    // 模拟网络延迟
    setTimeout(() => {
      const mockResponse = {
        success: true,
        message: '测试账号登录成功',
        data: {
          token: 'test_token_' + Date.now(),
          user: {
            id: 999,
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
            createdAt: new Date().toISOString()
          }
        }
      };
      resolve(mockResponse);
    }, 500); // 模拟500ms延迟
  });
};

// 管理员测试账号登录
export const loginWithAdminTestAccount = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockResponse = {
        success: true,
        message: '管理员测试账号登录成功',
        data: {
          token: 'admin_test_token_' + Date.now(),
          user: {
            id: 888,
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin',
            createdAt: new Date().toISOString()
          }
        }
      };
      resolve(mockResponse);
    }, 500);
  });
};

export default api; 