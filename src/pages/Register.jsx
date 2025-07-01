import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { register } from '../services/auth';
import logo from '../assets/logo.png';

const Register = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await register(values);
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data.user);
        message.success('注册成功');
      } else {
        message.error(response.message || '注册失败');
      }
    } catch (error) {
      message.error('注册失败，请检查网络连接');
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
        title={
          <div style={{ textAlign: 'center' }}>
            <img 
              src={logo} 
              alt="飓风乒乓培训" 
              style={{
                height: '60px',
                maxWidth: '560px',
                objectFit: 'contain',
                marginBottom: '0px'
              }}
            />
            <div style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#262626',
              marginTop: '4px'
            }}>
              新用户注册
            </div>
          </div>
        }
        style={{ width: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
        headStyle={{ textAlign: 'center', padding: '16px 24px 8px' }}
      >
        <Form
          name="register"
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名!' },
              { min: 3, message: '用户名至少3个字符!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
              { min: 6, message: '密码至少6个字符!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致!'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
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
              注册
            </Button>
          </Form.Item>

          <Divider>已有账号？</Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Link to="/login">
              <Button type="link" size="large">
                立即登录
              </Button>
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register; 