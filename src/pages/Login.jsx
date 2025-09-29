import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { login } from '../services/auth';
import WechatLogin from '../components/WechatLogin';
import logo from '../assets/logo.png';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '24px'
    }}>
      <Card 
        style={{ width: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
      >
        <div style={{ 
          marginBottom: '24px'
        }}>
          <img 
            src={logo} 
            alt="飓风乒乓培训" 
            style={{
              height: '40px',
            }}
          />
          <div style={{
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#262626',
            textAlign: 'center',
            marginTop: '16px'
          }}>
            课表管理系统
          </div>
        </div>

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

          <Divider style={{ margin: '12px 0' }}>其他登录方式</Divider>
          
          <WechatLogin onLogin={onLogin} />
          
          <Divider style={{ margin: '12px 0' }}>还没有账号？</Divider>
          
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