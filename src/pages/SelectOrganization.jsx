import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input, Button, message, Form } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './SelectOrganization.css';

/**
 * 机构代码输入页面
 * 用于微信登录后新用户输入机构代码申请加入
 */
const SelectOrganization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [wechatUserInfo, setWechatUserInfo] = useState(null);
  const [form] = Form.useForm();

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
  }, [location.state, navigate]);

  const handleSubmitCode = async (values) => {
    try {
      setSubmitting(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/wechat/apply-by-code`, {
        organizationCode: values.organizationCode.trim(),
        wechatUserInfo
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // 如果直接加入成功（没有管理员，成为管理员）
        if (data.token && data.user) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          sessionStorage.removeItem('wechatUserInfo');
          
          message.success(response.data.message || '加入机构成功！');
          
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 500);
        } else {
          // 提交申请成功，跳转到申请状态页面
          message.success(response.data.message || '申请已提交！');
          
          setTimeout(() => {
            navigate('/application-status', {
              state: {
                requestInfo: data,
                wechatUserInfo
              }
            });
          }, 1000);
        }
      } else {
        message.error(response.data.message || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      message.error(error.response?.data?.message || '提交失败，请检查机构代码是否正确');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="select-organization-container">
      <div className="select-organization-header">
        <h1>欢迎进入课表管理系统</h1>
        <p className="welcome-text">
          请输入要申请的机构代码
        </p>
      </div>

      <div className="organization-form-wrapper">
        <Form
          form={form}
          onFinish={handleSubmitCode}
          layout="vertical"
          className="organization-form"
        >
          <Form.Item
            name="organizationCode"
            label="机构代码"
            rules={[
              { required: true, message: '请输入机构代码' },
              { pattern: /^[A-Za-z0-9_-]+$/, message: '机构代码只能包含字母、数字、下划线和横线' }
            ]}
          >
            <Input
              size="large"
              placeholder="请输入机构代码"
              maxLength={50}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              size="large"
              block
              htmlType="submit"
              loading={submitting}
              className="submit-button"
            >
              提交
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              size="large"
              block
              onClick={() => navigate(-1)}
              className="back-button"
            >
              返回
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default SelectOrganization;

