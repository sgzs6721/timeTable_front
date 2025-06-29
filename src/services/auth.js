import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

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
    const response = await api.post('/api/auth/login', credentials);
    return response;
  } catch (error) {
    throw error;
  }
};

// 注册
export const register = async (userData) => {
  try {
    const response = await api.post('/api/auth/register', userData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 验证token
export const validateToken = async () => {
  try {
    const response = await api.get('/api/auth/validate');
    return response;
  } catch (error) {
    throw error;
  }
};

export default api; 