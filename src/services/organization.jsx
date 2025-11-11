import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// 机构管理访问验证
export const verifyOrgManagementAuth = async (username, password) => {
  const response = await axios.post(
    `${API_BASE_URL}/organizations/auth/verify`,
    { username, password }
  );
  return response.data;
};

// 获取所有机构
export const getAllOrganizations = async () => {
  const response = await axios.get(`${API_BASE_URL}/organizations`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 获取活跃机构
export const getActiveOrganizations = async () => {
  const response = await axios.get(`${API_BASE_URL}/organizations/active`);
  return response.data;
};

// 根据ID获取机构
export const getOrganizationById = async (id) => {
  const response = await axios.get(`${API_BASE_URL}/organizations/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 创建机构
export const createOrganization = async (organizationData) => {
  const response = await axios.post(
    `${API_BASE_URL}/organizations`,
    organizationData,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 更新机构
export const updateOrganization = async (id, organizationData) => {
  const response = await axios.put(
    `${API_BASE_URL}/organizations/${id}`,
    organizationData,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 删除机构
export const deleteOrganization = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/organizations/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 获取机构管理员列表
export const getOrganizationAdmins = async (id) => {
  const response = await axios.get(`${API_BASE_URL}/organizations/${id}/admins`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// 设置用户为机构管理员
export const setOrganizationAdmin = async (organizationId, userId) => {
  const response = await axios.post(
    `${API_BASE_URL}/organizations/${organizationId}/admins/${userId}`,
    {},
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 移除机构管理员
export const removeOrganizationAdmin = async (organizationId, userId) => {
  const response = await axios.delete(
    `${API_BASE_URL}/organizations/${organizationId}/admins/${userId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// 导出别名，供其他模块使用
export const getOrganization = getOrganizationById;

// 查询微信用户的申请状态
export const checkRequestStatus = async (wechatUserInfo) => {
  const response = await axios.post(
    `${API_BASE_URL}/auth/wechat/check-request-status`,
    { wechatUserInfo }
  );
  return response.data;
};

// 获取待审批的机构申请数量
export const getPendingRequestsCount = async () => {
  const response = await axios.get(`${API_BASE_URL}/organization-requests/pending`, {
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
  const response = await axios.get(`${API_BASE_URL}/organizations/${organizationId}/notifications`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

/**
 * 更新机构通知设置
 */
export const updateOrganizationNotificationSettings = async (organizationId, notificationSettings) => {
  const response = await axios.put(
    `${API_BASE_URL}/organizations/${organizationId}/notifications`,
    notificationSettings,
    { headers: getAuthHeaders() }
  );
  return response.data;
};

