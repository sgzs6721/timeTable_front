import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Divider, Space, Alert } from 'antd';
import { UserOutlined, LockOutlined, BugOutlined, CrownOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { login, loginWithTestAccount, loginWithAdminTestAccount } from '../services/auth';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [adminTestLoading, setAdminTestLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await login(values);
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data.user);
        message.success('登录成功');
      } else {
        message.error(response.message || '登录失败');
      }
    } catch (error) {
      message.error('登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 测试账号登录
  const handleTestLogin = async () => {
    setTestLoading(true);
    try {
      const response = await loginWithTestAccount();
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data.user);
        message.success(response.message);
      }
    } catch (error) {
      message.error('测试账号登录失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 管理员测试账号登录
  const handleAdminTestLogin = async () => {
    setAdminTestLoading(true);
    try {
      const response = await loginWithAdminTestAccount();
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data.user);
        message.success(response.message);
      }
    } catch (error) {
      message.error('管理员测试账号登录失败');
    } finally {
      setAdminTestLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        title={
          <div style={{ textAlign: 'center' }}>
            <img 
              src="/logo.png" 
              alt="飓风乒乓培训" 
              style={{
                height: '160px',
                maxWidth: '560px',
                objectFit: 'contain',
                marginBottom: '12px'
              }}
            />
            <div style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#262626',
              marginTop: '12px'
            }}>
              课程管理系统
            </div>
          </div>
        }
        style={{ width: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
        headStyle={{ textAlign: 'center', padding: '32px 24px 20px' }}
      >
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              style={{ height: '45px' }}
            >
              登录
            </Button>
          </Form.Item>

          <Divider>开发测试</Divider>
          
          <Alert
            message="开发调试模式"
            description="以下测试账号仅用于前端开发调试，后端联调完成后将删除"
            type="info"
            showIcon
            style={{ marginBottom: 16, fontSize: '12px' }}
          />

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button 
              icon={<BugOutlined />}
              loading={testLoading}
              onClick={handleTestLogin}
              block
              size="large"
              style={{ height: '40px' }}
            >
              使用普通测试账号登录
            </Button>
            
            <Button 
              icon={<CrownOutlined />}
              loading={adminTestLoading}
              onClick={handleAdminTestLogin}
              block
              size="large"
              type="dashed"
              style={{ height: '40px' }}
            >
              使用管理员测试账号登录
            </Button>
          </Space>

          <Divider>还没有账号？</Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Link to="/register">
              <Button type="link" size="large">
                立即注册
              </Button>
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login; 