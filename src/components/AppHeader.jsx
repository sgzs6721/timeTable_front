import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Badge, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { getAllRegistrationRequests } from '../services/admin';
import { getPendingRequestsCount } from '../services/organization';
import logo from '../assets/logo.png';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [orgPendingCount, setOrgPendingCount] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  
  // 重置头像错误状态
  useEffect(() => {
    setAvatarError(false);
  }, [user]);

  // 获取待审批用户数量
  const fetchPendingCount = async () => {
    if (user?.role?.toUpperCase() === 'ADMIN') {
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
    if (user?.role?.toUpperCase() === 'ADMIN') {
      try {
        const count = await getPendingRequestsCount();
        setOrgPendingCount(count);
      } catch (error) {
        console.error('获取待审批机构申请数量失败:', error);
      }
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchPendingCount();
    fetchOrgPendingCount();
  }, [user]);

  // 定期检查待审批数量（每30秒检查一次）
  useEffect(() => {
    if (user?.role?.toUpperCase() === 'ADMIN') {
      const interval = setInterval(() => {
        fetchPendingCount();
        fetchOrgPendingCount();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const menuItems = [
    // {
    //   key: '/dashboard',
    //   label: '首页',
    //   icon: <HomeOutlined />,
    // },
  ];

  const userMenuItems = [
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新\u3000',
      onClick: () => {
        // 轻提示+刷新当前页面数据
        message.loading({ content: '正在刷新...', key: 'refreshing', duration: 0 });
        // 优先尝试软刷新：重新加载当前路由
        try {
          navigate(0);
        } catch (_) {
          window.location.reload();
        }
      }
    },
    { type: 'divider' },
    {
      key: 'archived',
      icon: <InboxOutlined />,
      label: '归档课表',
      onClick: () => {
        // 从当前页面获取非归档课表数量 - 使用更精确的选择器
        const listItems = document.querySelectorAll('.timetable-list .ant-list-item');
        const nonArchivedCount = listItems.length;
        // 无论是否管理员，头像菜单都进入个人归档页
        navigate('/archived-timetables', { state: { nonArchivedCount } });
      },
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人账号',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'guide',
      icon: <InboxOutlined />,
      label: '使用说明',
      onClick: () => navigate('/guide'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  if (user?.role?.toUpperCase() === 'ADMIN') {
    const adminItem = {
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
    };
    
    const organizationItem = {
      key: 'organization-management',
      icon: <InboxOutlined />,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>机构管理</span>
          {orgPendingCount > 0 && (
            <Badge 
              count={orgPendingCount} 
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
      onClick: () => navigate('/organization-management'),
    };
    
    // 目标顺序：刷新 -> 分隔线 -> 管理员 -> 机构管理 -> 归档课表 ...
    if (userMenuItems[1]?.type === 'divider') {
      // 分隔线已存在在刷新后，将管理员和机构管理插入到分隔线之后，并在其后再加一条分隔线
      userMenuItems.splice(2, 0, adminItem, organizationItem, { type: 'divider' });
    } else {
      // 没有分隔线，则先插入分隔线，再插入管理员、机构管理和分隔线
      userMenuItems.splice(1, 0, { type: 'divider' }, adminItem, organizationItem, { type: 'divider' });
    }
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
                count={user?.role?.toUpperCase() === 'ADMIN' && pendingCount > 0 ? pendingCount : 0}
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