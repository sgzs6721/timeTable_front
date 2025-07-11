import React from 'react';
import { Tabs, Button, Space } from 'antd';
import { CalendarOutlined, LeftOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import UserManagement from './UserManagement';
import TimetableManagement from './TimetableManagement';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();

  const tabItems = [
    {
      key: 'timetables',
      label: (
        <Space>
          <CalendarOutlined />
          <span>查看课表</span>
        </Space>
      ),
      children: <TimetableManagement user={user} />,
    },
    {
      key: 'users',
      label: (
        <Space>
          <CrownOutlined />
          <span>权限管理</span>
        </Space>
      ),
      children: <UserManagement />,
    },
  ];

  const renderTabBar = (props, DefaultTabBar) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', position: 'relative', marginTop: '1rem', marginBottom: '1rem'}}>
        <Button
          onClick={() => navigate('/dashboard')}
          icon={<LeftOutlined />}
          shape="circle"
          style={{ 
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Space align="center" size="large">
            <h1 style={{ margin: 0, fontSize: '22px' }}>管理员面板</h1>
          </Space>
        </div>
      </div>
      <DefaultTabBar {...props} />
    </div>
  );

  const DesktopHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
      <Button
        onClick={() => navigate('/dashboard')}
        icon={<LeftOutlined />}
        shape="circle"
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Space align="center" size="large">
          <CrownOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
          <h1 style={{ margin: 0 }}>管理员面板</h1>
        </Space>
      </div>
    </div>
  );

  return (
    <div className={isMobile ? "page-container-mobile-admin" : "page-container"}>
      {!isMobile && <DesktopHeader />}
      <div className={isMobile ? "mobile-tabs-container with-gradient-border" : ""}>
        <Tabs
          defaultActiveKey="timetables"
          items={tabItems}
          size="large"
          renderTabBar={isMobile ? renderTabBar : undefined}
          className={!isMobile ? "desktop-tabs with-gradient-border" : ""}
        />
      </div>
    </div>
  );
};

export default AdminPanel; 