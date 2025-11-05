import React, { useState, useEffect } from 'react';
import { Modal, Select, message, Spin } from 'antd';
import { getApiBaseUrl } from '../config/api';

const { Option } = Select;

const AssignCustomerModal = ({ visible, customer, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [salesList, setSalesList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchSalesList();
      // 初始化选中当前分配的销售
      if (customer?.assignedSalesId) {
        setSelectedUserId(customer.assignedSalesId);
      } else {
        setSelectedUserId(null);
      }
    }
  }, [visible, customer]);

  const fetchSalesList = async () => {
    setFetchingUsers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data && data.success) {
        // 获取销售人员和管理员
        const users = (data.data || []).filter(u => 
          u.position === 'SALES' || u.role === 'ADMIN'
        );
        setSalesList(users);
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setFetchingUsers(false);
    }
  };

  const handleOk = () => {
    if (!selectedUserId) {
      message.warning('请选择要分配的人员');
      return;
    }

    if (onSuccess) {
      onSuccess(selectedUserId);
    }
  };

  const handleCancel = () => {
    setSelectedUserId(null);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Modal
      title={`分配客户 - ${customer?.childName || ''}`}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="确认分配"
      cancelText="取消"
      confirmLoading={loading}
    >
      <div style={{ padding: '20px 0' }}>
        {customer && (
          <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ marginBottom: 4 }}>
              <strong>客户姓名：</strong>{customer.childName}
            </div>
            {customer.parentPhone && (
              <div style={{ marginBottom: 4 }}>
                <strong>联系电话：</strong>{customer.parentPhone}
              </div>
            )}
            {customer.assignedSalesName && (
              <div>
                <strong>当前负责人：</strong>{customer.assignedSalesName}
              </div>
            )}
          </div>
        )}

        <div>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: '500' }}>
            选择分配对象
          </div>
          {fetchingUsers ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin />
            </div>
          ) : (
            <Select
              value={selectedUserId}
              onChange={setSelectedUserId}
              style={{ width: '100%' }}
              placeholder="请选择销售人员或管理员"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {salesList.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.nickname || user.username}
                  {user.role === 'ADMIN' && ' (管理员)'}
                  {user.position === 'SALES' && ' (销售)'}
                </Option>
              ))}
            </Select>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: '12px', color: '#999' }}>
          提示：分配后，被分配人可以像自己的客户一样查看和管理该客户
        </div>
      </div>
    </Modal>
  );
};

export default AssignCustomerModal;

