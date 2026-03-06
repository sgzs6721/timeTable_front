import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, Switch, Button, message, Spin, 
  Typography, Space, Divider 
} from 'antd';
import { 
  BellOutlined, SaveOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { getOrganization, getOrganizationNotificationSettings, updateOrganizationNotificationSettings } from '../services/organization';
import OrganizationManagementPageLayout from '../components/OrganizationManagementPageLayout';
import './OrganizationNotificationSettings.css';

const { Title, Text } = Typography;

const OrganizationNotificationSettings = () => {
  const { organizationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState({
    wechatEnabled: false,
    scheduleChangeEnabled: false,
    customerNewEnabled: false,
    todoEnabled: false,
    paymentPendingEnabled: false
  });
  const [originalSettings, setOriginalSettings] = useState({});

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 获取机构信息
      const orgResponse = await getOrganization(organizationId);
      if (orgResponse.success) {
        setOrganization(orgResponse.data);
      }
      
      // 获取通知设置
      const notificationResponse = await getOrganizationNotificationSettings(organizationId);
      if (notificationResponse.success) {
        setNotificationSettings(notificationResponse.data);
        setOriginalSettings(JSON.parse(JSON.stringify(notificationResponse.data)));
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleWechatEnabledChange = (checked) => {
    setNotificationSettings(prev => ({
      ...prev,
      wechatEnabled: checked,
      // 如果关闭微信提醒，也关闭所有子项
      scheduleChangeEnabled: checked ? prev.scheduleChangeEnabled : false,
      customerNewEnabled: checked ? prev.customerNewEnabled : false,
      todoEnabled: checked ? prev.todoEnabled : false,
      paymentPendingEnabled: checked ? prev.paymentPendingEnabled : false
    }));
  };

  const handleSubSettingChange = (key, checked) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  const hasSettingsChanged = () => {
    return JSON.stringify(notificationSettings) !== JSON.stringify(originalSettings);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await updateOrganizationNotificationSettings(organizationId, notificationSettings);
      
      if (response.success) {
        message.success('通知设置保存成功');
        setOriginalSettings(JSON.parse(JSON.stringify(notificationSettings)));
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrganizationManagementPageLayout
      title="通知设置"
      organization={organization}
      headerAction={(
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          disabled={!hasSettingsChanged()}
          loading={saving}
        >
          保存设置
        </Button>
      )}
      contentClassName="notification-settings"
    >

      {loading ? (
        <div className="loading-state">
          <Spin size="large">
            <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
          </Spin>
        </div>
      ) : (
        <div className="settings-container">
          <Card className="settings-card">
            <div className="setting-item main-setting">
              <div className="setting-header">
                <div className="setting-info">
                  <BellOutlined className="setting-icon" />
                  <div className="setting-title">
                    <Title level={4} style={{ margin: 0 }}>微信提醒</Title>
                    <Text type="secondary">开启后，将通过微信发送相关通知</Text>
                  </div>
                </div>
              </div>
              <div className="switch-container">
                <Switch
                  checked={notificationSettings.wechatEnabled}
                  onChange={handleWechatEnabledChange}
                />
              </div>
            </div>

            {notificationSettings.wechatEnabled && (
              <>
                <Divider />
                
                <div className="setting-item">
                  <div className="setting-header">
                    <div className="setting-info">
                      <CheckCircleOutlined className="setting-icon" />
                      <div className="setting-title">
                        <Title level={5} style={{ margin: 0 }}>课时变更提醒</Title>
                        <Text type="secondary">当课表发生变更时发送通知</Text>
                      </div>
                    </div>
                  </div>
                  <div className="switch-container">
                    <Switch
                      checked={notificationSettings.scheduleChangeEnabled}
                      onChange={(checked) => handleSubSettingChange('scheduleChangeEnabled', checked)}
                    />
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-header">
                    <div className="setting-info">
                      <CheckCircleOutlined className="setting-icon" />
                      <div className="setting-title">
                        <Title level={5} style={{ margin: 0 }}>客源新增提醒</Title>
                        <Text type="secondary">当有新客户添加时发送通知</Text>
                      </div>
                    </div>
                  </div>
                  <div className="switch-container">
                    <Switch
                      checked={notificationSettings.customerNewEnabled}
                      onChange={(checked) => handleSubSettingChange('customerNewEnabled', checked)}
                    />
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-header">
                    <div className="setting-info">
                      <CheckCircleOutlined className="setting-icon" />
                      <div className="setting-title">
                        <Title level={5} style={{ margin: 0 }}>待办事项提醒</Title>
                        <Text type="secondary">当有待办事项需要处理时发送通知</Text>
                      </div>
                    </div>
                  </div>
                  <div className="switch-container">
                    <Switch
                      checked={notificationSettings.todoEnabled}
                      onChange={(checked) => handleSubSettingChange('todoEnabled', checked)}
                    />
                  </div>
                </div>

                <div className="setting-item">
                  <div className="setting-header">
                    <div className="setting-info">
                      <CheckCircleOutlined className="setting-icon" />
                      <div className="setting-title">
                        <Title level={5} style={{ margin: 0 }}>待缴费提醒</Title>
                        <Text type="secondary">当有费用需要缴纳时发送通知</Text>
                      </div>
                    </div>
                  </div>
                  <div className="switch-container">
                    <Switch
                      checked={notificationSettings.paymentPendingEnabled}
                      onChange={(checked) => handleSubSettingChange('paymentPendingEnabled', checked)}
                    />
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </OrganizationManagementPageLayout>
  );
};

export default OrganizationNotificationSettings;