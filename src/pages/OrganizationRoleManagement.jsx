import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Button, message, Spin, Typography, Space, Table, Modal, Form, Input, Tag, Popconfirm, Select 
} from 'antd';
import { 
  LeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  TrophyOutlined, ShoppingOutlined, CustomerServiceOutlined, ControlOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons';
import { getOrganizationRoles, createRole, updateRole, deleteRole } from '../services/organizationRole';
import { getOrganization } from '../services/organization';
import './OrganizationRoleManagement.css';

const { Title, Text } = Typography;

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [roles, setRoles] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();

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

      // 获取角色列表
      const rolesResponse = await getOrganizationRoles(organizationId);
      if (rolesResponse.success) {
        setRoles(rolesResponse.data || []);
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

  const handleDelete = async (id) => {
    try {
      const response = await deleteRole(id);
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

  const renderRoleCard = (role) => (
    <Card
      key={role.id}
      className="role-item-card"
      hoverable
      bodyStyle={{ padding: '16px' }}
    >
      <div className="role-card-content">
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
            icon={<EditOutlined />}
            onClick={() => handleEdit(role)}
          />
          <Popconfirm
            title="确定删除此角色吗？"
            onConfirm={() => handleDelete(role.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="org-role-management">
      <div className="role-header">
        <div className="header-content">
          <Button 
            type="text"
            shape="circle"
            icon={<LeftOutlined />}
            onClick={() => navigate('/organization-management')}
            className="back-btn-circle"
            size="large"
          />
          <div className="header-center">
            <Title level={2} style={{ margin: 0 }}>
              角色管理
            </Title>
            {organization && (
              <Text type="secondary">
                {organization.name} ({organization.code})
              </Text>
            )}
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          disabled={loading}
        >
          新建角色
        </Button>
      </div>

      {loading ? (
        <div className="loading-state">
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <div className="roles-grid">
          {roles.length > 0 ? (
            roles.map(role => renderRoleCard(role))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>暂无角色</h3>
              <p>该机构还没有创建任何角色，点击上方"新建角色"按钮开始创建</p>
            </div>
          )}
        </div>
      )}

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
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
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="如：教师" />
          </Form.Item>

          <Form.Item
            name="roleCode"
            label="角色代码"
            rules={[
              { required: true, message: '请输入角色代码' },
              { pattern: /^[A-Z_]+$/, message: '只能使用大写字母和下划线' }
            ]}
          >
            <Input placeholder="如：TEACHER" />
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
            <Input.TextArea rows={3} placeholder="角色描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrganizationRoleManagement;

