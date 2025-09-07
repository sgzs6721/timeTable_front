import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, Badge, Dropdown } from 'antd';
import { CalendarOutlined, LeftOutlined, CrownOutlined, UserAddOutlined, InboxOutlined, DownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import UserManagement from './UserManagement';
import TimetableManagement from './TimetableManagement';
import './AdminPanel.css';
import { getAllRegistrationRequests } from '../services/admin';

const AdminPanel = ({ user }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('timetables');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // 拉取待审批数量
    const fetchPending = async () => {
      try {
        const res = await getAllRegistrationRequests();
        if (res.success) {
          setPendingCount(res.data.filter(r => r.status === 'PENDING').length);
        }
      } catch {}
    };
    fetchPending();
  }, []);

  // 查看课表下拉菜单配置
  const getTimetableDropdownMenu = () => ({
    items: [
      {
        key: 'archived',
        label: '归档课表',
        icon: <InboxOutlined />,
        onClick: () => navigate('/admin-archived-timetables'),
      },
    ],
  });

  const tabItems = [
    {
      key: 'timetables',
      label: (
        <Space>
          <CalendarOutlined />
          <span>查看课表</span>
          <Dropdown menu={getTimetableDropdownMenu()} trigger={['click']} placement="bottomLeft">
            <DownOutlined style={{ fontSize: '10px', cursor: 'pointer' }} />
          </Dropdown>
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
      children: <UserManagement activeTab="users" />,
    },
    {
      key: 'pending',
      label: (
        <Space>
          <UserAddOutlined />
          <span>注册申请</span>
          {pendingCount > 0 && <Badge dot style={{ marginLeft: 2 }} />}
        </Space>
      ),
      children: <UserManagement activeTab="pending" />,
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
          onChange={(key) => setActiveTab(key)}
        />
      </div>

    </div>
  );
};

export default AdminPanel; 