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

// 学员合并相关接口
export const getStudentMerges = () => {
  return api.get('/api/student-merge/list');
};

export const createStudentMerge = (data) => {
  return api.post('/api/student-merge/create', data);
};

export const updateStudentMerge = (id, data) => {
  return api.put(`/api/student-merge/update/${id}`, data);
};

export const deleteStudentMerge = (id) => {
  return api.delete(`/api/student-merge/delete/${id}`);
};

// 学员别名相关接口
export const getStudentAliases = () => {
  return api.get('/api/student-alias/list');
};

export const createStudentAlias = (data) => {
  return api.post('/api/student-alias/create', data);
};

export const updateStudentAlias = (id, data) => {
  return api.put(`/api/student-alias/update/${id}`, data);
};

export const deleteStudentAlias = (id) => {
  return api.delete(`/api/student-alias/delete/${id}`);
};

// 学员操作相关接口
export const renameStudent = (data) => {
  return api.post('/api/student-operation/rename', data);
};

export const deleteStudent = (data) => {
  return api.post('/api/student-operation/delete', data);
};

export const assignStudentAlias = (data) => {
  return api.post('/api/student-operation/assign-alias', data);
};

export const mergeStudents = (data) => {
  // 使用weekly-instances接口进行合并操作
  return api.post('/weekly-instances/merge-students', data);
};
