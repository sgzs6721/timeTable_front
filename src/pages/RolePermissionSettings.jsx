import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Switch, Button, message, Spin, Divider, 
  Typography, Space 
} from 'antd';
import { 
  TeamOutlined, CheckCircleOutlined, SaveOutlined, LeftOutlined,
  TrophyOutlined, ShoppingOutlined, CustomerServiceOutlined, ControlOutlined,
  DownOutlined, UpOutlined
} from '@ant-design/icons';
import { getOrganizationPermissions, saveRolePermissions } from '../services/rolePermission';
import { getOrganization } from '../services/organization';
import { getOrganizationRoles } from '../services/organizationRole';
import OrganizationManagementPageLayout from '../components/OrganizationManagementPageLayout';
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
  const [savingRole, setSavingRole] = useState(null);
  const [expandedRoles, setExpandedRoles] = useState({});

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
    // 管理员子权限（用于页面展示，真实存储为 actionPermissions 中的独立键）
    { key: 'admin_timetables', label: '课表管理', icon: '📅', isSubOf: 'admin' },
    { key: 'admin_pending', label: '注册通知', icon: '📥', isSubOf: 'admin' },
    { key: 'organization-management', label: '机构管理', icon: '🏢' },
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

      // 获取机构的职位列表
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

        // 初始化所有职位的权限
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
            const roleData = loadedRoles.find(r => r.roleCode === perm.role);
            permissionsMap[perm.role] = {
              roleId: perm.roleId || (roleData ? roleData.id : null),
              menuPermissions: perm.menuPermissions || {},
              actionPermissions: perm.actionPermissions || {}
            };
          }
        });

        // 确保所有菜单项都有默认值
        loadedRoles.forEach(role => {
          menuItems.forEach(item => {
            if (permissionsMap[role.roleCode].menuPermissions[item.key] === undefined) {
              // 总览默认关闭
              if (item.key === 'dashboard') {
                permissionsMap[role.roleCode].menuPermissions[item.key] = false;
              } else {
                permissionsMap[role.roleCode].menuPermissions[item.key] = true;
              }
            }
          });
          actionItems.forEach(item => {
            // 仅对非展示用的 subItem 或主项进行默认值设置
            if (permissionsMap[role.roleCode].actionPermissions[item.key] === undefined) {
              // 管理员主开关默认关闭；其余默认开启；子权限默认与主开关一致（主开关关闭时也会被UI禁用）
              if (item.key === 'admin') {
                permissionsMap[role.roleCode].actionPermissions[item.key] = false;
              } else if (item.isSubOf === 'admin') {
                permissionsMap[role.roleCode].actionPermissions[item.key] = false;
              } else {
                permissionsMap[role.roleCode].actionPermissions[item.key] = true;
              }
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
      setSavingRole(role);
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
        
        // 触发全局权限刷新事件，让 AppHeader 和 Dashboard 重新获取权限
        window.dispatchEvent(new CustomEvent('permissionsUpdated', { 
          detail: { role, organizationId } 
        }));
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存权限失败:', error);
      message.error('保存权限失败');
    } finally {
      setSavingRole(null);
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

  // 切换折叠状态
  const toggleRoleExpanded = (roleCode) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleCode]: !prev[roleCode]
    }));
  };

  // 检查是否有任何权限改变
  const hasAnyPermissionChanged = (roleCode) => {
    return hasMenuPermissionChanged(roleCode) || hasActionPermissionChanged(roleCode);
  };

  const renderRoleCard = (role) => {
    const currentPermissions = permissions[role.roleCode];
    if (!currentPermissions) return null;

    const isExpanded = expandedRoles[role.roleCode] === true; // 默认收起

    return (
      <Card
        key={role.id}
        className="role-card"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space>
              {getIconComponent(role.icon, role.color)}
              <span>{role.roleName} ({role.roleCode})</span>
            </Space>
            <Space>
              <Button
                type="primary"
                size="small"
                className="save-btn"
                icon={<SaveOutlined />}
                onClick={() => handleSavePermission(role.roleCode)}
                disabled={!hasAnyPermissionChanged(role.roleCode)}
                loading={savingRole === role.roleCode}
              >
                保存
              </Button>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                onClick={() => toggleRoleExpanded(role.roleCode)}
              />
            </Space>
          </div>
        }
      >
        {isExpanded && (
          <>
            <div className="permission-section">
              <div className="permission-section-header">
                <Title level={5}>
                  <CheckCircleOutlined /> 顶部菜单权限
                </Title>
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
              </div>
              <div className="permission-grid">
                {actionItems
                  .filter(item => !item.isSubOf)  // 先渲染主项
                  .map(item => (
                  <React.Fragment key={item.key}>
                    <div className="permission-item">
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
                    {/* 渲染管理员子权限：当管理员开启时显示两个tab的开关 */}
                    {item.key === 'admin' && currentPermissions.actionPermissions['admin'] && (
                      <div
                        className="permission-item"
                        style={{
                          gridColumn: '1 / -1',
                          paddingLeft: 28
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            flexWrap: 'nowrap'
                          }}
                        >
                          {['admin_timetables', 'admin_pending'].map((subKey) => {
                            const sub = actionItems.find(a => a.key === subKey);
                            if (!sub) return null;
                            return (
                              <div
                                key={sub.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #f0f0f0',
                                  background: '#fafafa',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Space>
                                  <span className="permission-icon">{sub.icon}</span>
                                  <Text>{sub.label}</Text>
                                </Space>
                                <Switch
                                  checked={currentPermissions.actionPermissions[sub.key]}
                                  onChange={(checked) => handleActionPermissionChange(role.roleCode, sub.key, checked)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <OrganizationManagementPageLayout
      title="职位权限设置"
      organization={organization}
      contentClassName="role-permission-settings"
    >

      {loading ? (
        <div className="loading-state">
          <Spin size="large">
            <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
          </Spin>
        </div>
      ) : roles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>暂无职位权限设置</h3>
          <p>该机构还没有配置任何职位，请先在职位管理中创建职位</p>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/organizations/${organizationId}/roles`)}
          >
            前往职位管理
          </Button>
        </div>
      ) : (
        <div className="roles-container">
          {roles.map(role => renderRoleCard(role))}
        </div>
      )}
    </OrganizationManagementPageLayout>
  );
};

export default RolePermissionSettings;
