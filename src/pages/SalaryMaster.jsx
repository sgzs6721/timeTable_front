import React, { useState } from 'react';
import { Tabs } from 'antd';
import { UserOutlined, SettingOutlined } from '@ant-design/icons';
import SalarySettings from './SalarySettings';
import SalarySystemSettings from './SalarySystemSettings';

const SalaryMaster = ({ organizationId }) => {
  const [activeTab, setActiveTab] = useState('coaches');

  const tabItems = [
    {
      key: 'coaches',
      label: '教练工资',
      children: <SalarySettings organizationId={organizationId} />,
    },
    {
      key: 'system',
      label: '记薪周期',
      children: <SalarySystemSettings organizationId={organizationId} />,
    },
  ];

  return (
    <div style={{ 
      background: '#fff',
      borderRadius: '12px',
      padding: '8px 16px 24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
    }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        tabBarGutter={24}
      />
    </div>
  );
};

export default SalaryMaster;
