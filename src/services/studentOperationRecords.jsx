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

// 学员操作记录相关接口
export const getStudentOperationRecords = (showAll = false, studentName = null, coachId = null) => {
  const params = { showAll };
  if (studentName) {
    params.studentName = studentName;
  }
  if (coachId) {
    params.coachId = coachId;
  }
  return api.get('/weekly-instances/operation-records', {
    params
  });
};

export const updateStudentOperationRecord = (id, data) => {
  return api.put(`/api/student-operation-records/${id}`, data);
};

export const deleteStudentOperationRecord = (id) => {
  return api.delete(`/api/student-operation-records/${id}`);
};

// 学员操作相关接口
export const renameStudent = (data) => {
  // 临时使用weekly-instances接口保存重命名规则
  return api.post('/weekly-instances/rename-student', data);
};

export const hideStudent = (studentName, coachId = null) => {
  // 使用weekly-instances接口保存隐藏操作
  const data = { studentName };
  if (coachId) {
    data.coachId = coachId;
  }
  return api.post('/weekly-instances/hide-student', data);
};

export const assignStudentAlias = (data) => {
  return api.post('/api/student-operation/assign-alias', data);
};