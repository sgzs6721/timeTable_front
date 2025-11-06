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
        // 获取销售和管理职位的人员
        const users = (data.data || []).filter(u => 
          u.position === 'SALES' || u.position === 'MANAGER'
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
                <strong>已分配给：</strong>{customer.assignedSalesName}
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
              placeholder="请选择分配对象"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {salesList.map(user => {
                let positionText = '';
                if (user.position === 'COACH') positionText = ' (教练)';
                else if (user.position === 'SALES') positionText = ' (销售)';
                else if (user.position === 'RECEPTIONIST') positionText = ' (前台)';
                else if (user.position === 'MANAGER') positionText = ' (管理)';
                
                return (
                  <Option key={user.id} value={user.id}>
                    {user.nickname || user.username}{positionText}
                  </Option>
                );
              })}
            </Select>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AssignCustomerModal;

