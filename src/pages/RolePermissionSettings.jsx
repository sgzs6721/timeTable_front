import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Switch, Button, message, Spin, Divider, 
  Typography, Space 
} from 'antd';
import { 
  TeamOutlined, CheckCircleOutlined, SaveOutlined, LeftOutlined,
  TrophyOutlined, ShoppingOutlined, CustomerServiceOutlined, ControlOutlined
} from '@ant-design/icons';
import { getOrganizationPermissions, saveRolePermissions } from '../services/rolePermission';
import { getOrganization } from '../services/organization';
import { getOrganizationRoles } from '../services/organizationRole';
import './RolePermissionSettings.css';

const { Title, Text } = Typography;

const RolePermissionSettings = () => {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});

  // 菜单配置
  const menuItems = [
    { key: 'dashboard', label: '总览', icon: '📊' },
    { key: 'todo', label: '待办', icon: '✅' },
    { key: 'customer', label: '客源', icon: '👥' },
    { key: 'mySchedule', label: '我的课表', icon: '📅' },
    { key: 'myStudents', label: '我的学员', icon: '🎓' },
    { key: 'myHours', label: '我的课时', icon: '⏰' },
    { key: 'mySalary', label: '我的工资', icon: '💰' },
  ];

  // 功能菜单配置
  const actionItems = [
    { key: 'refresh', label: '刷新', icon: '🔄' },
    { key: 'admin', label: '管理员', icon: '⚙️' },
    { key: 'archived', label: '归档课表', icon: '📦' },
    { key: 'profile', label: '个人账号', icon: '👤' },
    { key: 'guide', label: '使用说明', icon: '📖' },
    { key: 'logout', label: '退出登录', icon: '🚪', disabled: true },
  ];

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

      // 获取机构的角色列表
      const rolesResponse = await getOrganizationRoles(organizationId);
      let loadedRoles = [];
      if (rolesResponse.success && rolesResponse.data) {
        loadedRoles = rolesResponse.data;
        setRoles(loadedRoles);
      }

      // 获取权限配置
      const response = await getOrganizationPermissions(organizationId);
      if (response.success && response.data) {
        const permissionsMap = {};

        // 初始化所有角色的权限
        loadedRoles.forEach(role => {
          permissionsMap[role.roleCode] = {
            roleId: role.id,
            menuPermissions: {},
            actionPermissions: {}
          };
        });

        // 填充从后端获取的权限
        response.data.forEach(perm => {
          if (permissionsMap[perm.role]) {
            permissionsMap[perm.role] = {
              roleId: perm.roleId,
              menuPermissions: perm.menuPermissions || {},
              actionPermissions: perm.actionPermissions || {}
            };
          }
        });

        // 确保所有菜单项都有默认值
        loadedRoles.forEach(role => {
          menuItems.forEach(item => {
            if (permissionsMap[role.roleCode].menuPermissions[item.key] === undefined) {
              permissionsMap[role.roleCode].menuPermissions[item.key] = true;
            }
          });
          actionItems.forEach(item => {
            if (permissionsMap[role.roleCode].actionPermissions[item.key] === undefined) {
              permissionsMap[role.roleCode].actionPermissions[item.key] = true;
            }
          });
        });

        setPermissions(permissionsMap);
        setOriginalPermissions(JSON.parse(JSON.stringify(permissionsMap)));
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuPermissionChange = (role, key, checked) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        menuPermissions: {
          ...prev[role].menuPermissions,
          [key]: checked
        }
      }
    }));
  };

  const handleActionPermissionChange = (role, key, checked) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        actionPermissions: {
          ...prev[role].actionPermissions,
          [key]: checked
        }
      }
    }));
  };

  const hasMenuPermissionChanged = (role) => {
    if (!originalPermissions[role]) return false;
    return JSON.stringify(permissions[role]?.menuPermissions) !== 
           JSON.stringify(originalPermissions[role]?.menuPermissions);
  };

  const hasActionPermissionChanged = (role) => {
    if (!originalPermissions[role]) return false;
    return JSON.stringify(permissions[role]?.actionPermissions) !== 
           JSON.stringify(originalPermissions[role]?.actionPermissions);
  };

  const handleSavePermission = async (role) => {
    try {
      const permissionData = [{
        organizationId: parseInt(organizationId),
        role: role,
        menuPermissions: permissions[role].menuPermissions,
        actionPermissions: permissions[role].actionPermissions
      }];

      const response = await saveRolePermissions(organizationId, permissionData);
      
      if (response.success) {
        message.success(`${roles.find(r => r.roleCode === role)?.roleName}权限保存成功`);
        // 更新原始权限
        setOriginalPermissions(prev => ({
          ...prev,
          [role]: JSON.parse(JSON.stringify(permissions[role]))
        }));
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存权限失败:', error);
      message.error('保存权限失败');
    }
  };

  const getIconComponent = (iconName, color) => {
    const iconProps = { style: { fontSize: 20, color: color || '#1890ff' } };
    const iconMap = {
      'trophy': <TrophyOutlined {...iconProps} />,
      'shopping': <ShoppingOutlined {...iconProps} />,
      'customer-service': <CustomerServiceOutlined {...iconProps} />,
      'control': <ControlOutlined {...iconProps} />,
    };
    return iconMap[iconName] || <TeamOutlined {...iconProps} />;
  };

  const renderRoleCard = (role) => {
    const currentPermissions = permissions[role.roleCode];
    if (!currentPermissions) return null;

    return (
      <Card
        key={role.id}
        className="role-card"
        title={
          <Space>
            {getIconComponent(role.icon, role.color)}
            <span>{role.roleName} ({role.roleCode})</span>
          </Space>
        }
      >
        <div className="permission-section">
          <div className="permission-section-header">
            <Title level={5}>
              <CheckCircleOutlined /> 顶部菜单权限
            </Title>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={() => handleSavePermission(role.roleCode)}
              disabled={!hasMenuPermissionChanged(role.roleCode)}
            >
              保存
            </Button>
          </div>
          <div className="permission-grid">
            {menuItems.map(item => (
              <div key={item.key} className="permission-item">
                <Space>
                  <span className="permission-icon">{item.icon}</span>
                  <Text>{item.label}</Text>
                </Space>
                <Switch
                  checked={currentPermissions.menuPermissions[item.key]}
                  onChange={(checked) => handleMenuPermissionChange(role.roleCode, item.key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <Divider />

        <div className="permission-section">
          <div className="permission-section-header">
            <Title level={5}>
              <CheckCircleOutlined /> 右上角功能菜单权限
            </Title>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              onClick={() => handleSavePermission(role.roleCode)}
              disabled={!hasActionPermissionChanged(role.roleCode)}
            >
              保存
            </Button>
          </div>
          <div className="permission-grid">
            {actionItems.map(item => (
                <div key={item.key} className="permission-item">
                  <Space>
                    <span className="permission-icon">{item.icon}</span>
                    <Text>{item.label}</Text>
                  </Space>
                  <Switch
                    checked={currentPermissions.actionPermissions[item.key]}
                    onChange={(checked) => handleActionPermissionChange(role.roleCode, item.key, checked)}
                    disabled={item.disabled}
                  />
                </div>
              ))}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="role-permission-settings">
      <div className="settings-header">
        <div className="header-content">
          <Button 
            type="text"
            shape="circle"
            icon={<LeftOutlined />}
            onClick={() => navigate('/organization-management')}
            className="back-btn-circle"
            size="large"
          />
          <div className="header-left">
            <Title level={2} style={{ margin: 0 }}>
              角色权限设置
            </Title>
            {organization && (
              <Text type="secondary">
                {organization.name} ({organization.code})
              </Text>
            )}
          </div>
        </div>
      </div>

      <div className="roles-container">
        {roles.map(role => renderRoleCard(role))}
      </div>
    </div>
  );
};

export default RolePermissionSettings;
