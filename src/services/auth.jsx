import axios from 'axios';
import { getApiBaseUrl, TIMEOUT, HEADERS } from '../config/api.js';

// 使用统一配置
const API_BASE_URL = getApiBaseUrl();


// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: HEADERS,
  maxRedirects: 3,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 强制设置为HTTPS请求，防止重定向
    config.headers['X-Forwarded-Proto'] = 'https';
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
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
    // 如果没有响应数据，创建一个错误响应对象
    const errorResponse = {
      success: false,
      message: error.message || '网络请求失败',
      data: null
    };
    return Promise.resolve(errorResponse);
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

// 微信登录
export const wechatLogin = async (code) => {
  const response = await api.post('/auth/wechat/login', { code });
  return response;
};

// 获取微信登录授权URL
export const getWechatAuthUrl = async () => {
  const response = await api.get('/auth/wechat/auth-url');
  return response;
};

// 更新用户资料
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put('/auth/profile', profileData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新密码
export const updatePassword = async (passwordData) => {
  try {
    const response = await api.put('/auth/password', passwordData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 注销账号（软删除）
export const deactivateAccount = async () => {
  try {
    const response = await api.delete('/auth/deactivate');
    return response;
  } catch (error) {
    throw error;
  }
};

// 绑定微信到已有账号
export const bindWechatToAccount = async (username, password) => {
  try {
    const response = await api.post('/auth/wechat/bind-account', { 
      username, 
      password 
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// 微信用户创建新账号
export const createAccountForWechat = async (username) => {
  try {
    const response = await api.post('/auth/wechat/create-account', { 
      username 
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// 设置密码（首次设置，不需要原密码）
export const setPassword = async (newPassword) => {
  try {
    const response = await api.post('/auth/set-password', { 
      newPassword 
    });
    return response;
  } catch (error) {
    throw error;
  }
};

export default api; 