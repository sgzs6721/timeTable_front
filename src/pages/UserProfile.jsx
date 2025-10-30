import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Modal, Spin, Radio, Space } from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined, LinkOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, deactivateAccount, bindWechatToAccount, createAccountForWechat, setPassword, validateToken } from '../services/auth';
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
  const [pageLoading, setPageLoading] = useState(true);
  const [bindMode, setBindMode] = useState('create'); // 'create' 或 'bind'

  // 页面加载时获取最新用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setPageLoading(true);
        const response = await validateToken();
        
        if (response.success && response.data) {
          const userData = response.data.user || response.data;
          
          // 如果是微信临时用户（wx_开头），用户名显示为空让用户自己设置
          const isWechatTemp = userData.username && userData.username.startsWith('wx_');
          const values = {
            username: isWechatTemp ? '' : userData.username,
            nickname: userData.nickname || '',
          };
          
          setInitialValues(values);
          setCurrentUser(userData);
          setCurrentFormValues(values);
          profileForm.setFieldsValue(values);
        } else {
          if (user) {
            const isWechatTemp = user.username && user.username.startsWith('wx_');
            const values = {
              username: isWechatTemp ? '' : user.username,
              nickname: user.nickname || '',
            };
            setInitialValues(values);
            setCurrentUser(user);
            setCurrentFormValues(values);
            profileForm.setFieldsValue(values);
          }
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        if (user) {
          const isWechatTemp = user.username && user.username.startsWith('wx_');
          const values = {
            username: isWechatTemp ? '' : user.username,
            nickname: user.nickname || '',
          };
          setInitialValues(values);
          setCurrentUser(user);
          setCurrentFormValues(values);
          profileForm.setFieldsValue(values);
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchUserInfo();
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      const response = await updateProfile(values);
      if (response.success) {
        message.success('资料更新成功');
        
        const updatedUser = response.data.user;
        setCurrentUser(updatedUser);
        
        const newInitialValues = {
          username: updatedUser.username,
          nickname: updatedUser.nickname || '',
        };
        setInitialValues(newInitialValues);
        setCurrentFormValues(newInitialValues);
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        
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

  const handleSetPassword = async (values) => {
    setPasswordLoading(true);
    try {
      const response = await setPassword(values.newPassword);
      if (response.success) {
        message.success('密码设置成功');
        passwordForm.resetFields();
        // 刷新用户信息
        const tokenResponse = await validateToken();
        if (tokenResponse.success && tokenResponse.data) {
          const userData = tokenResponse.data.user || tokenResponse.data;
          setCurrentUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } else {
        message.error(response.message || '密码设置失败');
      }
    } catch (error) {
      message.error('密码设置失败，请稍后重试');
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

  const handleFormValuesChange = (changedValues, allValues) => {
    setCurrentFormValues(allValues);
  };

  const hasFormChanged = () => {
    return (
      currentFormValues.username !== initialValues.username ||
      (currentFormValues.nickname || '') !== (initialValues.nickname || '')
    );
  };

  // 判断是否是微信临时用户（未绑定账号）
  const isWechatTempUser = () => {
    return currentUser && currentUser.username && currentUser.username.startsWith('wx_');
  };

  // 判断是否有微信信息
  const hasWechatInfo = () => {
    return currentUser && currentUser.wechatOpenid;
  };

  // 判断是否已设置密码
  const hasPassword = () => {
    return currentUser && currentUser.hasPassword;
  };

  const shouldDisableNickname = () => {
    if (!currentUser) return false;
    return currentUser.username && currentUser.username.startsWith('wx_');
  };

  const shouldDisableUsername = () => {
    if (!currentUser) return false;
    return Boolean(currentUser.wechatAvatar) && currentUser.username && !currentUser.username.startsWith('wx_');
  };

  // 处理绑定账号（创建新账号或绑定已有账号）
  const handleBindAccount = async (values) => {
    setBindAccountLoading(true);
    try {
      let response;
      
      if (bindMode === 'create') {
        // 创建新账号
        response = await createAccountForWechat(values.username);
      } else {
        // 绑定已有账号
        response = await bindWechatToAccount(values.username, values.password);
      }
      
      if (response.success) {
        message.success(bindMode === 'create' ? '账号创建成功！' : '账号绑定成功！');
        
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
          setCurrentUser(response.data.user);
          window.dispatchEvent(new CustomEvent('userUpdated', { detail: response.data.user }));
        }
        
        setBindAccountModalVisible(false);
        bindAccountForm.resetFields();
        
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('绑定账号失败:', error);
      message.error('操作失败，请稍后重试');
    } finally {
      setBindAccountLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="user-profile-container">
        <div className="user-profile-content" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px' 
        }}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

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
              tooltip={shouldDisableNickname() ? "微信临时账号的昵称来自微信，请先绑定账号后修改" : ""}
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
                  onClick={() => {
                    const currentUsername = profileForm.getFieldValue('username');
                    bindAccountForm.setFieldsValue({ username: currentUsername || '' });
                    setBindMode('create');
                    setBindAccountModalVisible(true);
                  }}
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

        {/* 密码设置/修改 */}
        {!isWechatTempUser() && (
          <Card title={hasPassword() ? "修改密码" : "设置密码"} className="profile-card">
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={hasPassword() ? handleUpdatePassword : handleSetPassword}
            >
              {hasPassword() && (
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
              )}

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
                  {hasPassword() ? "更新密码" : "设置密码"}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        )}

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

        <Card title="机构管理" className="profile-card">
          <div className="account-info-compact">
            <div className="info-row">
              <span className="info-label">当前机构:</span>
              <span className="info-value">
                {currentUser?.organizationName || user?.organizationName || '未绑定机构'}
              </span>
            </div>
            <div style={{ marginTop: '16px' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  // 保存当前微信用户信息到sessionStorage
                  if (user?.wechatOpenid) {
                    const wechatUserInfo = {
                      openid: user.wechatOpenid,
                      unionid: user.wechatUnionid,
                      nickname: user.nickname || user.wechatNickname,
                      headimgurl: user.wechatAvatar,
                      sex: user.wechatSex,
                      province: user.wechatProvince,
                      city: user.wechatCity,
                      country: user.wechatCountry
                    };
                    sessionStorage.setItem('wechatUserInfo', JSON.stringify(wechatUserInfo));
                  }
                  navigate('/select-organization');
                }}
                block
              >
                申请加入其他机构
              </Button>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                申请加入其他机构后，下次登录可选择要进入的机构
              </div>
            </div>
          </div>
        </Card>

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
      
      <Footer />

      {/* 绑定账号模态框 */}
      <Modal
        title="绑定账号"
        open={bindAccountModalVisible}
        onCancel={() => {
          setBindAccountModalVisible(false);
          bindAccountForm.resetFields();
        }}
        footer={null}
        width={450}
      >
        <div style={{ marginBottom: '20px' }}>
          <Radio.Group 
            value={bindMode} 
            onChange={(e) => {
              setBindMode(e.target.value);
              bindAccountForm.resetFields(['password']);
            }}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="create" style={{ width: '100%', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px', background: bindMode === 'create' ? '#f0f5ff' : 'white' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>创建新账号</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>使用输入的用户名创建新账号</div>
                </div>
              </Radio>
              <Radio value="bind" style={{ width: '100%', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px', background: bindMode === 'bind' ? '#f0f5ff' : 'white' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>绑定已有账号</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>将微信绑定到已有的课表账号</div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        <Form
          form={bindAccountForm}
          layout="vertical"
          onFinish={handleBindAccount}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 20, message: '用户名最多20个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
            />
          </Form.Item>

          {bindMode === 'bind' && (
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
          )}

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
              确认{bindMode === 'create' ? '创建' : '绑定'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserProfile;
