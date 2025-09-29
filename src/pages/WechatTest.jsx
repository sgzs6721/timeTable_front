import React, { useState, useEffect } from 'react';
import { Button, Card, message, Input, Space, Typography } from 'antd';
import { WechatOutlined } from '@ant-design/icons';
import { wechatLogin, getWechatAuthUrl } from '../services/auth';

const { Title, Text } = Typography;

const WechatTest = () => {
  const [authUrl, setAuthUrl] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // 获取微信授权URL
    const fetchAuthUrl = async () => {
      try {
        const response = await getWechatAuthUrl();
        if (response.success) {
          setAuthUrl(response.data.authUrl);
        } else {
          message.error('获取微信授权URL失败: ' + response.message);
        }
      } catch (error) {
        message.error('获取微信授权URL失败: ' + error.message);
      }
    };

    fetchAuthUrl();
  }, []);

  const handleWechatLogin = async () => {
    if (!code.trim()) {
      message.error('请输入授权码');
      return;
    }

    setLoading(true);
    try {
      const response = await wechatLogin(code);
      setResult(response);
      if (response.success) {
        message.success('微信登录成功');
      } else {
        message.error('微信登录失败: ' + response.message);
      }
    } catch (error) {
      message.error('微信登录失败: ' + error.message);
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWechat = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    } else {
      message.error('授权URL未获取到');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <WechatOutlined /> 微信登录测试
        </Title>
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>1. 获取微信授权URL</Title>
            <Text code>{authUrl || '正在获取...'}</Text>
            <br />
            <Button 
              type="primary" 
              onClick={handleOpenWechat}
              disabled={!authUrl}
              style={{ marginTop: '10px' }}
            >
              打开微信授权页面
            </Button>
          </div>

          <div>
            <Title level={4}>2. 测试微信登录</Title>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="请输入从微信授权页面获取的code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button 
                type="primary" 
                onClick={handleWechatLogin}
                loading={loading}
              >
                测试登录
              </Button>
            </Space.Compact>
          </div>

          {result && (
            <div>
              <Title level={4}>3. 登录结果</Title>
              <Card size="small">
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </Card>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default WechatTest;
