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
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 获取所有用户的工资设置
export const getAllUserSalarySettings = () => {
  return api.get('/salary-settings');
};

// 保存或更新用户工资设置
export const saveOrUpdateSalarySetting = (data) => {
  return api.post('/salary-settings', data);
};

// 删除用户工资设置
export const deleteSalarySetting = (userId) => {
  return api.delete(`/salary-settings/${userId}`);
};

export default api;

