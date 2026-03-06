import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, Button, message, Spin, Typography, Space, Modal, Form, Input, Tag, Popconfirm, Select, List, Avatar, Divider 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined,
  TrophyOutlined, ShoppingOutlined, CustomerServiceOutlined, ControlOutlined,
  UsergroupAddOutlined, UserAddOutlined, UserDeleteOutlined, TeamOutlined
} from '@ant-design/icons';
import { getOrganizationRoles, createRole, updateRole, deleteRole } from '../services/organizationRole';
import { getOrganization, getUsersByOrganizationForOrgMgmt, updateUserInfoForOrgMgmt } from '../services/organization';
import OrganizationManagementPageLayout from '../components/OrganizationManagementPageLayout';
import './OrganizationRoleManagement.css';

// 获取职位显示信息
const getPositionDisplay = (position, roles = []) => {
  if (!position) return { label: '未设置', color: '#d9d9d9' };
  
  // 从当前机构的职位中查找匹配的职位
  const role = roles.find(r => r.roleCode === position);
  if (role) {
    return {
      label: role.roleName,
      color: role.color || '#1890ff'
    };
  }
  
  // 如果没找到，返回默认值
  return { label: position, color: '#d9d9d9' };
};

// 预设图标选项
const ICON_OPTIONS = [
  { value: 'trophy', label: '奖杯 🏆', icon: <TrophyOutlined /> },
  { value: 'shopping', label: '购物 🛒', icon: <ShoppingOutlined /> },
  { value: 'customer-service', label: '客服 📞', icon: <CustomerServiceOutlined /> },
  { value: 'control', label: '控制 ⚙️', icon: <ControlOutlined /> },
  { value: 'user-group', label: '用户组 👥', icon: <UsergroupAddOutlined /> },
];

// 预设颜色选项
const COLOR_OPTIONS = [
  { value: '#52c41a', label: '绿色', color: '#52c41a' },
  { value: '#fa8c16', label: '橙色', color: '#fa8c16' },
  { value: '#722ed1', label: '紫色', color: '#722ed1' },
  { value: '#13c2c2', label: '青色', color: '#13c2c2' },
  { value: '#1890ff', label: '蓝色', color: '#1890ff' },
  { value: '#eb2f96', label: '粉色', color: '#eb2f96' },
  { value: '#f5222d', label: '红色', color: '#f5222d' },
  { value: '#faad14', label: '黄色', color: '#faad14' },
];

const OrganizationRoleManagement = () => {
  const { organizationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [roles, setRoles] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();

  // 成员管理相关状态
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [roleMembers, setRoleMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 获取机构信息
      const orgResponse = await getOrganization(organizationId);
      if (orgResponse.success) {
        setOrganization(orgResponse.data);
      }

      // 获取职位列表
      const rolesResponse = await getOrganizationRoles(organizationId);
      if (rolesResponse.success) {
        setRoles(rolesResponse.data || []);
      }

      // 获取指定机构的用户（若后端不支持该参数，会自动回退为全量，再前端过滤）
      const usersResponse = await getUsersByOrganizationForOrgMgmt(organizationId);
      if (usersResponse.success) {
        // 不再过滤、全部展示
        const users = usersResponse.data || usersResponse?.data?.data || [];
        setAllUsers(users);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({
      icon: 'user-group',
      color: '#52c41a'
    });
    setModalVisible(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    form.setFieldsValue(role);
    setModalVisible(true);
  };

  const handleDelete = async (role) => {
    if (role.memberCount > 0) {
      message.error(`该职位下有 ${role.memberCount} 个成员，无法删除`);
      return;
    }

    try {
      const response = await deleteRole(role.id);
      if (response.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const roleData = {
        ...values,
        organizationId: parseInt(organizationId)
      };

      let response;
      if (editingRole) {
        response = await updateRole(editingRole.id, roleData);
      } else {
        response = await createRole(roleData);
      }

      if (response.success) {
        message.success(editingRole ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 打开成员管理Modal
  const handleManageMembers = async (role) => {
    setSelectedRole(role);
    setMemberModalVisible(true);
    await loadRoleMembers(role);
  };

  // 加载职位成员
  const loadRoleMembers = async (role) => {
    try {
      setMemberLoading(true);
      
      // 重新获取最新的用户列表（按机构）
      const usersResponse = await getUsersByOrganizationForOrgMgmt(organizationId);
      if (usersResponse.success) {
        const orgUsers = (usersResponse.data || usersResponse?.data?.data || []).filter(
          user => String(user.organizationId) === String(organizationId)
        );
        setAllUsers(orgUsers);
        
        // 从最新数据中筛选出属于该职位的成员
        // 匹配规则：只根据 position 字段
        const members = orgUsers.filter(user => user.position === role.roleCode);
        setRoleMembers(members);
        
        // 获取可添加的用户（职位不是当前职位的用户）
        const available = orgUsers.filter(user => user.position !== role.roleCode);
        setAvailableUsers(available);
      }
    } catch (error) {
      console.error('加载职位成员失败:', error);
      message.error('加载职位成员失败');
    } finally {
      setMemberLoading(false);
    }
  };

  // 添加成员到职位（设置用户职位）
  const handleAddMember = async () => {
    if (!selectedUserId) {
      message.warning('请选择要添加的成员');
      return;
    }

    try {
      setAddingMember(true);
      // 调用更新用户接口，设置用户的 position 为职位代码
      const response = await updateUserInfoForOrgMgmt(selectedUserId, { position: selectedRole.roleCode });
      if (response.success) {
        message.success('设置职位成功');
        setSelectedUserId(null);
        
        // 立即更新本地状态
        setAllUsers(prevUsers => prevUsers.map(user => 
          user.id === selectedUserId 
            ? { ...user, position: selectedRole.roleCode }
            : user
        ));
        
        // 重新加载职位列表（更新成员数量）
        const rolesResponse = await getOrganizationRoles(organizationId);
        if (rolesResponse.success) {
          setRoles(rolesResponse.data || []);
        }
        
        // 重新加载当前职位的成员
        await loadRoleMembers(selectedRole);
      } else {
        message.error(response.message || '设置职位失败');
      }
    } catch (error) {
      console.error('设置职位失败:', error);
      message.error('设置职位失败');
    } finally {
      setAddingMember(false);
    }
  };

  // 从职位移除成员（清除用户职位）
  const handleRemoveMember = async (userId) => {
    try {
      // 调用更新用户接口，清除用户的 position
      const response = await updateUserInfoForOrgMgmt(userId, { position: null });
      console.log('移除成员API响应:', response);
      
      if (response.success) {
        message.success('清除职位成功');
        
        // 重新加载数据以确保与后端同步
        await loadRoleMembers(selectedRole);
        
        // 重新加载职位列表（更新成员数量）
        const rolesResponse = await getOrganizationRoles(organizationId);
        if (rolesResponse.success) {
          setRoles(rolesResponse.data || []);
        }
      } else {
        message.error(response.message || '清除职位失败');
      }
    } catch (error) {
      console.error('清除职位失败:', error);
      message.error('清除职位失败');
    }
  };

  const getIconComponent = (iconName, color) => {
    const iconProps = { style: { fontSize: 24, color: color || '#1890ff' } };
    const iconMap = {
      'trophy': <TrophyOutlined {...iconProps} />,
      'shopping': <ShoppingOutlined {...iconProps} />,
      'customer-service': <CustomerServiceOutlined {...iconProps} />,
      'control': <ControlOutlined {...iconProps} />,
      'user-group': <UsergroupAddOutlined {...iconProps} />,
    };
    return iconMap[iconName] || <UsergroupAddOutlined {...iconProps} />;
  };

  const renderRoleCard = (role) => {
    // 获取该职位的成员列表
    // 匹配规则：只根据 position 字段
    const roleMembers = allUsers.filter(user => user.position === role.roleCode);
    
    return (
      <Card
        key={role.id}
        className="role-item-card"
        styles={{ body: { padding: '16px' } }}
      >
        <div className="role-card-header">
          <Space size={10} align="start">
            {getIconComponent(role.icon, role.color)}
            <div className="role-info">
              <div className="role-header-line">
                <span className="role-name">{role.roleName}</span>
                <span className="role-code">{role.roleCode}</span>
              </div>
              {role.description && (
                <div className="role-desc">{role.description}</div>
              )}
            </div>
          </Space>
          
          <div className="role-actions">
            <Button
              type="text"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => handleManageMembers(role)}
              title="成员管理"
            >
              成员
            </Button>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(role)}
            />
            <Popconfirm
              title={roleMembers.length > 0 ? `该职位下有 ${roleMembers.length} 个成员，无法删除` : "确定删除此职位吗？"}
              onConfirm={() => handleDelete(role)}
              okText="确定"
              cancelText="取消"
              disabled={roleMembers.length > 0}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={roleMembers.length > 0}
              />
            </Popconfirm>
          </div>
        </div>

        {/* 成员列表显示 - 只在有成员时显示 */}
        {roleMembers.length > 0 && (
          <div className="role-members-preview">
            <div className="members-header">
              <TeamOutlined style={{ marginRight: 4, color: '#1890ff' }} />
              <span>{roleMembers.length} 个成员</span>
            </div>
            <div className="members-list">
              {roleMembers.map(member => {
                const positionInfo = getPositionDisplay(member.position, roles);
                return (
                  <div key={member.id} className="member-item">
                    <span className="member-name">{member.nickname || member.username}</span>
                    <Tag color={positionInfo.color} size="small">{positionInfo.label}</Tag>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <>
      <OrganizationManagementPageLayout
        title="职位管理"
        organization={organization}
        headerAction={(
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            disabled={loading}
          >
            新建职位
          </Button>
        )}
        contentClassName="org-role-management"
      >

        {loading ? (
          <div className="loading-state">
            <Spin size="large">
              <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
            </Spin>
          </div>
        ) : (
          <div className="roles-grid">
            {roles.length > 0 ? (
              roles.map(role => renderRoleCard(role))
            ) : (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>暂无职位</h3>
                <p>该机构还没有创建任何职位，点击上方"新建职位"按钮开始创建</p>
              </div>
            )}
          </div>
        )}
      </OrganizationManagementPageLayout>

      {/* 新建/编辑职位Modal */}
      <Modal
        title={editingRole ? '编辑职位' : '新建职位'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="roleName"
            label="职位名称"
            rules={[{ required: true, message: '请输入职位名称' }]}
          >
            <Input placeholder="如：教练" />
          </Form.Item>

          <Form.Item
            name="roleCode"
            label="职位代码"
            rules={[
              { required: true, message: '请输入职位代码' },
              { pattern: /^[A-Z_]+$/, message: '只能使用大写字母和下划线' }
            ]}
          >
            <Input placeholder="如：COACH" />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
            rules={[{ required: true, message: '请选择图标' }]}
          >
            <Select placeholder="请选择图标">
              {ICON_OPTIONS.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  <Space>
                    {option.icon}
                    {option.label}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="color"
            label="颜色"
            rules={[{ required: true, message: '请选择颜色' }]}
          >
            <Select placeholder="请选择颜色">
              {COLOR_OPTIONS.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  <Space>
                    <div style={{ 
                      width: 16, 
                      height: 16, 
                      backgroundColor: option.color,
                      borderRadius: 2,
                      border: '1px solid #d9d9d9'
                    }} />
                    {option.label}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入职位描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理Modal */}
      <Modal
        title={`成员管理 - ${selectedRole?.roleName}`}
        open={memberModalVisible}
        onCancel={() => setMemberModalVisible(false)}
        footer={null}
        width={700}
      >
        <div className="member-management">
          <div className="current-members">
            <h3>当前成员 ({roleMembers.length})</h3>
            {memberLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin>
                  <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
                </Spin>
              </div>
            ) : roleMembers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                暂无成员
              </div>
            ) : (
              <List
                dataSource={roleMembers}
                renderItem={(member) => {
                  // 展示真实的 organizationId，显示职位和归属
                  const positionInfo = getPositionDisplay(member.position, roles);
                  const orgNote =
                    String(member.organizationId) !== String(organizationId)
                      ? `【归属orgId:${member.organizationId}】`
                      : '';
                  return (
                    <List.Item
                      actions={[
                        <Popconfirm
                          title="确定要移除此成员吗？"
                          onConfirm={() => handleRemoveMember(member.id)}
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
                          member.wechatAvatar ? (
                            <Avatar src={member.wechatAvatar} />
                          ) : (
                            <Avatar style={{ backgroundColor: '#1890ff' }}>
                              {member.nickname?.[0] || member.username?.[0] || 'U'}
                            </Avatar>
                          )
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{member.nickname || member.username}</span>
                            <Tag color={positionInfo.color}>{positionInfo.label}</Tag>
                            {orgNote && (
                              <span style={{ color: '#f5222d', fontWeight: 700 }}>{orgNote}</span>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          <Divider />

          <div className="add-member">
            <h3>添加成员</h3>
            <p style={{ color: '#999', fontSize: '12px', marginBottom: 16 }}>
              只能选择属于本机构的用户
            </p>
            {availableUsers.length === 0 ? (
              <div style={{ 
                padding: '16px', 
                background: '#f0f0f0', 
                borderRadius: '8px',
                textAlign: 'center',
                color: '#999'
              }}>
                暂无可添加的用户
              </div>
            ) : (
              <div>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择用户添加到职位"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(value) => setSelectedUserId(value)}
                  value={selectedUserId}
                  options={availableUsers.map(user => {
                    const currentRole = roles.find(role => role.roleCode === user.position);
                    const positionLabel = currentRole ? currentRole.roleName :
                                          (user.position ? getPositionDisplay(user.position).label : '未设置');
                    // 新增org信息
                    return {
                      value: user.id,
                      label: `${user.nickname || user.username} (${positionLabel})`
                    };
                  })}
                />
                <Button
                  type="primary"
                  block
                  style={{ marginTop: 12 }}
                  disabled={!selectedUserId}
                  loading={addingMember}
                  onClick={handleAddMember}
                >
                  确认添加
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default OrganizationRoleManagement;
