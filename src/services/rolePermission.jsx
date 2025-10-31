import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

/**
 * 获取当前用户的权限配置
 */
export const getCurrentUserPermissions = async () => {
  try {
    const response = await api.get('/api/role-permissions/current');
    return response.data;
  } catch (error) {
    console.error('获取当前用户权限失败:', error);
    throw error;
  }
};

/**
 * 获取机构的所有角色权限
 */
export const getOrganizationPermissions = async (organizationId) => {
  try {
    const response = await api.get(`/api/role-permissions/organization/${organizationId}`);
    return response.data;
  } catch (error) {
    console.error('获取机构权限失败:', error);
    throw error;
  }
};

/**
 * 获取指定角色的权限
 */
export const getRolePermission = async (organizationId, role) => {
  try {
    const response = await api.get(`/api/role-permissions/organization/${organizationId}/role/${role}`);
    return response.data;
  } catch (error) {
    console.error('获取角色权限失败:', error);
    throw error;
  }
};

/**
 * 保存单个角色权限
 */
export const saveRolePermission = async (permissionData) => {
  try {
    const response = await api.post('/api/role-permissions', permissionData);
    return response.data;
  } catch (error) {
    console.error('保存角色权限失败:', error);
    throw error;
  }
};

/**
 * 批量保存机构的角色权限
 */
export const saveRolePermissions = async (organizationId, permissions) => {
  try {
    const response = await api.post(`/api/role-permissions/organization/${organizationId}/batch`, permissions);
    return response.data;
  } catch (error) {
    console.error('批量保存权限失败:', error);
    throw error;
  }
};

