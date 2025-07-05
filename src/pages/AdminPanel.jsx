import React, { useState } from 'react';
import { Tabs, Button, Space } from 'antd';
import { UserOutlined, CalendarOutlined, LeftOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import UserManagement from './UserManagement';
import TimetableManagement from './TimetableManagement';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const [activeTab, setActiveTab] = useState('users');
  const navigate = useNavigate();

  const tabItems = [
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
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => navigate('/dashboard')}
          icon={<LeftOutlined />}
          style={{ 
            position: 'absolute',
            left: 0,
            fontSize: '20px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            color: '#666'
          }}
        />
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Space align="center" size="large">
            <CrownOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
            <h1 style={{ margin: 0 }}>管理员面板</h1>
          </Space>
        </div>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ 
          backgroundColor: '#fff',
          padding: '10px 20px 20px 20px',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minHeight: 'calc(100vh - 200px)',
          marginBottom: 0
        }}
      />
    </div>
  );
};

export default AdminPanel; 