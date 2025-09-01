import React, { useState, useEffect } from 'react';
import { Modal, Select, Input, Form, message, Spin } from 'antd';
import { CopyOutlined, UserOutlined } from '@ant-design/icons';
import { getAllUsers, copyTimetableToUser } from '../services/admin';

const { Option } = Select;

const CopyTimetableModal = ({ visible, onCancel, onSuccess, timetable }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchUsers();
      // 重置表单并设置默认值
      form.resetFields();
      form.setFieldsValue({
        newTimetableName: timetable?.name || ''
      });
    }
  }, [visible, timetable]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await getAllUsers();
      if (response.success) {
        // 过滤掉当前课表的所有者
        const availableUsers = response.data.filter(user => user.id !== timetable?.userId);
        setUsers(availableUsers);
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      message.error('获取用户列表失败，请检查网络连接');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await copyTimetableToUser(
        timetable.id,
        values.targetUserId,
        values.newTimetableName
      );

      if (response.success) {
        message.success(`课表已成功复制到用户 ${response.data.targetUserName}`);
        form.resetFields();
        onSuccess && onSuccess(response.data);
        onCancel();
      } else {
        message.error(response.message || '复制课表失败');
      }
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('复制课表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (user) => {
    return user.nickname || user.username;
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CopyOutlined />
          <span>复制课表</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="确认复制"
      cancelText="取消"
      width={520}
      destroyOnClose
    >
      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '6px' }}>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>源课表信息：</div>
        <div style={{ color: '#666' }}>
          {timetable?.name} ({timetable?.isWeekly ? '周固定课表' : '日期范围课表'})
        </div>
        <div style={{ color: '#666', fontSize: '12px' }}>
          所属用户：{timetable?.nickname || timetable?.username || timetable?.userName}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          name="targetUserId"
          label="目标用户"
          rules={[{ required: true, message: '请选择目标用户' }]}
        >
          <Select
            placeholder="请选择要复制到的用户"
            loading={loadingUsers}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => {
              const user = users.find(u => u.id === option.value);
              if (!user) return false;
              const displayName = getUserDisplayName(user);
              return displayName.toLowerCase().includes(input.toLowerCase());
            }}
            notFoundContent={loadingUsers ? <Spin size="small" /> : '暂无可选用户'}
          >
            {users.map(user => (
              <Option key={user.id} value={user.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserOutlined />
                    <span>{getUserDisplayName(user)}</span>
                  </div>
                  <span style={{ color: '#666', fontSize: '12px' }}>
                    {user.role === 'ADMIN' ? '管理员' : '普通用户'}
                  </span>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="newTimetableName"
          label="新课表名称"
          rules={[{ required: true, message: '请输入新课表名称' }]}
        >
          <Input
            placeholder="请输入新课表名称"
            maxLength={100}
            showCount
          />
        </Form.Item>
      </Form>

      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff7e6', borderRadius: '6px', border: '1px solid #ffd666' }}>
        <div style={{ fontSize: '12px', color: '#d46b08' }}>
          <div>• 复制后的课表将包含原课表的所有课程信息</div>
          <div>• 如果目标用户没有活动课表，复制的课表将自动设为活动状态</div>
          <div>• 每个用户最多只能有5个非归档课表</div>
        </div>
      </div>
    </Modal>
  );
};

export default CopyTimetableModal;
