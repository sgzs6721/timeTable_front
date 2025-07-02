import axios from 'axios';

// 直接使用远程服务器地址，不使用代理
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://timetable.devtesting.top/timetable/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
    // 如果有响应数据，返回响应数据而不是抛出错误
    // 这样可以让业务层处理具体的错误信息
    if (error.response?.data) {
      return Promise.resolve(error.response.data);
    }
    return Promise.reject(error);
  }
);

// 登录
export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response;
};

// 注册
export const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response;
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

export default api; 