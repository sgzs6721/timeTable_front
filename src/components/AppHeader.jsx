import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Badge, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAllRegistrationRequests } from '../services/admin';
import { getPendingRequestsCount } from '../services/organization';
import { getCurrentUserPermissions } from '../services/rolePermission';
import logo from '../assets/logo.png';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [orgPendingCount, setOrgPendingCount] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  
  // 重置头像错误状态
  useEffect(() => {
    setAvatarError(false);
  }, [user]);

  // 获取待审批用户数量
  const fetchPendingCount = async () => {
    // 使用权限系统判断是否有管理员及“注册通知”子权限
    if (userPermissions?.actionPermissions?.admin && userPermissions?.actionPermissions?.admin_pending) {
      try {
        const response = await getAllRegistrationRequests();
        if (response.success) {
          // 只统计状态为 PENDING 的申请
          const pendingRequests = response.data?.filter(r => r.status === 'PENDING') || [];
          setPendingCount(pendingRequests.length);
        }
      } catch (error) {
        console.error('获取待审批用户数量失败:', error);
      }
    }
  };

  // 获取待审批机构申请数量
  const fetchOrgPendingCount = async () => {
    // 使用权限系统判断是否有机构管理权限
    if (userPermissions?.actionPermissions?.['organization-management']) {
      try {
        const count = await getPendingRequestsCount();
        setOrgPendingCount(count);
      } catch (error) {
        console.error('获取待审批机构申请数量失败:', error);
      }
    }
  };

  // 获取当前用户权限配置
  const fetchUserPermissions = async () => {
    try {
      console.log('[AppHeader] 开始获取用户权限配置...');
      const response = await getCurrentUserPermissions();
      console.log('[AppHeader] 权限API返回:', response);
      if (response && response.success) {
        console.log('[AppHeader] 设置权限配置:', response.data);
        setUserPermissions(response.data);
      } else {
        console.warn('[AppHeader] 权限API返回失败或无数据');
      }
    } catch (error) {
      console.error('[AppHeader] 获取用户权限失败:', error);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchPendingCount();
    fetchOrgPendingCount();
    fetchUserPermissions();
  }, [user]);

  // 监听权限更新事件
  useEffect(() => {
    const handlePermissionsUpdate = () => {
      console.log('[AppHeader] 检测到权限更新，重新获取权限配置');
      fetchUserPermissions();
    };
    
    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);
    return () => window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
  }, []);

  // 定期检查待审批数量（每30秒检查一次）
  useEffect(() => {
    if ((userPermissions?.actionPermissions?.admin && userPermissions?.actionPermissions?.admin_pending) || userPermissions?.actionPermissions?.['organization-management']) {
      const interval = setInterval(() => {
        if (userPermissions?.actionPermissions?.admin && userPermissions?.actionPermissions?.admin_pending) {
          fetchPendingCount();
        }
        if (userPermissions?.actionPermissions?.['organization-management']) {
          fetchOrgPendingCount();
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user, userPermissions]);

  const menuItems = [
    // {
    //   key: '/dashboard',
    //   label: '首页',
    //   icon: <HomeOutlined />,
    // },
  ];

  // 根据权限配置动态构建菜单项
  const userMenuItems = [];
  
  console.log('[AppHeader] userPermissions:', userPermissions);
  console.log('[AppHeader] actionPermissions:', userPermissions?.actionPermissions);
  
  const permissions = userPermissions?.actionPermissions || {};
  
  // 刷新（默认显示，除非明确设置为false）
  if (permissions.refresh !== false) {
    userMenuItems.push({
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新\u3000',
      onClick: () => {
        message.loading({ content: '正在刷新...', key: 'refreshing', duration: 0 });
        try {
          navigate(0);
        } catch (_) {
          window.location.reload();
        }
      }
    });
  }
  
  // 管理员相关菜单
  const adminMenus = [];
  
  if (permissions.admin === true) {
    adminMenus.push({
      key: 'admin',
      icon: <SettingOutlined />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>管理员</span>
          {pendingCount > 0 && (
            <Badge 
              count={pendingCount} 
              size="small" 
              style={{ 
                backgroundColor: '#ff4d4f',
                fontSize: '10px',
                lineHeight: '14px',
                minWidth: '16px',
                height: '16px',
                padding: '0 4px'
              }}
            />
          )}
        </div>
      ),
      onClick: () => navigate('/admin'),
    });
  }
  
  if (permissions['organization-management'] === true) {
    adminMenus.push({
      key: 'organization-management',
      icon: <InboxOutlined />,
      label: '机构管理',
      onClick: () => navigate('/my-organization'),
    });
  }
  
  if (adminMenus.length > 0) {
    userMenuItems.push({ type: 'divider' });
    userMenuItems.push(...adminMenus);
  }
  
  // 其他功能菜单
  const otherMenus = [];
  
  if (permissions.archived === true) {
    otherMenus.push({
      key: 'archived',
      icon: <InboxOutlined />,
      label: '归档课表',
      onClick: () => {
        const listItems = document.querySelectorAll('.timetable-list .ant-list-item');
        const nonArchivedCount = listItems.length;
        navigate('/archived-timetables', { state: { nonArchivedCount } });
      },
    });
  }
  
  if (permissions.profile === true) {
    otherMenus.push({
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人账号',
      onClick: () => navigate('/profile'),
    });
  }
  
  if (permissions.guide === true) {
    otherMenus.push({
      key: 'guide',
      icon: <InboxOutlined />,
      label: '使用说明',
      onClick: () => navigate('/guide'),
    });
  }
  
  if (otherMenus.length > 0) {
    userMenuItems.push({ type: 'divider' });
    userMenuItems.push(...otherMenus);
  }
  
  // 退出登录（默认显示，除非明确设置为false）
  if (permissions.logout !== false) {
    userMenuItems.push({ type: 'divider' });
    userMenuItems.push({
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    });
  }

  return (
    <Header className="layout-header">
      <div className="logo">
        <img
          src={logo}
          alt="飓风乒乓培训"
          className="logo-img"
          onClick={() => navigate('/dashboard')}
        />
      </div>
      <div className="header-nav">
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="nav-menu"
          style={{
            border: 'none',
            flex: 1,
            minWidth: 0,
            justifyContent: 'center'
          }}
          overflowedIndicator={null}
          disabledOverflow={true}
        />
        <div className="user-section">
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Button type="text" className="user-dropdown" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>
                {user?.nickname || user?.username}
              </span>
              <Badge 
                count={userPermissions?.actionPermissions?.admin && userPermissions?.actionPermissions?.admin_pending && pendingCount > 0 ? pendingCount : 0}
                size="small"
                style={{ 
                  backgroundColor: '#ff4d4f',
                  fontSize: '10px',
                  lineHeight: '14px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px'
                }}
              >
                {user?.wechatAvatar && !avatarError ? (
                  <Avatar
                    size="small"
                    src={user.wechatAvatar}
                    alt={user?.nickname || user?.username}
                    onError={() => {
                      setAvatarError(true);
                      return true;
                    }}
                  />
                ) : (
                  <Avatar
                    size="small"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    {(user?.nickname || user?.username)?.[0]?.toUpperCase()}
                  </Avatar>
                )}
              </Badge>
            </Button>
          </Dropdown>
        </div>
      </div>
    </Header>
  );
};

export default AppHeader;