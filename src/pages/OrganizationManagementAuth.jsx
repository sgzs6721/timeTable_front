import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import OrganizationManagement from './OrganizationManagement';
import { verifyOrgManagementAuth } from '../services/organization';
import './OrganizationManagementAuth.css';

/**
 * 机构管理访问验证页面
 * 需要单独的用户名密码验证
 */
const OrganizationManagementAuth = () => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    // 检查是否已经验证过（使用 sessionStorage，浏览器关闭后需要重新验证）
    const isAuth = sessionStorage.getItem('orgMgmtAuth');
    if (isAuth === 'true') {
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = async (values) => {
    setLoading(true);
    
    try {
      // 调用后端验证接口（独立的用户名密码验证）
      const response = await verifyOrgManagementAuth(values.username, values.password);
      
      if (response.success) {
        // 验证成功，保存验证状态和 JWT token
        sessionStorage.setItem('orgMgmtAuth', 'true');
        sessionStorage.setItem('orgMgmtUsername', response.data.username);
        sessionStorage.setItem('orgMgmtToken', response.data.token);
        setAuthenticated(true);
        message.success('✓ 验证成功');
      } else {
        // 验证失败
        message.error(response.message || '用户名或密码错误');
        form.setFieldsValue({ password: '' });
      }
    } catch (error) {
      console.error('验证失败:', error);
      message.error(error.response?.data?.message || '验证失败，请稍后重试');
      form.setFieldsValue({ password: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('orgMgmtAuth');
    sessionStorage.removeItem('orgMgmtUsername');
    sessionStorage.removeItem('orgMgmtToken');
    setAuthenticated(false);
    message.info('已退出机构管理');
  };

  // 如果已验证，显示机构管理页面
  if (authenticated) {
    return (
      <div className="org-mgmt-wrapper">
        <div className="auth-status-bar">
          <div className="status-info">
            <span className="status-badge">✓</span>
            <span className="status-text">已验证进入机构管理模式</span>
          </div>
          <Button 
            size="small" 
            onClick={handleLogout}
            className="logout-btn"
            icon={<LockOutlined />}
          >
            退出机构管理
          </Button>
        </div>
        <OrganizationManagement />
      </div>
    );
  }

  // 未验证，显示登录表单
  return (
    <div className="org-mgmt-auth-container">
      <div className="auth-background">
        <div className="gradient-circle circle-1"></div>
        <div className="gradient-circle circle-2"></div>
        <div className="gradient-circle circle-3"></div>
      </div>
      
      <div className="auth-content">
        <div className="auth-logo">
          <div className="logo-icon">
            <LockOutlined />
          </div>
          <h1>机构管理系统</h1>
          <p className="auth-subtitle">访问验证</p>
        </div>

        <Card className="auth-card">
          <div className="auth-description">
            <p>🔒 此页面需要独立的管理员凭证才能访问</p>
          </div>
          
          <Form
            form={form}
            name="org_mgmt_auth"
            onFinish={handleLogin}
            autoComplete="off"
            className="auth-form"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="input-icon" />}
                placeholder="请输入管理员用户名"
                size="large"
                autoComplete="username"
                className="auth-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="input-icon" />}
                placeholder="请输入管理员密码"
                size="large"
                autoComplete="current-password"
                className="auth-input"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                className="auth-submit-btn"
              >
                {loading ? '验证中...' : '验证并进入'}
              </Button>
            </Form.Item>

            <div className="auth-footer">
              <Button 
                type="link" 
                onClick={() => navigate('/admin')}
                className="back-link"
              >
                ← 返回管理员面板
              </Button>
            </div>
          </Form>
        </Card>

        <div className="auth-tips">
          <p>💡 提示：使用系统管理员账号登录</p>
        </div>
      </div>
    </div>
  );
};

export default OrganizationManagementAuth;

