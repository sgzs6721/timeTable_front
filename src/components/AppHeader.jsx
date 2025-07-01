import React from 'react';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined, HomeOutlined } from '@ant-design/icons';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      label: '首页',
      icon: <HomeOutlined />,
    },
  ];

  if (user?.role === 'admin') {
    menuItems.push({
      key: '/admin',
      label: '管理面板',
    });
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
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

  return (
    <Header className="layout-header">
      <div className="header-content">
        <div className="logo">
          <img 
            src="/logo.png" 
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
              <Button type="text" className="user-dropdown">
                <Avatar size="small" icon={<UserOutlined />} />
                <span className="username-text">
                  {user?.username}
                </span>
              </Button>
            </Dropdown>
          </div>
        </div>
      </div>
    </Header>
  );
};

export default AppHeader; 