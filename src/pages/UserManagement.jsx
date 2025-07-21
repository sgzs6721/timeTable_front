import React, { useState, useEffect } from 'react';
import { Table, Button, message, Space, Tag, Modal, Select, Input, Tooltip, Spin, Badge, Tabs } from 'antd';
import { UserOutlined, CrownOutlined, KeyOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { getAllUsers, updateUserRole, resetUserPassword, deleteUser, updateUserNickname, getAllRegistrationRequests, approveUserRegistration, rejectUserRegistration } from '../services/admin';
import './UserManagement.css';

const { Option } = Select;

const UserManagement = ({ activeTab = 'users' }) => {
  const [users, setUsers] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
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
    if (activeTab === 'pending') {
      fetchRegistrationRequests();
    }
  }, [activeTab]);

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

  const fetchRegistrationRequests = async () => {
    setRequestsLoading(true);
    try {
      const response = await getAllRegistrationRequests();
      if (response.success) {
        setRegistrationRequests(response.data);
      } else {
        message.error(response.message || '获取注册申请记录失败');
      }
    } catch (error) {
      message.error('获取注册申请记录失败，请检查网络连接');
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    Modal.confirm({
      title: '确认批准用户注册申请',
      content: '确定要批准该用户的注册申请吗？批准后用户将可以登录系统。',
      okText: '批准',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await approveUserRegistration(userId);
          if (response.success) {
            message.success('用户注册申请已批准');
            fetchRegistrationRequests();
            fetchUsers(); // 刷新用户列表
          } else {
            message.error(response.message || '批准失败');
          }
        } catch (error) {
          message.error('批准失败，请检查网络连接');
        }
      },
    });
  };

  const handleRejectUser = async (userId) => {
    Modal.confirm({
      title: '确认拒绝用户注册申请',
      content: '确定要拒绝该用户的注册申请吗？拒绝后用户将无法登录系统。',
      okText: '拒绝',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await rejectUserRegistration(userId);
          if (response.success) {
            message.success('用户注册申请已拒绝');
            fetchRegistrationRequests();
          } else {
            message.error(response.message || '拒绝失败');
          }
        } catch (error) {
          message.error('拒绝失败，请检查网络连接');
        }
      },
    });
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

  const pendingColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      align: 'left',
      render: (text, record) => {
        const isPending = record.status === 'PENDING';
        const isApproved = record.status === 'APPROVED';
        const isRejected = record.status === 'REJECTED';
        
        return (
          <Space>
            {isPending && <ClockCircleOutlined style={{ color: '#faad14' }} />}
            {isApproved && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            {isRejected && <StopOutlined style={{ color: '#ff4d4f' }} />}
            <span style={{ fontWeight: 'bold' }}>{text}</span>
            <Tag 
              color={isPending ? 'orange' : isApproved ? 'green' : 'red'} 
              size="small"
            >
              {isPending ? '待审批' : isApproved ? '已批准' : '已拒绝'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      align: 'center',
      render: (text) => text || '-',
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const isPending = record.status === 'PENDING';
        
        if (!isPending) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApproveUser(record.id)}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              批准
            </Button>
            <Button
              type="primary"
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleRejectUser(record.id)}
            >
              拒绝
            </Button>
          </Space>
        );
      },
    },
  ];

  // 统计待审批数量
  const pendingCount = registrationRequests.filter(r => r.status === 'PENDING').length;

  if (activeTab === 'pending') {
    return (
      <Spin spinning={requestsLoading} tip="加载中...">
        <div style={{ minHeight: '200px' }}>
          {!requestsLoading && registrationRequests.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#999',
              fontSize: '16px'
            }}>
              <ClockCircleOutlined style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }} />
              暂无注册申请记录
            </div>
          ) : !requestsLoading && (
            <div style={{ padding: '16px 0' }}>
              {registrationRequests.map((request) => {
                const isPending = request.status === 'PENDING';
                const isApproved = request.status === 'APPROVED';
                const isRejected = request.status === 'REJECTED';
                return (
                  <div
                    key={request.id}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      marginBottom: '12px',
                      backgroundColor: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.3s ease',
                      opacity: isPending ? 1 : 0.7
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {isPending && <ClockCircleOutlined style={{ color: '#faad14', fontSize: '16px', marginRight: '6px' }} />}
                            {isApproved && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px', marginRight: '6px' }} />}
                            {isRejected && <StopOutlined style={{ color: '#ff4d4f', fontSize: '16px', marginRight: '6px' }} />}
                            <span style={{ 
                              fontWeight: 'bold', 
                              fontSize: '15px',
                              color: '#262626',
                              marginRight: '12px',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {request.username}
                            </span>
                            <span style={{ 
                              color: '#8c8c8c', 
                              fontSize: '13px',
                              maxWidth: '150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              昵称：{request.nickname || '未设置'}
                            </span>
                          </div>
                          <Tag 
                            color={isPending ? 'orange' : isApproved ? 'green' : 'red'} 
                            size="small"
                          >
                            {isPending ? '待审批' : isApproved ? '已批准' : '已拒绝'}
                          </Tag>
                        </div>
                        <div style={{ 
                          color: '#8c8c8c', 
                          fontSize: '13px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <span>申请时间：</span>
                          <span style={{ color: '#262626' }}>
                            {new Date(request.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {isPending && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}>
                          <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => handleApproveUser(request.id)}
                            size="small"
                            style={{ 
                              backgroundColor: '#52c41a', 
                              borderColor: '#52c41a',
                              width: '70px',
                              height: '28px',
                              fontSize: '12px',
                              padding: '0 8px'
                            }}
                            title="批准注册申请"
                          >
                            批准
                          </Button>
                          <Button
                            type="primary"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => handleRejectUser(request.id)}
                            size="small"
                            style={{
                              width: '70px',
                              height: '28px',
                              fontSize: '12px',
                              padding: '0 8px'
                            }}
                            title="拒绝注册申请"
                          >
                            拒绝
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Spin>
    );
  }

  // 权限管理内容
  return (
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
  );
};

export default UserManagement; 