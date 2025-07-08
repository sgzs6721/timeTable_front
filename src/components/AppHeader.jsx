import React from 'react';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined, HomeOutlined, InboxOutlined } from '@ant-design/icons';
import logo from '../assets/logo.png';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
      onClick: () => navigate('/archived-timetables'),
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
      label: '管理员',
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
                {user?.username}
              </span>
              <Avatar
                size="small"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
            </Button>
          </Dropdown>
        </div>
      </div>
    </Header>
  );
};

export default AppHeader; 