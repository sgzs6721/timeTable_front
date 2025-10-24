import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Modal } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined, ArrowLeftOutlined, LogoutOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, deactivateAccount, bindWechatToAccount } from '../services/auth';
import Footer from '../components/Footer';
import './UserProfile.css';

const { confirm } = Modal;

const UserProfile = ({ user }) => {
  const navigate = useNavigate();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);
  const [initialValues, setInitialValues] = useState({});
  const [currentFormValues, setCurrentFormValues] = useState({});
  const [bindAccountModalVisible, setBindAccountModalVisible] = useState(false);
  const [bindAccountForm] = Form.useForm();
  const [bindAccountLoading, setBindAccountLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const values = {
        username: user.username,
        nickname: user.nickname || '',
      };
      setInitialValues(values);
      setCurrentUser(user);
      setCurrentFormValues(values);
      profileForm.setFieldsValue(values);
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      const response = await updateProfile(values);
      if (response.success) {
        message.success('资料更新成功');
        
        // 更新当前组件的用户信息
        const updatedUser = response.data.user;
        setCurrentUser(updatedUser);
        
        // 更新初始值
        const newInitialValues = {
          username: updatedUser.username,
          nickname: updatedUser.nickname || '',
        };
        setInitialValues(newInitialValues);
        setCurrentFormValues(newInitialValues);
        
        // 更新localStorage中的用户信息
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 如果有新token，更新token
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        
        // 触发全局用户信息更新事件，让其他组件也能更新
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
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

  // 监听表单值变化
  const handleFormValuesChange = (changedValues, allValues) => {
    setCurrentFormValues(allValues);
  };

  // 判断表单是否有变更
  const hasFormChanged = () => {
    return (
      currentFormValues.username !== initialValues.username ||
      (currentFormValues.nickname || '') !== (initialValues.nickname || '')
    );
  };

  // 判断是否是微信登录用户（临时账号）
  const isWechatTempUser = () => {
    return currentUser?.username && currentUser.username.startsWith('wx_');
  };

  // 判断是否是已绑定微信的正式账号
  const isWechatBoundUser = () => {
    return currentUser?.wechatAvatar && !currentUser?.username?.startsWith('wx_');
  };

  // 判断昵称是否应该禁用（所有微信用户）
  const shouldDisableNickname = () => {
    return currentUser?.wechatAvatar || currentUser?.username?.startsWith('wx_');
  };

  // 判断用户名是否应该禁用（只有已绑定的微信用户）
  const shouldDisableUsername = () => {
    return isWechatBoundUser();
  };

  // 处理绑定账号
  const handleBindAccount = async (values) => {
    setBindAccountLoading(true);
    try {
      const response = await bindWechatToAccount(values.username, values.password);
      if (response.success) {
        message.success('账号绑定成功！');
        
        // 更新token和用户信息
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
          setCurrentUser(response.data.user);
          
          // 触发全局用户信息更新事件
          window.dispatchEvent(new CustomEvent('userUpdated', { detail: response.data.user }));
        }
        
        // 关闭模态框
        setBindAccountModalVisible(false);
        bindAccountForm.resetFields();
        
        // 刷新页面以更新所有信息
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        message.error(response.message || '绑定失败');
      }
    } catch (error) {
      console.error('绑定账号失败:', error);
      message.error('绑定失败，请稍后重试');
    } finally {
      setBindAccountLoading(false);
    }
  };

  return (
    <div className="user-profile-container">
      <div className="user-profile-content">
        <Card title="基本信息" className="profile-card">
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleUpdateProfile}
            onValuesChange={handleFormValuesChange}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 20, message: '用户名最多20个字符' },
              ]}
              tooltip={shouldDisableUsername() ? "已绑定微信的账号用户名不可修改" : ""}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
                size="large"
                disabled={shouldDisableUsername()}
                style={shouldDisableUsername() ? { 
                  backgroundColor: '#f5f5f5',
                  color: '#999',
                  cursor: 'not-allowed'
                } : {}}
              />
            </Form.Item>

            <Form.Item
              label="昵称"
              name="nickname"
              rules={[
                { max: 50, message: '昵称最多50个字符' },
              ]}
              tooltip={shouldDisableNickname() ? "微信登录用户的昵称来自微信，不可修改" : ""}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入昵称（可选）"
                size="large"
                disabled={shouldDisableNickname()}
                style={shouldDisableNickname() ? { 
                  backgroundColor: '#f5f5f5',
                  color: '#999',
                  cursor: 'not-allowed'
                } : {}}
              />
            </Form.Item>

            <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
              {isWechatTempUser() ? (
                <Button
                  type="primary"
                  onClick={() => setBindAccountModalVisible(true)}
                  icon={<LinkOutlined />}
                  size="large"
                  className="action-button"
                  style={{ 
                    background: 'linear-gradient(135deg, #07c160 0%, #05a850 100%)',
                    borderColor: '#07c160'
                  }}
                >
                  绑定账号
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={!hasFormChanged()}
                  icon={<SaveOutlined />}
                  size="large"
                  className="action-button"
                >
                  更新资料
                </Button>
              )}
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
      
      {/* 版权信息 */}
      <Footer />

      {/* 绑定账号模态框 */}
      <Modal
        title="绑定到已有账号"
        open={bindAccountModalVisible}
        onCancel={() => {
          setBindAccountModalVisible(false);
          bindAccountForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <div style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
          <p>将当前微信账号绑定到已有的课表账号</p>
          <p style={{ color: '#faad14' }}>⚠️ 绑定后将使用已有账号的所有数据</p>
        </div>
        <Form
          form={bindAccountForm}
          layout="vertical"
          onFinish={handleBindAccount}
        >
          <Form.Item
            label="已有账号用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入已有账号的用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="账号密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入账号密码"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={bindAccountLoading}
              icon={<LinkOutlined />}
              size="large"
              style={{ 
                width: '100%',
                background: 'linear-gradient(135deg, #07c160 0%, #05a850 100%)',
                borderColor: '#07c160'
              }}
            >
              确认绑定
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserProfile;