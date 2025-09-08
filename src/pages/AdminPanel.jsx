import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, Badge, Dropdown, Spin } from 'antd';
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
  const [showArchived, setShowArchived] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);

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
        label: showArchived ? '活跃课表' : '归档课表',
        icon: <InboxOutlined />,
        onClick: () => {
          setTimetableLoading(true);
          setShowArchived(!showArchived);
        },
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
        </Space>
      ),
      children: (
        <div style={{ position: 'relative' }}>
          {/* 课表类型切换按钮 */}
          <div style={{ 
            marginBottom: '16px', 
            display: 'flex', 
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Button
              onClick={() => {
                setTimetableLoading(true);
                setShowArchived(false);
              }}
              style={{ 
                borderRadius: '6px 0 0 6px',
                borderRight: 'none',
                backgroundColor: !showArchived ? '#1890ff' : 'transparent',
                borderColor: '#1890ff',
                color: !showArchived ? '#fff' : '#1890ff'
              }}
            >
              <CalendarOutlined />
              活跃课表
            </Button>
            <Button
              onClick={() => {
                setTimetableLoading(true);
                setShowArchived(true);
              }}
              style={{ 
                borderRadius: '0 6px 6px 0',
                borderLeft: 'none',
                backgroundColor: showArchived ? '#ff8c00' : 'transparent',
                borderColor: '#ff8c00',
                color: showArchived ? '#fff' : '#ff8c00'
              }}
            >
              <InboxOutlined />
              归档课表
            </Button>
          </div>
          
          <TimetableManagement user={user} showArchived={showArchived} onLoadingChange={setTimetableLoading} />
          {timetableLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}>
              <Spin size="large" />
            </div>
          )}
        </div>
      ),
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