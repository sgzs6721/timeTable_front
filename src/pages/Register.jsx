import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Divider, Result } from 'antd';
import { UserOutlined, LockOutlined, SmileOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/auth';
import logo from '../assets/logo.png';

const Register = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 移除确认密码字段，添加昵称字段
      const { confirmPassword, ...registrationData } = values;
      const response = await register(registrationData);
      if (response.success) {
        setUserInfo({
          username: values.username,
          nickname: values.nickname
        });
        setRegistrationSuccess(true);
        message.success('注册申请已提交，请等待管理员确认');
      } else {
        message.error(response.message || '注册失败');
      }
    } catch (error) {
      message.error('注册失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const handleBackToRegister = () => {
    setRegistrationSuccess(false);
    setUserInfo(null);
  };

  // 注册成功后的停留页面
  if (registrationSuccess) {
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
          style={{ 
            width: 600, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}
        >
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            status="success"
            title="注册申请提交成功！"
            subTitle={
              <div style={{ textAlign: 'left', marginTop: '16px' }}>
                <p style={{ marginBottom: '8px' }}>
                  <strong>用户名：</strong>{userInfo?.username}
                </p>
                <p style={{ marginBottom: '8px' }}>
                  <strong>昵称：</strong>{userInfo?.nickname}
                </p>
                <p style={{ marginBottom: '16px' }}>
                  <strong>申请时间：</strong>{new Date().toLocaleString()}
                </p>
                <div style={{ 
                  backgroundColor: '#f6ffed', 
                  border: '1px solid #b7eb8f', 
                  borderRadius: '6px', 
                  padding: '12px',
                  marginTop: '16px'
                }}>
                  <p style={{ margin: 0, color: '#52c41a', fontSize: '14px' }}>
                    📋 您的注册申请已提交，请等待管理员审核。
                  </p>
                  <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '13px' }}>
                    审核通过后，您就可以使用用户名和密码登录系统了。
                  </p>
                </div>
              </div>
            }
            extra={[
              <Button 
                key="login" 
                type="primary" 
                icon={<ArrowLeftOutlined />}
                onClick={handleBackToLogin}
                size="large"
                style={{ marginRight: '12px' }}
              >
                返回登录
              </Button>,
              <Button 
                key="register" 
                onClick={handleBackToRegister}
                size="large"
              >
                继续注册
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

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
            name="nickname"
            rules={[
              { required: true, message: '请输入昵称!' },
              { max: 50, message: '昵称不能超过50个字符!' }
            ]}
          >
            <Input 
              prefix={<SmileOutlined />} 
              placeholder="昵称" 
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
              提交注册申请
            </Button>
          </Form.Item>

          <div style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            注册申请提交后需要管理员确认才能登录
          </div>

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