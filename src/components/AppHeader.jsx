import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined, InboxOutlined } from '@ant-design/icons';
import { getAllRegistrationRequests } from '../services/admin';
import logo from '../assets/logo.png';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

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

  // 组件挂载时获取数据
  useEffect(() => {
    fetchPendingCount();
  }, [user]);

  // 定期检查待审批数量（每30秒检查一次）
  useEffect(() => {
    if (user?.role?.toUpperCase() === 'ADMIN') {
      const interval = setInterval(fetchPendingCount, 30000);
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
      key: 'archived',
      icon: <InboxOutlined />,
      label: '归档课表',
      onClick: () => {
        // 从当前页面获取非归档课表数量 - 使用更精确的选择器
        const listItems = document.querySelectorAll('.timetable-list .ant-list-item');
        const nonArchivedCount = listItems.length;
        console.log('获取到的非归档课表数量:', nonArchivedCount);
        console.log('找到的List项目:', listItems);
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
    userMenuItems.unshift({
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
    }, { type: 'divider' });
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
            <Button type="text" className="user-dropdown" style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>
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
                <Avatar
                  size="small"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  {(user?.nickname || user?.username)?.[0]?.toUpperCase()}
                </Avatar>
              </Badge>
            </Button>
          </Dropdown>
        </div>
      </div>
    </Header>
  );
};

export default AppHeader;