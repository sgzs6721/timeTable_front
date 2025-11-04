import axios from 'axios';
import { getApiBaseUrl, TIMEOUT, HEADERS } from '../config/api.js';

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: HEADERS,
});

// 请求拦截器 - 添加token
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

// 响应拦截器 - 处理错误
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

// 获取当前工资系统设置
export const getCurrentSalarySystemSettings = async (organizationId) => {
  try {
    const params = organizationId ? { organizationId } : {};
    const response = await api.get('/salary-system-settings', { params });
    return response;
  } catch (error) {
    console.error('获取工资系统设置失败:', error);
    throw error;
  }
};

// 保存或更新工资系统设置
export const saveOrUpdateSalarySystemSettings = async (settings, organizationId) => {
  try {
    const params = organizationId ? { organizationId } : {};
    const response = await api.post('/salary-system-settings', settings, { params });
    return response;
  } catch (error) {
    console.error('保存工资系统设置失败:', error);
    throw error;
  }
};
