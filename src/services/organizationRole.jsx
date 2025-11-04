import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    ...api.defaults.headers.common,
    'Authorization': `Bearer ${token}`,
  };
};

export const getOrganizationRoles = async (organizationId) => {
  const response = await api.get(`/organization-roles/organization/${organizationId}`, { headers: getAuthHeaders() });
  return response.data;
};

export const getRoleById = async (id) => {
  const response = await api.get(`/organization-roles/${id}`, { headers: getAuthHeaders() });
  return response.data;
};

export const createRole = async (roleData) => {
  const response = await api.post('/organization-roles', roleData, { headers: getAuthHeaders() });
  return response.data;
};

export const updateRole = async (id, roleData) => {
  const response = await api.put(`/organization-roles/${id}`, roleData, { headers: getAuthHeaders() });
  return response.data;
};

export const deleteRole = async (id) => {
  const response = await api.delete(`/organization-roles/${id}`, { headers: getAuthHeaders() });
  return response.data;
};

export const getRoleMemberCount = async (roleId) => {
  const response = await api.get(`/organization-roles/${roleId}/member-count`, { headers: getAuthHeaders() });
  return response.data;
};

export const assignRoleToUser = async (roleId, userId) => {
  const response = await api.post(`/organization-roles/${roleId}/members/${userId}`, {}, { headers: getAuthHeaders() });
  return response.data;
};

export const removeUserFromRole = async (roleId, userId) => {
  const response = await api.delete(`/organization-roles/${roleId}/members/${userId}`, { headers: getAuthHeaders() });
  return response.data;
};

export const assignRoleToUsers = async (roleId, userIds) => {
  const response = await api.post(`/organization-roles/${roleId}/members/batch`, userIds, { headers: getAuthHeaders() });
  return response.data;
};

