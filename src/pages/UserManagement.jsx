import React, { useState, useEffect } from 'react';
import { Table, Button, message, Space, Tag, Modal, Select, Input, Tooltip, Spin, Badge, Tabs } from 'antd';
import { CrownOutlined, KeyOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined, CheckCircleOutlined, StopOutlined, UserAddOutlined, FilterOutlined } from '@ant-design/icons';
import { getAllUsers, createUser, updateUserInfo, updateUserRole, resetUserPassword, deleteUser, updateUserNickname, updateUserUsername, getAllRegistrationRequests, approveUserRegistration, rejectUserRegistration } from '../services/admin';
import { getOrganizationRoles } from '../services/organizationRole';
import Footer from '../components/Footer';
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
  const [createUserModalVisible, setCreateUserModalVisible] = useState(false);
  // 注册审批：职位选择
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState(null);
  const [approvePosition, setApprovePosition] = useState('COACH');
  const [orgRoles, setOrgRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [checkingManager, setCheckingManager] = useState(false);
  const [hasManagerInOrg, setHasManagerInOrg] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [nicknameLoading, setNicknameLoading] = useState(false);
  
  // 过滤状态
  const [positionFilter, setPositionFilter] = useState('all');
  
  // 新用户表单
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '123456',
    nickname: '',
    role: 'USER',
    position: 'COACH'
  });
  const [createUserLoading, setCreateUserLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'pending') {
      fetchRegistrationRequests();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      if (response && response.success) {
        setUsers(response.data || []);
      } else {
        message.error(response?.message || '获取用户列表失败');
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

  const handleApproveUser = async (request) => {
    // 记录当前申请
    setApprovingRequest(request);
    setApprovePosition('COACH');
    setOrgRoles([]);
    setHasManagerInOrg(false);
    setApproveModalVisible(true);
    // 如果带有机构信息，拉取该机构职位并检查是否已有管理职位成员
    const organizationId = request?.organizationId;
    if (organizationId) {
      try {
        setLoadingRoles(true);
        const res = await getOrganizationRoles(organizationId);
        if (res.success) {
          const roles = res.data || [];
          setOrgRoles(roles);
          // 默认选中第一个或COACH
          setApprovePosition(roles[0]?.roleCode || 'COACH');
        }
      } catch (_) {
        setOrgRoles([]);
      } finally {
        setLoadingRoles(false);
      }
      // 检查是否已有管理职位
      try {
        setCheckingManager(true);
        const usersRes = await getAllUsers();
        if (usersRes?.success) {
          const users = usersRes.data || [];
          const exists = users.some(u => u.organizationId === organizationId && u.position === 'MANAGER' && u.status === 'APPROVED');
          setHasManagerInOrg(exists);
          if (!exists) {
            setApprovePosition('MANAGER');
          }
        }
      } catch (_) {
      } finally {
        setCheckingManager(false);
      }
    }
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
    setSelectedPosition(user.position || '');
    setNewUsername(user.username || '');
    setNewNickname(user.nickname || '');
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

  // 已合并到职位编辑弹窗中，单独的"编辑用户名"入口不再使用

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

  const handleConfirmRoleAndUsername = async () => {
    if (!editingUser) return;
    const payload = {};
    // 用户名变化
    const trimmed = (newUsername || '').trim();
    if (!trimmed) {
      message.error('用户名不能为空');
      return;
    }
    if (trimmed !== editingUser.username) {
      if (trimmed.length < 2 || trimmed.length > 32) {
        message.error('用户名长度需在 2-32 个字符之间');
        return;
      }
      payload.username = trimmed;
    }

    // 昵称变化（可为空，为空表示清除昵称）
    if ((newNickname || '') !== (editingUser.nickname || '')) {
      if (newNickname && newNickname.length > 50) {
        message.error('昵称长度不能超过50个字符');
        return;
      }
      payload.nickname = newNickname || '';
    }

    // 角色：后端要求必须传 USER/ADMIN。若未变更，也要传当前角色。
    payload.role = selectedRole || editingUser.role;

    // 职位变化
    if (selectedPosition !== (editingUser.position || '')) {
      payload.position = selectedPosition;
    }

    if (Object.keys(payload).length === 0 || (Object.keys(payload).length === 1 && payload.role === editingUser.role)) {
      message.warning('未检测到变更');
      setRoleModalVisible(false);
      return;
    }

    setRoleLoading(true);
    try {
      const res = await updateUserInfo(editingUser.id, payload);
      if (res && res.success) {
        message.success('更新成功');
        setRoleModalVisible(false);
        // 更新本地列表
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...payload } : u));
      } else {
        message.error(res?.message || '更新失败');
      }
    } catch (e) {
      message.error('更新失败，请检查网络连接');
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

  const handleUpdateUsername = async () => {
    if (!editingUser) return;
    const trimmed = (newUsername || '').trim();
    if (!trimmed) {
      message.error('用户名不能为空');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 32) {
      message.error('用户名长度需在 2-32 个字符之间');
      return;
    }
    setUsernameLoading(true);
    try {
      const response = await updateUserUsername(editingUser.id, trimmed);
      if (response.success) {
        message.success('用户名更新成功');
        setUsernameModalVisible(false);
        setNewUsername('');
        // 更新用户列表
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, username: trimmed } : u));
      } else {
        message.error(response.message || '用户名更新失败');
      }
    } catch (e) {
      message.error('用户名更新失败，请检查网络连接');
    } finally {
      setUsernameLoading(false);
    }
  };

  // 处理新建用户
  const handleCreateUser = () => {
    setNewUserForm({
      username: '',
      password: '123456',
      nickname: '',
      role: 'USER',
      position: 'COACH'
    });
    setCreateUserModalVisible(true);
  };

  // 确认创建新用户
  const handleConfirmCreateUser = async () => {
    const { username, password, nickname, role, position } = newUserForm;
    
    if (!username || !username.trim()) {
      message.error('用户名不能为空');
      return;
    }
    
    if (username.trim().length < 2 || username.trim().length > 32) {
      message.error('用户名长度需在 2-32 个字符之间');
      return;
    }
    
    if (!password || password.length < 6) {
      message.error('密码至少6个字符');
      return;
    }
    
    if (nickname && nickname.length > 50) {
      message.error('昵称长度不能超过50个字符');
      return;
    }
    
    setCreateUserLoading(true);
    try {
      const payload = {
        username: username.trim(),
        password: password,
        nickname: nickname.trim() || null,
        role: role,
        position: position
      };
      
      const response = await createUser(payload);
      
      if (response && response.success) {
        message.success('用户创建成功');
        setCreateUserModalVisible(false);
        // 刷新用户列表
        fetchUsers();
        // 重置表单
        setNewUserForm({
          username: '',
          password: '123456',
          nickname: '',
          role: 'USER',
          position: 'COACH'
        });
      } else {
        message.error(response?.message || '创建用户失败');
      }
    } catch (error) {
      message.error('创建用户失败，请检查网络连接');
    } finally {
      setCreateUserLoading(false);
    }
  };

  // 过滤用户数据
  const filteredUsers = users.filter(user => {
    if (positionFilter === 'all') return true;
    if (positionFilter === 'admin') return user.position === 'MANAGER';
    if (positionFilter === 'no_position') return user.position !== 'MANAGER' && !user.position;
    return user.position === positionFilter;
  });

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      align: 'center',
      render: (text, record) => {
        const displayName = record.nickname || text;
        const showText = displayName && displayName.length > 10 ? displayName.slice(0, 10) + '…' : displayName;
        return (
          <Tooltip title={`用户名: ${text}${record.nickname ? ` | 昵称: ${record.nickname}` : ''}`} placement="topLeft" mouseEnterDelay={0.2}>
            <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{showText}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '当前职位',
      dataIndex: 'role',
      key: 'role',
      align: 'center',
      render: (role, record) => {
        const positionMap = {
          'COACH': { label: '教练', bgColor: 'rgba(82, 196, 26, 0.15)', textColor: '#52c41a', borderColor: 'rgba(82, 196, 26, 0.3)' },
          'SALES': { label: '销售', bgColor: 'rgba(250, 140, 22, 0.15)', textColor: '#fa8c16', borderColor: 'rgba(250, 140, 22, 0.3)' },
          'RECEPTIONIST': { label: '前台', bgColor: 'rgba(114, 46, 209, 0.15)', textColor: '#722ed1', borderColor: 'rgba(114, 46, 209, 0.3)' },
          'MANAGER': { label: '管理', bgColor: 'rgba(24, 144, 255, 0.15)', textColor: '#1890ff', borderColor: 'rgba(24, 144, 255, 0.3)' }
        };
        
        const roleLabel = record.position === 'MANAGER' ? '管理员' : '普通用户';
        const roleBgColor = record.position === 'MANAGER' ? 'rgba(245, 34, 45, 0.15)' : 'rgba(24, 144, 255, 0.15)';
        const roleTextColor = record.position === 'MANAGER' ? '#f5222d' : '#1890ff';
        const roleBorderColor = record.position === 'MANAGER' ? 'rgba(245, 34, 45, 0.3)' : 'rgba(24, 144, 255, 0.3)';
        
        // 如果没有职位，只显示角色标签
        if (!record.position) {
          return (
            <div style={{
              display: 'inline-block',
              backgroundColor: roleBgColor,
              color: roleTextColor,
              borderRadius: '4px',
              padding: '2px 10px',
              fontSize: '12px',
              minWidth: '80px',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {roleLabel}
            </div>
          );
        }
        
        // 如果有职位，显示分割标签（管理员和普通用户都一样）
        const positionInfo = positionMap[record.position] || { 
          label: record.position, 
          bgColor: 'rgba(24, 144, 255, 0.15)', 
          textColor: '#1890ff',
          borderColor: 'rgba(24, 144, 255, 0.3)'
        };
        
        return (
          <div style={{ 
            display: 'inline-flex',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              backgroundColor: roleBgColor,
              color: roleTextColor,
              padding: '2px 8px',
              fontSize: '12px',
              minWidth: '55px',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {roleLabel}
            </div>
            <div style={{ 
              backgroundColor: positionInfo.bgColor,
              color: positionInfo.textColor,
              padding: '2px 8px',
              fontSize: '12px',
              minWidth: '40px',
              textAlign: 'center',
              borderLeft: `1px solid ${positionInfo.borderColor}`,
              fontWeight: 500
            }}>
              {positionInfo.label}
            </div>
          </div>
        );
      },
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEditRole(record);
              }}
              title="变更职位"
              style={{ fontSize: '16px', color: '#722ed1', padding: '0 6px' }}
            />
            
            <Button 
              type="text" 
              className="action-button"
              icon={<KeyOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResetPassword(record);
              }}
              title="重置密码"
              style={{ fontSize: '16px', color: '#fa8c16', padding: '0 6px' }}
            />
            <Button
              type="text"
              className="action-button"
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteUser(record);
              }}
              title="删除用户"
              disabled={record.position === 'MANAGER'}
              style={{
                fontSize: '16px',
                color: record.position === 'MANAGER' ? undefined : '#f5222d',
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleApproveUser(record);
              }}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              批准
            </Button>
            <Button
              type="primary"
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRejectUser(record.id);
              }}
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
      <Spin spinning={requestsLoading}>
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
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
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
                      opacity: isPending ? 1 : 0.7,
                      position: 'relative',
                      width: '100%',
                      maxWidth: '600px'
                    }}
                  >
                    {/* 状态标签 - 右上角 */}
                    <Tag 
                      color={isPending ? 'orange' : isApproved ? 'green' : 'red'} 
                      size="small"
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '16px'
                      }}
                    >
                      {isPending ? '待审批' : isApproved ? '已批准' : '已拒绝'}
                    </Tag>
                    
                    {/* 用户名行 */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', paddingRight: '80px' }}>
                      {isPending && <ClockCircleOutlined style={{ color: '#faad14', fontSize: '16px', marginRight: '6px', flexShrink: 0 }} />}
                      {isApproved && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px', marginRight: '6px', flexShrink: 0 }} />}
                      {isRejected && <StopOutlined style={{ color: '#ff4d4f', fontSize: '16px', marginRight: '6px', flexShrink: 0 }} />}
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '15px',
                        color: '#262626',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {request.username}
                      </span>
                    </div>
                    
                    {/* 昵称行 */}
                    <div style={{ 
                      color: '#8c8c8c', 
                      fontSize: '13px',
                      marginBottom: '6px',
                      paddingLeft: '22px',
                      paddingRight: '80px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      昵称：{request.nickname || '未设置'}
                    </div>
                    
                    {/* 申请时间行 */}
                    <div style={{ 
                      color: '#8c8c8c', 
                      fontSize: '13px',
                      paddingLeft: '22px',
                      paddingRight: '80px',
                      marginBottom: isPending ? '12px' : '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <span>申请时间：</span>
                      <span style={{ color: '#262626' }}>
                        {new Date(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    {/* 按钮区域 - 下方右对齐 */}
                    {isPending && (
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        paddingTop: '8px',
                        borderTop: '1px solid #f0f0f0',
                        marginLeft: '-16px',
                        marginRight: '-16px',
                        paddingLeft: '16px',
                        paddingRight: '16px'
                      }}>
                          <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleApproveUser(request);
                            }}
                            size="small"
                            style={{ 
                              backgroundColor: '#52c41a', 
                              borderColor: '#52c41a',
                              width: '80px',
                              height: '32px',
                              fontSize: '13px'
                            }}
                            title="批准注册申请"
                          >
                            批准
                          </Button>
                          <Button
                            type="primary"
                            danger
                            icon={<CloseOutlined />}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRejectUser(request.id);
                            }}
                            size="small"
                            style={{
                              width: '80px',
                              height: '32px',
                              fontSize: '13px'
                            }}
                            title="拒绝注册申请"
                          >
                            拒绝
                          </Button>
                        </div>
                      )}
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
    <>
      {/* 表格上方的操作栏 */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <Button 
          type="primary" 
          icon={<UserAddOutlined />}
          onClick={handleCreateUser}
        >
          新建用户
        </Button>
        
        <Select
          value={positionFilter}
          onChange={setPositionFilter}
          style={{ minWidth: '140px' }}
          suffixIcon={<FilterOutlined />}
        >
          <Option value="all">全部职位</Option>
          <Option value="COACH">教练</Option>
          <Option value="SALES">销售</Option>
          <Option value="RECEPTIONIST">前台</Option>
          <Option value="MANAGER">管理</Option>
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={filteredUsers}
        loading={loading}
        rowKey="id"
        className="user-management-table"
        pagination={filteredUsers.length > 10 ? {
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        } : false}
        scroll={{ x: 'max-content' }}
      />
      
      {/* 表格下方显示总记录数 */}
      {filteredUsers.length <= 10 && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          color: '#999',
          fontSize: '14px'
        }}>
          共 {filteredUsers.length} 条记录
        </div>
      )}
      
      {/* 职位编辑模态框 */}
      <Modal
        title="编辑用户信息"
        open={roleModalVisible}
        onOk={handleConfirmRoleAndUsername}
        onCancel={() => setRoleModalVisible(false)}
        confirmLoading={roleLoading}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>用户：{editingUser?.username}</p>
          <p>当前职位：{editingUser?.position === 'MANAGER' ? '管理员' : '普通用户'}</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>新用户名：</label>
          <Input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="请输入新用户名（2-32 个字符）"
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>新昵称：</label>
          <Input
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            placeholder="请输入新昵称（可留空）"
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
        <div>
          <label>新职位：</label>
          <Select
            value={selectedPosition}
            onChange={setSelectedPosition}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="请选择职位"
            allowClear
          >
            <Option value="COACH">教练</Option>
            <Option value="SALES">销售</Option>
            <Option value="RECEPTIONIST">前台</Option>
            <Option value="MANAGER">管理</Option>
          </Select>
        </div>
      </Modal>

      {/* 密码重置模态框 */}
      <Modal
        title="重置用户密码"
        open={passwordModalVisible}
        onOk={handleUpdatePassword}
        onCancel={() => setPasswordModalVisible(false)}
        confirmLoading={passwordLoading}
        okText="确认重置"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>用户：{editingUser?.username}</p>
        </div>
        <div>
          <label>新密码：</label>
          <Input.Password
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="请输入新密码（至少6个字符）"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* 昵称编辑模态框 */}
      <Modal
        title="编辑用户昵称"
        open={nicknameModalVisible}
        onOk={handleUpdateNickname}
        onCancel={() => setNicknameModalVisible(false)}
        confirmLoading={nicknameLoading}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>用户：{editingUser?.username}</p>
          <p>当前昵称：{editingUser?.nickname || '未设置'}</p>
        </div>
        <div>
          <label>新昵称：</label>
          <Input
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            placeholder="请输入新昵称（可选）"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

      {/* 移除单独的用户名编辑弹窗，功能已合并到职位编辑弹窗 */}

      {/* 新建用户模态框 */}
      <Modal
        title="新建用户"
        open={createUserModalVisible}
        onOk={handleConfirmCreateUser}
        onCancel={() => setCreateUserModalVisible(false)}
        confirmLoading={createUserLoading}
        okText="创建"
        cancelText="取消"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              用户名 <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={newUserForm.username}
              onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
              placeholder="请输入用户名（2-32个字符）"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              密码 <span style={{ color: 'red' }}>*</span>
            </label>
            <Input.Password
              value={newUserForm.password}
              onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
              placeholder="请输入密码（至少6个字符）"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>昵称</label>
            <Input
              value={newUserForm.nickname}
              onChange={(e) => setNewUserForm({ ...newUserForm, nickname: e.target.value })}
              placeholder="请输入昵称（可选）"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              职位 <span style={{ color: 'red' }}>*</span>
            </label>
            <Select
              value={newUserForm.role}
              onChange={(value) => setNewUserForm({ ...newUserForm, role: value })}
              style={{ width: '100%' }}
            >
              <Option value="USER">普通用户</Option>
              <Option value="ADMIN">管理员</Option>
            </Select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              职位 <span style={{ color: 'red' }}>*</span>
            </label>
            <Select
              value={newUserForm.position}
              onChange={(value) => setNewUserForm({ ...newUserForm, position: value })}
              style={{ width: '100%' }}
            >
              <Option value="COACH">教练</Option>
              <Option value="SALES">销售</Option>
              <Option value="RECEPTIONIST">前台</Option>
              <Option value="MANAGER">管理</Option>
            </Select>
          </div>
        </div>
      </Modal>
      
      {/* 批准注册：选择职位 */}
      <Modal
        title="确认批准用户注册申请"
        open={approveModalVisible}
        onOk={async () => {
          if (!approvingRequest) return;
          try {
            const resp = await approveUserRegistration(approvingRequest.id, approvePosition || 'COACH');
            if (resp.success) {
              message.success('用户注册申请已批准');
              setApproveModalVisible(false);
              setApprovingRequest(null);
              fetchRegistrationRequests();
              fetchUsers();
            } else {
              message.error(resp.message || '批准失败');
            }
          } catch (_) {
            message.error('批准失败，请检查网络连接');
          }
        }}
        onCancel={() => setApproveModalVisible(false)}
        okText="批准"
        cancelText="取消"
      >
        <div>
          <p style={{ marginBottom: 12 }}>批准后，用户将可以登录系统。</p>
          {approvingRequest?.organizationName && (
            <p style={{ marginBottom: 12 }}>
              申请机构：<strong>{approvingRequest.organizationName}</strong>
            </p>
          )}
          {!checkingManager && !hasManagerInOrg && (
            <div style={{ 
              padding: '10px', 
              background: '#e6f7ff', 
              border: '1px solid #91d5ff', 
              borderRadius: 6, 
              marginBottom: 12 
            }}>
              当前机构暂无管理职位成员，建议设置为<strong>管理</strong>
            </div>
          )}
          <label>请选择职位：</label>
          <Select
            value={approvePosition}
            onChange={setApprovePosition}
            loading={loadingRoles || checkingManager}
            style={{ width: '100%', marginTop: 8 }}
          >
            {orgRoles.length > 0 ? (
              orgRoles.map(role => (
                <Option key={role.id} value={role.roleCode}>{role.roleName}</Option>
              ))
            ) : (
              <>
                <Option value="COACH">教练</Option>
                <Option value="SALES">销售</Option>
                <Option value="RECEPTIONIST">前台</Option>
                <Option value="MANAGER">管理</Option>
              </>
            )}
          </Select>
        </div>
      </Modal>
    </>
  );
};

export default UserManagement; 