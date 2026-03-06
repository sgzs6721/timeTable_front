import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// 创建独立的 axios 实例用于机构管理，不使用全局拦截器
const orgAxios = axios.create({
  baseURL: API_BASE_URL
});

// 为机构管理 axios 实例添加响应拦截器，但不跳转到登录页面
orgAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    // 不跳转到登录页面，直接返回错误
    return Promise.reject(error);
  }
);

const getAuthHeaders = () => {
  // 优先使用机构管理专用 token（sessionStorage），否则使用普通用户 token
  const token = sessionStorage.getItem('orgMgmtToken') || localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// 机构管理访问验证
export const verifyOrgManagementAuth = async (username, password) => {
  const response = await orgAxios.post(
    '/organizations/auth/verify',
    { username, password }
  );
  return response.data;
};

// 获取所有机构
export const getAllOrganizations = async () => {
  const response = await orgAxios.get('/organizations', {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 获取活跃机构
export const getActiveOrganizations = async () => {
  const response = await orgAxios.get('/organizations/active');
  return response.data;
};

// 根据ID获取机构
export const getOrganizationById = async (id) => {
  const response = await orgAxios.get(`/organizations/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 创建机构
export const createOrganization = async (organizationData) => {
  const response = await orgAxios.post(
    '/organizations',
    organizationData,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 更新机构
export const updateOrganization = async (id, organizationData) => {
  const response = await orgAxios.put(
    `/organizations/${id}`,
    organizationData,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 删除机构
export const deleteOrganization = async (id) => {
  const response = await orgAxios.delete(`/organizations/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 获取机构管理员列表
export const getOrganizationAdmins = async (id) => {
  const response = await orgAxios.get(`/organizations/${id}/admins`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 设置用户为机构管理员
export const setOrganizationAdmin = async (organizationId, userId) => {
  const response = await orgAxios.post(
    `/organizations/${organizationId}/admins/${userId}`,
    {},
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 移除机构管理员
export const removeOrganizationAdmin = async (organizationId, userId) => {
  const response = await orgAxios.delete(
    `/organizations/${organizationId}/admins/${userId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 导出别名，供其他模块使用
export const getOrganization = getOrganizationById;

// 机构管理专用：获取所有用户（使用 orgAxios，不会触发 401 登录重定向）
export const getAllUsersForOrgMgmt = async () => {
  const response = await orgAxios.get('/admin/users', {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getUsersByOrganizationForOrgMgmt = async (organizationId) => {
  const response = await orgAxios.get('/admin/users', {
    headers: getAuthHeaders(),
    params: { organizationId }
  });
  return response.data;
};

export const updateUserInfoForOrgMgmt = async (userId, data) => {
  const response = await orgAxios.put(`/admin/users/${userId}`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 查询微信用户的申请状态
export const checkRequestStatus = async (wechatUserInfo) => {
  const response = await orgAxios.post(
    '/auth/wechat/check-request-status',
    { wechatUserInfo }
  );
  return response.data;
};

// 获取待审批的机构申请数量
export const getPendingRequestsCount = async () => {
  const response = await orgAxios.get('/organization-requests/pending', {
    headers: getAuthHeaders()
  });
  if (response.data.success) {
    const requests = response.data.data || [];
    // 只统计状态为 PENDING 的申请
    return requests.filter(req => req.status === 'PENDING').length;
  }
  return 0;
};

/**
 * 获取机构通知设置
 */
export const getOrganizationNotificationSettings = async (organizationId) => {
  const response = await orgAxios.get(`/organizations/${organizationId}/notifications`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

/**
 * 更新机构通知设置
 */
export const updateOrganizationNotificationSettings = async (organizationId, notificationSettings) => {
  const response = await orgAxios.put(
    `/organizations/${organizationId}/notifications`,
    notificationSettings,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

