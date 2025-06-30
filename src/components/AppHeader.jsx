import React from 'react';
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';

const { Header } = Layout;

const AppHeader = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      label: '首页',
    },
    {
      key: '/create-timetable',
      label: '创建课表',
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
      <div className="logo">语音排课系统</div>
      <Menu
        theme="light"
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ 
          flex: 1, 
          minWidth: 0, 
          border: 'none',
          // 移动端隐藏菜单文字，只显示图标
          '@media (max-width: 768px)': {
            fontSize: '12px'
          }
        }}
        overflowedIndicator={null}
      />
      <Dropdown
        menu={{ items: userMenuItems }}
        placement="bottomRight"
        trigger={['click']}
      >
        <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
          <Avatar size="small" icon={<UserOutlined />} />
          <span 
            style={{ 
              marginLeft: 8,
              // 在小屏幕上隐藏用户名
              '@media (max-width: 480px)': {
                display: 'none'
              }
            }}
            className="username-text"
          >
            {user?.username}
          </span>
        </Button>
      </Dropdown>
    </Header>
  );
};

export default AppHeader; 