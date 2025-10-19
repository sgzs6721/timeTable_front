import React, { useState } from 'react';
import { Tabs } from 'antd';
import { UserOutlined, SettingOutlined } from '@ant-design/icons';
import SalarySettings from './SalarySettings';
import SalarySystemSettings from './SalarySystemSettings';

const SalaryMaster = () => {
  const [activeTab, setActiveTab] = useState('coaches');

  const tabItems = [
    {
      key: 'coaches',
      label: '教练工资',
      children: <SalarySettings />,
    },
    {
      key: 'system',
      label: '记薪周期',
      children: <SalarySystemSettings />,
    },
  ];

  return (
    <div style={{ padding: '12px 0' }}>
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
