import api from './auth';

// 创建客户
export const createCustomer = (customerData) => {
  return api.post('/customers', customerData);
};

// 获取客户列表
export const getCustomers = () => {
  return api.get('/customers');
};

// 获取客户详情
export const getCustomerById = (id) => {
  return api.get(`/customers/${id}`);
};

// 更新客户
export const updateCustomer = (id, customerData) => {
  return api.put(`/customers/${id}`, customerData);
};

// 删除客户
export const deleteCustomer = (id) => {
  return api.delete(`/customers/${id}`);
};

// 根据状态获取客户
export const getCustomersByStatus = (status) => {
  return api.get(`/customers/status/${status}`);
};
