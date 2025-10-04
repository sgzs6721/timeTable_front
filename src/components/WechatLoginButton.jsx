import React, { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { getWechatAuthUrl } from '../services/auth';

const WechatLoginButton = ({ onLogin, size = 'middle' }) => {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    // 获取微信授权URL
    const fetchAuthUrl = async () => {
      try {
        const response = await getWechatAuthUrl();
        if (response.success) {
          setAuthUrl(response.data.authUrl);
        }
      } catch (error) {
        console.error('获取微信授权URL失败:', error);
      }
    };

    fetchAuthUrl();

    // 监听来自微信授权回调页面的消息
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'wechat_login_success') {
        const { token, user, isNewUser } = event.data;
        localStorage.setItem('token', token);
        onLogin(user);
        message.success(isNewUser ? '微信登录成功，欢迎新用户！' : '微信登录成功');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onLogin]);

  const handleWechatAuth = () => {
    if (authUrl) {
      // 在新窗口中打开微信授权页面
      const popup = window.open(authUrl, 'wechat_auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
      
      // 监听弹窗关闭事件
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
        }
      }, 1000);
    } else {
      message.error('获取微信授权URL失败');
    }
  };

  return (
    <Button
      type="default"
      icon={<WechatOutlined />}
      onClick={handleWechatAuth}
      loading={loading}
      size={size}
      className="wechat-login-btn"
      style={{
        marginRight: '8px'
      }}
    >
      微信登录
    </Button>
  );
};

export default WechatLoginButton;
