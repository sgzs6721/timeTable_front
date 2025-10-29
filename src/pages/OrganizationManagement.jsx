import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Modal, Form, Input, message, Space, Tag, 
  Popconfirm, Card, Select, Divider, Avatar, List, Tabs
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, 
  TeamOutlined, UserAddOutlined, UserDeleteOutlined,
  ReloadOutlined, EnvironmentOutlined, PhoneOutlined,
  EyeOutlined, SettingOutlined, UsergroupAddOutlined
} from '@ant-design/icons';
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationAdmins,
  setOrganizationAdmin,
  removeOrganizationAdmin
} from '../services/organization';
import { getAllUsers } from '../services/admin';
import OrganizationRequestManagement from './OrganizationRequestManagement';
import './OrganizationManagement.css';

const { Option } = Select;

const OrganizationManagement = () => {
  const [activeTab, setActiveTab] = useState('list');
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState(null);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [avatarErrors, setAvatarErrors] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrganizations();
    fetchUsers();
  }, []);

  const fetchOrganizations = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await getAllOrganizations();
      if (response.success) {
        setOrganizations(response.data || []);
      } else {
        message.error('获取机构列表失败');
      }
    } catch (error) {
      console.error('获取机构列表失败:', error);
      message.error(error.response?.data?.message || '获取机构列表失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      if (response.success) {
        const userData = response.data || [];
        setUsers(userData);
        
        console.log('=====================================');
        console.log('📊 已加载用户列表，总数:', userData.length);
        console.log('前5个用户完整数据:', userData.slice(0, 5));
        
        // 统计每个机构的用户数量
        const orgStats = {};
        userData.forEach(user => {
          const orgId = user.organizationId || 'null';
          orgStats[orgId] = (orgStats[orgId] || 0) + 1;
        });
        console.log('📈 各机构用户统计:', orgStats);
        
        // 统计各角色数量
        const roleStats = {};
        userData.forEach(user => {
          const role = user.role || 'null';
          roleStats[role] = (roleStats[role] || 0) + 1;
        });
        console.log('👥 角色统计:', roleStats);
        console.log('=====================================');
      }
    } catch (error) {
      console.error('❌ 获取用户列表失败:', error);
    }
  };

  const fetchAdmins = async (organizationId) => {
    try {
      const response = await getOrganizationAdmins(organizationId);
      if (response.success) {
        setAdmins(response.data || []);
        // 清除头像错误状态
        setAvatarErrors({});
      } else {
        message.error('获取管理员列表失败');
      }
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      message.error('获取管理员列表失败');
    }
  };

  const handleCreate = () => {
    setEditingOrganization(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingOrganization(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedOrganization(record);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const loadingMsg = message.loading('正在删除机构...', 0);
      const response = await deleteOrganization(id);
      loadingMsg();
      
      if (response.success) {
        message.success('✓ 删除机构成功');
        // 刷新列表
        await fetchOrganizations();
      } else {
        message.error(response.message || '删除机构失败');
      }
    } catch (error) {
      console.error('删除机构失败:', error);
      message.error(error.response?.data?.message || '删除机构失败');
    }
  };

  const handleSettings = (record) => {
    navigate(`/organizations/${record.id}/permissions`);
  };

  const handleManageAdmins = async (record) => {
    setSelectedOrganization(record);
    setSelectedUserId(null);
    await fetchAdmins(record.id);
    
    // 调试信息：查看该机构的所有用户
    console.log('=== 机构管理员调试信息 ===');
    console.log('当前机构ID:', record.id, '类型:', typeof record.id);
    console.log('所有用户总数:', users.length);
    
    // 检查用户的organizationId
    users.forEach((user, index) => {
      if (index < 5) { // 只打印前5个用户样例
        console.log(`用户${index}:`, {
          id: user.id,
          name: user.nickname || user.username,
          organizationId: user.organizationId,
          organizationIdType: typeof user.organizationId,
          role: user.role,
          status: user.status
        });
      }
    });
    
    const orgUsers = users.filter(u => {
      // 使用 == 而不是 === 来比较，避免类型不匹配
      return u.organizationId == record.id;
    });
    console.log('属于该机构的用户数量:', orgUsers.length);
    console.log('属于该机构的用户:', orgUsers);
    
    setTimeout(() => {
      const adminIds = admins.map(admin => admin.id);
      console.log('当前管理员ID列表:', adminIds);
      
      const available = users.filter(user => 
        user.organizationId == record.id && 
        !adminIds.includes(user.id) &&
        user.status === 'ACTIVE'
      );
      console.log('可添加的用户数量:', available.length);
      console.log('可添加的用户:', available);
    }, 500);
    
    setAdminModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 显示加载提示
      const loadingMsg = message.loading(
        editingOrganization ? '正在更新机构...' : '正在创建机构...', 
        0
      );
      
      let response;
      if (editingOrganization) {
        response = await updateOrganization(editingOrganization.id, values);
      } else {
        response = await createOrganization(values);
      }

      loadingMsg();

      if (response.success) {
        message.success(editingOrganization ? '✓ 更新机构成功' : '✓ 创建机构成功');
        setModalVisible(false);
        form.resetFields();
        // 刷新列表
        await fetchOrganizations();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleConfirmAddAdmin = async () => {
    if (!selectedUserId) {
      message.warning('请先选择要设为管理员的用户');
      return;
    }

    try {
      setAddingAdmin(true);
      const response = await setOrganizationAdmin(selectedOrganization.id, selectedUserId);
      if (response.success) {
        message.success('✓ 设置管理员成功');
        setSelectedUserId(null);
        await fetchAdmins(selectedOrganization.id);
        fetchUsers();
      } else {
        message.error(response.message || '设置管理员失败');
      }
    } catch (error) {
      console.error('设置管理员失败:', error);
      message.error(error.response?.data?.message || '设置管理员失败');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (userId) => {
    try {
      const response = await removeOrganizationAdmin(selectedOrganization.id, userId);
      if (response.success) {
        message.success('移除管理员成功');
        await fetchAdmins(selectedOrganization.id);
        fetchUsers();
      } else {
        message.error(response.message || '移除管理员失败');
      }
    } catch (error) {
      console.error('移除管理员失败:', error);
      message.error(error.response?.data?.message || '移除管理员失败');
    }
  };

  // 使用卡片式列表代替表格
  const renderOrganizationCard = (org) => (
    <Card key={org.id} className="org-card">
      <div className="org-card-header">
        <div className="org-card-title">
          <h3>{org.name}</h3>
          <Tag color={org.status === 'ACTIVE' ? 'success' : 'default'}>
            {org.status === 'ACTIVE' ? '启用' : '停用'}
          </Tag>
        </div>
        <div className="org-card-meta">
          <span className="org-card-id">ID: {org.id}</span>
          <span className="org-card-code">代码: {org.code}</span>
        </div>
      </div>

      <div className="org-card-actions" onClick={(e) => e.stopPropagation()}>
        <Button
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetail(org);
          }}
          className="action-btn detail-btn"
        >
          详情
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleSettings(org);
          }}
          className="action-btn settings-btn"
        >
          权限设置
        </Button>
        <Button
          icon={<UsergroupAddOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/organizations/${org.id}/roles`);
          }}
          className="action-btn role-btn"
        >
          角色管理
        </Button>
        <Button
          icon={<TeamOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleManageAdmins(org);
          }}
          className="action-btn admin-btn"
        >
          管理员
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(org);
          }}
          className="action-btn edit-btn"
        >
          编辑
        </Button>
        <Popconfirm
          title="确定要删除这个机构吗？"
          description="删除后无法恢复，相关数据可能会受影响。"
          onConfirm={(e) => {
            if (e) e.stopPropagation();
            handleDelete(org.id);
          }}
          okText="确定"
          cancelText="取消"
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            className="action-btn delete-btn"
            onClick={(e) => e.stopPropagation()}
          >
            删除
          </Button>
        </Popconfirm>
      </div>
    </Card>
  );

  // 过滤出属于当前机构且不在管理员列表中的用户
  const getAvailableUsers = () => {
    if (!selectedOrganization) return [];
    
    // 获取当前管理员的ID列表
    const adminIds = admins.map(admin => admin.id);
    
    // 过滤：属于该机构 && 不在管理员列表中 && 状态为已批准
    // 使用 == 而不是 === 来避免类型不匹配问题（number vs string）
    return users.filter(user => 
      user.organizationId == selectedOrganization.id && 
      !adminIds.includes(user.id) &&
      user.status === 'APPROVED'  // 修改为APPROVED，因为系统用户状态是APPROVED
    );
  };

  const renderOrganizationList = () => (
    <>
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      ) : organizations.length === 0 ? (
        <div className="empty-container">
          <div className="empty-icon">📋</div>
          <h3>暂无机构</h3>
          <p>点击"新建机构"按钮创建第一个机构</p>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
          >
            新建机构
          </Button>
        </div>
      ) : (
        <div className="org-cards-container">
          {organizations.map(org => renderOrganizationCard(org))}
        </div>
      )}
    </>
  );

  const tabItems = [
    {
      key: 'list',
      label: '机构列表',
      children: renderOrganizationList(),
    },
    {
      key: 'requests',
      label: '机构申请',
      children: <OrganizationRequestManagement />,
    },
  ];

  return (
    <div className="organization-management">
      <div className="org-tabs">
        <div className="page-header">
          <div className="header-left">
            <h2>机构管理</h2>
            <span className="org-count">共 {organizations.length} 个机构</span>
          </div>
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            className="create-icon-btn"
            size="large"
          />
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </div>

      {/* 查看详情Modal */}
      <Modal
        title="机构详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              handleEdit(selectedOrganization);
            }}
          >
            编辑
          </Button>
        ]}
        width={600}
      >
        {selectedOrganization && (
          <div className="org-detail-content">
            <div className="detail-item">
              <label>机构名称：</label>
              <span>{selectedOrganization.name}</span>
            </div>
            <div className="detail-item">
              <label>机构代码：</label>
              <span>{selectedOrganization.code}</span>
            </div>
            <div className="detail-item">
              <label>详细地址：</label>
              <span>{selectedOrganization.address || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>联系电话：</label>
              <span>{selectedOrganization.contactPhone || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>负责人：</label>
              <span>{selectedOrganization.contactPerson || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>状态：</label>
              <span>
                <Tag color={selectedOrganization.status === 'ACTIVE' ? 'green' : 'red'} style={{ marginRight: 0 }}>
                  {selectedOrganization.status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
              </span>
            </div>
            <div className="detail-item">
              <label>创建时间：</label>
              <span>{new Date(selectedOrganization.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* 新建/编辑机构Modal */}
      <Modal
        title={editingOrganization ? '编辑机构' : '新建机构'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="机构名称"
            name="name"
            rules={[{ required: true, message: '请输入机构名称' }]}
          >
            <Input placeholder="请输入机构名称" />
          </Form.Item>

          <Form.Item
            label="机构代码"
            name="code"
            rules={[
              { required: true, message: '请输入机构代码' },
              { pattern: /^[A-Z0-9_]+$/, message: '机构代码只能包含大写字母、数字和下划线' }
            ]}
          >
            <Input placeholder="例如：ORG_ZGC" />
          </Form.Item>

          <Form.Item
            label="详细地址"
            name="address"
          >
            <Input placeholder="请输入详细地址" />
          </Form.Item>

          <Form.Item
            label="联系电话"
            name="contactPhone"
            rules={[
              { pattern: /^1[3-9]\d{9}$|^\d{3,4}-\d{7,8}$/, message: '请输入有效的电话号码' }
            ]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            label="负责人"
            name="contactPerson"
          >
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>

          {editingOrganization && (
            <Form.Item
              label="状态"
              name="status"
            >
              <Select>
                <Option value="ACTIVE">启用</Option>
                <Option value="INACTIVE">停用</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 管理机构管理员Modal */}
      <Modal
        title={`管理机构管理员 - ${selectedOrganization?.name}`}
        open={adminModalVisible}
        onCancel={() => setAdminModalVisible(false)}
        footer={null}
        width={700}
      >
        <div className="admin-management">
          <div className="current-admins">
            <h3>当前管理员</h3>
            {admins.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                暂无管理员
              </div>
            ) : (
              <List
                dataSource={admins}
                renderItem={(admin) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        title="确定要移除此管理员吗？"
                        onConfirm={() => handleRemoveAdmin(admin.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          danger
                          icon={<UserDeleteOutlined />}
                        >
                          移除
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        (() => {
                          // 如果头像加载失败或没有头像，显示首字母头像
                          if (!admin.wechatAvatar || avatarErrors[admin.id]) {
                            return (
                              <Avatar style={{ backgroundColor: '#1890ff' }}>
                                {admin.nickname?.[0] || admin.username?.[0] || 'A'}
                              </Avatar>
                            );
                          }
                          
                          // 尝试显示微信头像
                          return (
                            <Avatar 
                              src={admin.wechatAvatar}
                              onError={() => {
                                console.log('头像加载失败，切换到首字母头像:', admin.wechatAvatar);
                                setAvatarErrors(prev => ({ ...prev, [admin.id]: true }));
                                return true;
                              }}
                            >
                              {admin.nickname?.[0] || admin.username?.[0] || 'A'}
                            </Avatar>
                          );
                        })()
                      }
                      title={admin.nickname || admin.username}
                      description={`电话: ${admin.phone || '未设置'}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>

          <Divider />

          <div className="add-admin">
            <h3>添加管理员</h3>
            <p style={{ color: '#999', fontSize: '12px', marginBottom: 16 }}>
              只能选择属于本机构的用户（已是管理员的不会显示）
            </p>
            {(() => {
              if (!selectedOrganization) {
                return <div style={{ color: '#999', textAlign: 'center', padding: '16px' }}>加载中...</div>;
              }
              
              const availableUsers = getAvailableUsers();
              console.log('🔍 当前可选用户列表:', availableUsers);
              
              if (availableUsers.length === 0) {
                // 显示详细的调试信息
                const orgUsers = users.filter(u => u.organizationId == selectedOrganization.id);
                const adminIds = admins.map(a => a.id);
                const nonAdminUsers = orgUsers.filter(u => !adminIds.includes(u.id));
                
                console.warn('⚠️ 无可添加用户！');
                console.log('当前机构ID:', selectedOrganization.id);
                console.log('该机构所有用户:', orgUsers);
                console.log('该机构用户数:', orgUsers.length);
                console.log('当前管理员IDs:', adminIds);
                console.log('非管理员用户:', nonAdminUsers);
                
                // 检查非管理员用户被过滤的原因
                console.log('🔍 分析非管理员用户状态:');
                nonAdminUsers.forEach(user => {
                  console.log(`用户 ${user.nickname || user.username}:`, {
                    id: user.id,
                    status: user.status,
                    statusType: typeof user.status,
                    isActive: user.status === 'ACTIVE',
                    inAdminList: adminIds.includes(user.id)
                  });
                });
                
                return (
                  <div style={{ 
                    padding: '16px', 
                    background: '#fff3cd', 
                    borderRadius: '8px',
                    border: '1px solid #ffc107',
                    color: '#856404'
                  }}>
                    <strong>⚠️ 调试信息：</strong><br/>
                    该机构总用户数: {orgUsers.length}<br/>
                    当前管理员数: {adminIds.length}<br/>
                    非管理员用户数: {nonAdminUsers.length}<br/>
                    可添加用户数: {availableUsers.length}<br/>
                    <br/>
                    {nonAdminUsers.length > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        非管理员用户状态:<br/>
                        {nonAdminUsers.map(u => (
                          <div key={u.id}>
                            - {u.nickname || u.username}: status={u.status}
                          </div>
                        ))}
                      </div>
                    )}
                    <br/>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      请查看浏览器控制台获取详细调试信息
                    </span>
                  </div>
                );
              }
              
              return (
                <div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择用户设为管理员"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={(value) => setSelectedUserId(value)}
                    value={selectedUserId}
                    options={availableUsers.map(user => ({
                      value: user.id,
                      label: `${user.nickname || user.username} ${user.phone ? `(${user.phone})` : ''}`
                    }))}
                  />
                  <Button
                    type="primary"
                    block
                    style={{ marginTop: 12 }}
                    disabled={!selectedUserId}
                    loading={addingAdmin}
                    onClick={handleConfirmAddAdmin}
                  >
                    确认添加为管理员
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrganizationManagement;

