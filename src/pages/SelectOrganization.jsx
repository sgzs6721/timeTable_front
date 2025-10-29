import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, message, Spin, Empty } from 'antd';
import { EnvironmentOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './SelectOrganization.css';

/**
 * 机构选择页面
 * 用于微信登录后新用户选择要申请加入的机构
 */
const SelectOrganization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wechatUserInfo, setWechatUserInfo] = useState(null);

  useEffect(() => {
    // 优先从location.state获取，否则从sessionStorage获取
    let userInfo = location.state?.wechatUserInfo;
    if (!userInfo) {
      const sessionData = sessionStorage.getItem('wechatUserInfo');
      if (sessionData) {
        try {
          userInfo = JSON.parse(sessionData);
        } catch (e) {
          console.error('解析sessionStorage数据失败:', e);
        }
      }
    }

    if (!userInfo) {
      message.error('缺少必要的用户信息');
      navigate('/login');
      return;
    }

    setWechatUserInfo(userInfo);
    fetchOrganizations();
  }, [location.state, navigate]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/organizations/active`);
      
      if (response.data.success) {
        setOrganizations(response.data.data || []);
      } else {
        message.error('获取机构列表失败');
      }
    } catch (error) {
      console.error('获取机构列表失败:', error);
      message.error('获取机构列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (organizationId) => {
    try {
      setSubmitting(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/wechat/select-organization`, {
        organizationId,
        wechatUserInfo
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        sessionStorage.removeItem('wechatUserInfo');
        
        message.success('加入机构成功！');
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        message.error(response.data.message || '加入机构失败');
      }
    } catch (error) {
      console.error('加入机构失败:', error);
      message.error(error.response?.data?.message || '加入机构失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="select-organization-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="select-organization-container">
      <div className="select-organization-header">
        <h1>选择机构</h1>
        <p className="welcome-text">
          欢迎，{wechatUserInfo?.nickname}！请选择您的机构
        </p>
      </div>

      <div className="organizations-list">
        {organizations.length === 0 ? (
          <Empty description="暂无可选机构" />
        ) : (
          organizations.map(org => (
            <Card
              key={org.id}
              className="organization-card"
              hoverable
            >
              <div className="org-info">
                <h2 className="org-name">{org.name}</h2>
                
                {org.address && (
                  <div className="org-detail">
                    <EnvironmentOutlined className="org-icon" />
                    <span>{org.address}</span>
                  </div>
                )}
                
                {org.contactPhone && (
                  <div className="org-detail">
                    <PhoneOutlined className="org-icon" />
                    <span>{org.contactPhone}</span>
                  </div>
                )}
                
                {org.contactPerson && (
                  <div className="org-detail">
                    <UserOutlined className="org-icon" />
                    <span>负责人：{org.contactPerson}</span>
                  </div>
                )}
              </div>

              <Button
                type="primary"
                size="large"
                block
                loading={submitting}
                onClick={() => handleSelectOrganization(org.id)}
                className="apply-button"
              >
                确定
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SelectOrganization;

