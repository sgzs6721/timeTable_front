import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Modal } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined, ArrowLeftOutlined, LogoutOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, deactivateAccount } from '../services/auth';
import './UserProfile.css';

const { confirm } = Modal;

const UserProfile = ({ user }) => {
  const navigate = useNavigate();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
      });
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      const response = await updateProfile(values);
      if (response.success) {
        message.success('用户名更新成功');
        
        // 更新localStorage中的用户信息
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        // 如果有新token，更新token
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        
        // 重新加载页面以更新所有组件中的用户信息
        window.location.reload();
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      message.error('更新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (values) => {
    setPasswordLoading(true);
    try {
      const response = await updatePassword(values);
      if (response.success) {
        message.success('密码更新成功');
        passwordForm.resetFields();
      } else {
        message.error(response.message || '密码更新失败');
      }
    } catch (error) {
      message.error('密码更新失败，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
    message.success('已退出登录');
  };

  const handleDeactivateAccount = () => {
    confirm({
      title: '确认注销账号',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p><strong>警告：此操作不可逆！</strong></p>
          <p>注销账号后：</p>
          <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
            <li>您的账号将被停用，无法再次登录</li>
            <li>所有课表数据将被标记为已删除</li>
            <li>相关的课程安排也将无法访问</li>
          </ul>
          <p>您确定要注销账号吗？</p>
        </div>
      ),
      okText: '确认注销',
      okType: 'danger',
      cancelText: '取消',
      width: 450,
      onOk: async () => {
        setDeactivateLoading(true);
        try {
          const response = await deactivateAccount();
          if (response.success) {
            message.success('账号已成功注销');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
          } else {
            message.error(response.message || '注销失败');
          }
        } catch (error) {
          message.error('注销失败，请稍后重试');
        } finally {
          setDeactivateLoading(false);
        }
      },
    });
  };

  return (
    <div className="user-profile-container">
      <div className="user-profile-content">
        <Card title="基本信息" className="profile-card">
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleUpdateProfile}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' },
              ]}
              style={{ marginBottom: 0 }}
            >
              <div className="username-input-row">
                <Input
                  prefix={<UserOutlined />}
                  placeholder="请输入用户名"
                  size="large"
                  className="username-input"
                />
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SaveOutlined />}
                  size="large"
                  className="action-button"
                >
                  更新用户名
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Card>

        <Card title="修改密码" className="profile-card">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleUpdatePassword}
          >
            <Form.Item
              label="当前密码"
              name="oldPassword"
              rules={[
                { required: true, message: '请输入当前密码' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入当前密码"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="新密码"
              name="newPassword"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入新密码"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="确认新密码"
              name="confirmPassword"
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请确认新密码"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
                icon={<SaveOutlined />}
                size="large"
                className="action-button password-update-button"
              >
                更新密码
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="账号信息" className="profile-card">
          <div className="account-info-compact">
            <div className="info-row">
              <span className="info-label">注册时间:</span>
              <span className="info-value">
                {user?.createdAt ? new Date(user.createdAt).toLocaleString() : '未知'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">更新时间:</span>
              <span className="info-value">
                {user?.updatedAt ? new Date(user.updatedAt).toLocaleString() : '未知'}
              </span>
            </div>
          </div>
        </Card>

        {/* 底部操作按钮 */}
        <div className="bottom-actions">
          <Button
            size="large"
            onClick={handleGoBack}
            className="bottom-button back-button-bottom"
          >
            返回
          </Button>
          <Button
            size="large"
            danger
            onClick={handleDeactivateAccount}
            loading={deactivateLoading}
            className="bottom-button deactivate-button"
          >
            注销账号
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;