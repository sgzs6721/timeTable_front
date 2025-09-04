import axios from 'axios';
import { getApiBaseUrl, TIMEOUT, HEADERS } from '../config/api.js';

// 使用统一配置
const API_BASE_URL = getApiBaseUrl();

// 创建axios实例
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

// 为指定课表生成当前周实例
export const generateCurrentWeekInstance = (timetableId) => {
  return api.post(`/weekly-instances/generate/${timetableId}`, {});
};

// 获取指定课表的当前周实例
export const getCurrentWeekInstance = (timetableId) => {
  return api.get(`/weekly-instances/current/${timetableId}`);
};

// 获取指定课表的所有周实例
export const getWeeklyInstances = (timetableId) => {
  return api.get(`/weekly-instances/list/${timetableId}`);
};

// 切换到指定的周实例
export const switchToWeekInstance = (instanceId) => {
  return api.put(`/weekly-instances/switch/${instanceId}`, {});
};

// 获取周实例的课程安排
export const getInstanceSchedules = (instanceId) => {
  return api.get(`/weekly-instances/${instanceId}/schedules`);
};

// 在周实例中创建课程
export const createInstanceSchedule = (instanceId, scheduleData) => {
  return api.post(`/weekly-instances/${instanceId}/schedules`, scheduleData);
};

// 在周实例中批量创建课程
export const createInstanceSchedulesBatch = (instanceId, schedulesData) => {
  return api.post(`/weekly-instances/${instanceId}/schedules/batch`, schedulesData);
};

// 更新周实例中的课程
export const updateInstanceSchedule = (scheduleId, scheduleData) => {
  return api.put(`/weekly-instances/schedules/${scheduleId}`, scheduleData);
};

// 删除周实例中的课程
export const deleteInstanceSchedule = (scheduleId) => {
  return api.delete(`/weekly-instances/schedules/${scheduleId}`);
};

// 同步模板课表到周实例
export const syncTemplateToInstances = (timetableId) => {
  return api.post(`/weekly-instances/sync/${timetableId}`, {});
};

export const restoreCurrentWeekInstanceToTemplate = (timetableId) => {
  return api.post(`/weekly-instances/restore/${timetableId}`, {});
};

// 检查课表是否有当前周实例
export const checkCurrentWeekInstance = (timetableId) => {
  return api.get(`/weekly-instances/check/${timetableId}`);
};

// 清空当前周实例中的课程
export const clearCurrentWeekInstanceSchedules = (timetableId) => {
  return api.delete(`/weekly-instances/current/${timetableId}/schedules`);
};
