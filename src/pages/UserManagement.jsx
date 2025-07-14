import React, { useState, useEffect } from 'react';
import { Table, Button, message, Space, Tag, Modal, Select, Input, Tooltip } from 'antd';
import { UserOutlined, CrownOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAllUsers, updateUserRole, resetUserPassword, deleteUser, updateUserNickname } from '../services/admin';
import './UserManagement.css';

const { Option } = Select;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [nicknameLoading, setNicknameLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      if (response.success) {
        setUsers(response.data);
      } else {
        message.error(response.message || '获取用户列表失败');
      }
    } catch (error) {
      message.error('获取用户列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setRoleModalVisible(true);
  };

  const handleResetPassword = (user) => {
    setEditingUser(user);
    setNewPassword('');
    setPasswordModalVisible(true);
  };

  const handleEditNickname = (user) => {
    setEditingUser(user);
    setNewNickname(user.nickname || '');
    setNicknameModalVisible(true);
  };

  const handleDeleteUser = (user) => {
    Modal.confirm({
      title: `确定要删除用户 ${user.username} 吗？`,
      content: '此操作将软删除用户，用户数据仍会保留，但用户将无法登录。此操作不可逆。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await deleteUser(user.id);
          if (response.success) {
            message.success('用户删除成功');
            fetchUsers();
          } else {
            message.error(response.message || '删除用户失败');
          }
        } catch (error) {
          message.error('删除用户失败，请检查网络连接');
        }
      },
    });
  };

  const handleUpdateRole = async () => {
    if (!editingUser || !selectedRole) {
      message.error('请选择角色');
      return;
    }

    if (selectedRole === editingUser.role) {
      message.warning('用户角色未发生变化');
      setRoleModalVisible(false);
      return;
    }

    setRoleLoading(true);
    try {
      const response = await updateUserRole(editingUser.id, selectedRole);
      if (response.success) {
        message.success('用户权限更新成功');
        setRoleModalVisible(false);
        fetchUsers(); // 重新获取用户列表
      } else {
        message.error(response.message || '更新用户权限失败');
      }
    } catch (error) {
      message.error('更新用户权限失败，请检查网络连接');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!editingUser || !newPassword) {
      message.error('请输入新密码');
      return;
    }

    if (newPassword.length < 6) {
      message.error('密码至少6个字符');
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await resetUserPassword(editingUser.id, newPassword);
      if (response.success) {
        message.success('密码重置成功');
        setPasswordModalVisible(false);
        setNewPassword('');
      } else {
        message.error(response.message || '密码重置失败');
      }
    } catch (error) {
      message.error('密码重置失败，请检查网络连接');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!editingUser) {
      return;
    }

    if (newNickname && newNickname.length > 50) {
      message.error('昵称长度不能超过50个字符');
      return;
    }

    setNicknameLoading(true);
    try {
      const response = await updateUserNickname(editingUser.id, newNickname);
      if (response.success) {
        message.success('昵称更新成功');
        setNicknameModalVisible(false);
        setNewNickname('');
        // 更新用户列表
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === editingUser.id 
              ? { ...user, nickname: newNickname }
              : user
          )
        );
      } else {
        message.error(response.message || '昵称更新失败');
      }
    } catch (error) {
      message.error('昵称更新失败，请检查网络连接');
    } finally {
      setNicknameLoading(false);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      align: 'left',
      onHeaderCell: () => ({
        style: { textAlign: 'center' },
      }),
      render: (text, record) => {
        const displayName = record.nickname || text;
        const showText = displayName && displayName.length > 7 ? displayName.slice(0, 7) + '…' : displayName;
        return (
          <Space>
            {record.role === 'ADMIN' 
              ? <CrownOutlined style={{ color: '#f5222d' }} /> 
              : <UserOutlined style={{ color: '#1890ff' }} />}
            <Tooltip title={`用户名: ${text}${record.nickname ? ` | 昵称: ${record.nickname}` : ''}`} placement="topLeft" mouseEnterDelay={0.2}>
              <span 
                style={{ fontWeight: 'bold', cursor: 'pointer', color: '#1890ff' }}
                onClick={() => handleEditNickname(record)}
              >
                {showText}
              </span>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: '当前角色',
      dataIndex: 'role',
      key: 'role',
      align: 'center',
      render: (role) => (
        <Tag 
          color={role === 'ADMIN' ? 'red' : 'blue'} 
          style={{ minWidth: '80px', textAlign: 'center' }}
        >
          {role === 'ADMIN' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <div className="actions-container">
          <Space size={0}>
            <Button 
              type="text" 
              className="action-button"
              icon={<CrownOutlined />}
              onClick={() => handleEditRole(record)}
              title="变更权限"
              style={{ fontSize: '16px', color: '#722ed1', padding: '0 6px' }}
            />
            <Button 
              type="text" 
              className="action-button"
              icon={<KeyOutlined />}
              onClick={() => handleResetPassword(record)}
              title="重置密码"
              style={{ fontSize: '16px', color: '#fa8c16', padding: '0 6px' }}
            />
            <Button
              type="text"
              className="action-button"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteUser(record)}
              title="删除用户"
              disabled={record.role === 'ADMIN'}
              style={{
                fontSize: '16px',
                color: record.role === 'ADMIN' ? undefined : '#f5222d',
                padding: '0 6px'
              }}
            />
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div>

      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* 修改权限Modal */}
      <Modal
        title="修改用户权限"
        open={roleModalVisible}
        onOk={handleUpdateRole}
        onCancel={() => {
          setRoleModalVisible(false);
          setRoleLoading(false);
        }}
        okText="确认修改"
        cancelText="取消"
        confirmLoading={roleLoading}
      >
        {editingUser && (
          <div style={{ padding: '16px 0' }}>
            <p><strong>用户名：</strong>{editingUser.username}</p>
            <p><strong>当前角色：</strong>
              <Tag 
                color={editingUser.role === 'ADMIN' ? 'red' : 'blue'} 
                style={{ marginLeft: 8 }}
              >
                {editingUser.role === 'ADMIN' ? '管理员' : '普通用户'}
              </Tag>
            </p>
            <div style={{ marginTop: 16 }}>
              <label><strong>选择新角色：</strong></label>
              <Select
                value={selectedRole}
                onChange={setSelectedRole}
                style={{ width: '100%', marginTop: 8 }}
                placeholder="请选择角色"
              >
                <Option value="USER">
                  <Space>
                    <UserOutlined />
                    <span>普通用户</span>
                  </Space>
                </Option>
                <Option value="ADMIN">
                  <Space>
                    <CrownOutlined />
                    <span>管理员</span>
                  </Space>
                </Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>

      {/* 重置密码Modal */}
      <Modal
        title="重置用户密码"
        open={passwordModalVisible}
        onOk={handleUpdatePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          setPasswordLoading(false);
        }}
        okText="确认重置"
        cancelText="取消"
        confirmLoading={passwordLoading}
      >
        {editingUser && (
          <div style={{ padding: '16px 0' }}>
            <p><strong>用户名：</strong>{editingUser.username}</p>
            <div style={{ marginTop: 16 }}>
              <label><strong>新密码：</strong></label>
              <Input.Password
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ marginTop: 8 }}
                placeholder="请输入新密码（至少6个字符）"
                autoComplete="new-password"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑昵称Modal */}
      <Modal
        title="编辑用户昵称"
        open={nicknameModalVisible}
        onOk={handleUpdateNickname}
        onCancel={() => {
          setNicknameModalVisible(false);
          setNicknameLoading(false);
        }}
        okText="确认修改"
        cancelText="取消"
        confirmLoading={nicknameLoading}
      >
        {editingUser && (
          <div style={{ padding: '16px 0' }}>
            <p><strong>用户名：</strong>{editingUser.username}</p>
            <p><strong>当前昵称：</strong>{editingUser.nickname || '未设置'}</p>
            <div style={{ marginTop: 16 }}>
              <label><strong>新昵称：</strong></label>
              <Input
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="请输入新昵称（可为空）"
                style={{ marginTop: 8 }}
                maxLength={50}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserManagement; 