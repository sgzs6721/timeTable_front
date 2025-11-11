import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器，自动添加token
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

// 添加响应拦截器，处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 处理401未授权错误
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const getOrganizationRoles = async (organizationId) => {
  const response = await api.get(`/organization-roles/organization/${organizationId}`);
  return response.data;
};

export const getRoleById = async (id) => {
  const response = await api.get(`/organization-roles/${id}`);
  return response.data;
};

export const createRole = async (roleData) => {
  const response = await api.post('/organization-roles', roleData);
  return response.data;
};

export const updateRole = async (id, roleData) => {
  const response = await api.put(`/organization-roles/${id}`, roleData);
  return response.data;
};

export const deleteRole = async (id) => {
  const response = await api.delete(`/organization-roles/${id}`);
  return response.data;
};

export const getRoleMemberCount = async (roleId) => {
  const response = await api.get(`/organization-roles/${roleId}/member-count`);
  return response.data;
};

export const assignRoleToUser = async (roleId, userId) => {
  const response = await api.post(`/organization-roles/${roleId}/members/${userId}`, {});
  return response.data;
};

export const removeUserFromRole = async (roleId, userId) => {
  const response = await api.delete(`/organization-roles/${roleId}/members/${userId}`);
  return response.data;
};

export const assignRoleToUsers = async (roleId, userIds) => {
  const response = await api.post(`/organization-roles/${roleId}/members/batch`, userIds);
  return response.data;
};

