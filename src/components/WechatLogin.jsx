import React, { useState, useEffect } from 'react';
import { Button, message, Spin } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { wechatLogin, getWechatAuthUrl } from '../services/auth';

const WechatLogin = ({ onLogin, disabled = false }) => {
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

  // 检查URL参数中是否有微信授权码
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state === 'timetable_wechat_login') {
      handleWechatLogin(code);
    }
  }, []);

  const handleWechatLogin = async (code) => {
    setLoading(true);
    try {
      const response = await wechatLogin(code);
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        onLogin(response.data.user);
        message.success('微信登录成功');
        
        // 清除URL参数
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        message.error(response.message || '微信登录失败');
      }
    } catch (error) {
      message.error('微信登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

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
    <div style={{ textAlign: 'center' }}>
      <Button
        type="default"
        icon={<WechatOutlined />}
        onClick={handleWechatAuth}
        loading={loading}
        disabled={disabled}
        size="large"
        className="wechat-login-btn"
        style={{
          height: '45px',
          width: '100%',
          backgroundColor: disabled ? '#d9d9d9' : '#07c160',
          borderColor: disabled ? '#bfbfbf' : '#07c160',
          fontSize: '16px',
          color: disabled ? 'rgba(0, 0, 0, 0.45)' : '#ffffff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1
        }}
      >
        微信登录
      </Button>
    </div>
  );
};

export default WechatLogin;
