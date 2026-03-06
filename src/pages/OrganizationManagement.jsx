import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Modal, Form, Input, message, Space, Tag, 
  Popconfirm, Card, Select, Divider, Avatar, List, Tabs, Badge, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  TeamOutlined, UserAddOutlined, UserDeleteOutlined,
  ReloadOutlined, EnvironmentOutlined, PhoneOutlined,
  EyeOutlined, SettingOutlined, UsergroupAddOutlined,
  DollarOutlined, BellOutlined
} from '@ant-design/icons';
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationAdmins,
  setOrganizationAdmin,
  removeOrganizationAdmin,
  getPendingRequestsCount,
  getAllUsersForOrgMgmt
} from '../services/organization';
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
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [avatarErrors, setAvatarErrors] = useState({});
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrganizations();
    fetchPendingRequestsCount();
  }, []);

  // 获取待审批的机构申请数量
  const fetchPendingRequestsCount = async () => {
    try {
      const count = await getPendingRequestsCount();
      setPendingRequestsCount(count);
    } catch (error) {
      console.error('获取待审批数量失败:', error);
    }
  };

  const fetchOrganizations = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await getAllOrganizations();
      if (response.success) {
        setOrganizations(response.data || []);
      } else {
        // 如果失败，显示详细错误信息
        console.error('获取机构列表失败:', response);
        message.error(response.message || '获取机构列表失败');
      }
    } catch (error) {
      console.error('获取机构列表失败:', error);
      // 显示更详细的错误信息
      const errorMsg = error.response?.data?.message || error.message || '获取机构列表失败，请检查网络连接';
      message.error(errorMsg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await getAllUsersForOrgMgmt();
      if (response.success) {
        const userData = response.data || [];
        setUsers(userData);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchAdmins = async (organizationId) => {
    try {
      setLoadingAdmins(true);
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
    } finally {
      setLoadingAdmins(false);
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

  const handleManageAdmins = (record) => {
    setSelectedOrganization(record);
    setSelectedUserId(null);
    setAdmins([]); // 清空旧数据
    setAdminModalVisible(true);
    fetchUsers();
    // 打开modal后再加载数据
    fetchAdmins(record.id);
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

      <div className="org-card-actions">
        <Button
          icon={<UsergroupAddOutlined />}
          onClick={() => {
            navigate(`/organizations/${org.id}/roles`);
          }}
          className="action-btn role-btn"
        >
          职位管理
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={() => {
            handleSettings(org);
          }}
          className="action-btn settings-btn"
        >
          权限设置
        </Button>
        <Button
          icon={<DollarOutlined />}
          onClick={() => {
            navigate(`/organizations/${org.id}/salary`);
          }}
          className="action-btn salary-btn"
        >
          工资管理
        </Button>
        <Button
          icon={<BellOutlined />}
          onClick={() => {
            navigate(`/organizations/${org.id}/notifications`);
          }}
          className="action-btn notification-btn"
        >
          通知设置
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={() => {
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
            icon={<DeleteOutlined />}
            className="action-btn delete-btn"
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
      label: (
        <Badge 
          count={pendingRequestsCount} 
          offset={[10, 0]}
          style={{ 
            backgroundColor: '#ff4d4f',
          }}
        >
          <span>机构申请</span>
        </Badge>
      ),
      children: <OrganizationRequestManagement onUpdate={fetchPendingRequestsCount} />,
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
          onChange={(key) => {
            setActiveTab(key);
            if (key === 'requests') {
              fetchPendingRequestsCount();
            }
          }}
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
            {loadingAdmins ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin>
                  <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
                </Spin>
              </div>
            ) : admins.length === 0 ? (
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
              
              if (availableUsers.length === 0) {
                return (
                  <div style={{ 
                    padding: '16px', 
                    background: '#f0f0f0', 
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#999'
                  }}>
                    暂无可添加的用户
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
                      label: `${user.nickname || user.username}`
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

