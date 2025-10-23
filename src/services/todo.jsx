import { getApiBaseUrl } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// 创建待办
export const createTodo = async (todoData) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(todoData)
    });
    return await response.json();
  } catch (error) {
    console.error('创建待办失败:', error);
    throw error;
  }
};

// 获取待办列表
export const getTodos = async (status = null) => {
  try {
    const url = status 
      ? `${getApiBaseUrl()}/todos?status=${status}` 
      : `${getApiBaseUrl()}/todos`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('获取待办列表失败:', error);
    throw error;
  }
};

// 获取未读待办数量
export const getUnreadTodoCount = async () => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/unread/count`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('获取未读待办数量失败:', error);
    throw error;
  }
};

// 更新待办状态
export const updateTodoStatus = async (todoId, status) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/${todoId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return await response.json();
  } catch (error) {
    console.error('更新待办状态失败:', error);
    throw error;
  }
};

// 标记待办为已读
export const markTodoAsRead = async (todoId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/${todoId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('标记待办为已读失败:', error);
    throw error;
  }
};

// 标记待办为已完成
export const markTodoAsCompleted = async (todoId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/${todoId}/complete`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('标记待办为已完成失败:', error);
    throw error;
  }
};

// 删除待办
export const deleteTodo = async (todoId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/${todoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('删除待办失败:', error);
    throw error;
  }
};

// 检查客户是否有待办
export const checkCustomerHasTodo = async (customerId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/customer/${customerId}/exists`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('检查客户待办失败:', error);
    return { success: false, data: false };
  }
};

// 获取客户最新的待办
export const getLatestTodoByCustomer = async (customerId) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/customer/${customerId}/latest`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (error) {
    console.error('获取客户最新待办失败:', error);
    return { success: false, data: null };
  }
};

// 更新待办
export const updateTodo = async (todoId, todoData) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/todos/${todoId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(todoData)
    });
    return await response.json();
  } catch (error) {
    console.error('更新待办失败:', error);
    throw error;
  }
};

