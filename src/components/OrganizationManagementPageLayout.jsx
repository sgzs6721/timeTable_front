import React from 'react';
import { Button, Typography } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './OrganizationManagementPageLayout.css';

const { Title, Text } = Typography;

const OrganizationManagementPageLayout = ({ title, organization, headerAction, contentClassName = '', children }) => {
  const navigate = useNavigate();

  return (
    <div className="org-mgmt-page-layout">
      <div className="org-mgmt-page-shell">
        <div className="org-mgmt-page-header-card">
          <div className="org-mgmt-page-header-main">
            <Button
              type="text"
              shape="circle"
              icon={<LeftOutlined />}
              onClick={() => navigate(-1)}
              className="org-mgmt-page-back-btn"
              size="large"
            />
            <div className="org-mgmt-page-title-wrap">
              <Title level={2} style={{ margin: 0 }}>{title}</Title>
              {organization && (
                <Text type="secondary">
                  {organization.name} ({organization.code})
                </Text>
              )}
            </div>
          </div>
          {headerAction ? <div className="org-mgmt-page-header-action">{headerAction}</div> : null}
        </div>

        <div className={`org-mgmt-page-content ${contentClassName}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default OrganizationManagementPageLayout;
