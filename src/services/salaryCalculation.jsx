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

// 获取指定月份的工资计算结果
export const getSalaryCalculations = async (month) => {
  try {
    const response = await api.get(`/salary-calculations/${month}`);
    return response;
  } catch (error) {
    console.error('获取工资计算结果失败:', error);
    throw error;
  }
};

// 获取最近几个月的工资计算结果
export const getRecentSalaryCalculations = async (months = 3) => {
  try {
    const response = await api.get(`/salary-calculations/recent/${months}`);
    return response;
  } catch (error) {
    console.error('获取最近工资计算结果失败:', error);
    throw error;
  }
};

// 获取所有工资计算结果
export const getAllSalaryCalculations = async () => {
  try {
    const response = await api.get('/salary-calculations');
    return response;
  } catch (error) {
    console.error('获取所有工资计算结果失败:', error);
    throw error;
  }
};

// 获取有课时记录的月份列表
export const getAvailableMonths = async () => {
  try {
    const response = await api.get('/salary-calculations/available-months');
    return response;
  } catch (error) {
    console.error('获取可用月份列表失败:', error);
    throw error;
  }
};
