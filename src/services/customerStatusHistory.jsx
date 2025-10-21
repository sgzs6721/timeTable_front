import { getApiBaseUrl } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const changeCustomerStatus = async (customerId, data) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/customers/${customerId}/status-history/change`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('切换状态失败:', error);
    throw error;
  }
};

export const getCustomerStatusHistory = async (customerId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/customers/${customerId}/status-history`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('获取状态历史失败:', error);
    throw error;
  }
};

