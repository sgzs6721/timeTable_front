import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Result, Button, Card, Descriptions } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  HomeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import './ApplicationStatus.css';

/**
 * 申请状态页面
 * 显示用户的机构申请状态（待审批、已批准、已拒绝）
 */
const ApplicationStatus = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [requestInfo, setRequestInfo] = useState(null);
  const [wechatUserInfo, setWechatUserInfo] = useState(null);

  useEffect(() => {
    // 优先从location.state获取，否则从sessionStorage获取
    let reqInfo = location.state?.requestInfo;
    let userInfo = location.state?.wechatUserInfo;
    
    if (!reqInfo) {
      const sessionData = sessionStorage.getItem('requestInfo');
      if (sessionData) {
        try {
          reqInfo = JSON.parse(sessionData);
        } catch (e) {
          console.error('解析requestInfo失败:', e);
        }
      }
    }
    
    if (!userInfo) {
      const sessionData = sessionStorage.getItem('wechatUserInfo');
      if (sessionData) {
        try {
          userInfo = JSON.parse(sessionData);
        } catch (e) {
          console.error('解析wechatUserInfo失败:', e);
        }
      }
    }

    if (!reqInfo) {
      navigate('/login');
      return;
    }

    setRequestInfo(reqInfo);
    setWechatUserInfo(userInfo);
  }, [location.state, navigate]);

  const renderStatusContent = () => {
    const status = requestInfo?.status;

    switch (status) {
      case 'PENDING':
        return (
          <Result
            icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            title="申请审核中"
            subTitle={`您已成功提交加入 ${requestInfo?.organizationName || '机构'} 的申请，请耐心等待管理员审批`}
            extra={[
              <Card key="info" className="status-info-card">
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="申请机构">
                    {requestInfo?.organizationName}
                  </Descriptions.Item>
                  <Descriptions.Item label="机构地址">
                    {requestInfo?.organizationAddress || '暂无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="申请时间">
                    {new Date(requestInfo?.createdAt).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前状态">
                    <span className="status-tag status-pending">待审批</span>
                  </Descriptions.Item>
                </Descriptions>
              </Card>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.reload()}
                >
                  刷新状态
                </Button>
              </div>
            ]}
          />
        );

      case 'APPROVED':
        return (
          <Result
            status="success"
            title="申请已通过"
            subTitle={`恭喜！您已成功加入 ${requestInfo?.organizationName || '机构'}，现在可以开始使用系统了`}
            extra={[
              <Card key="info" className="status-info-card">
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="所属机构">
                    {requestInfo?.organizationName}
                  </Descriptions.Item>
                  <Descriptions.Item label="审批时间">
                    {new Date(requestInfo?.approvedAt).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="审批人">
                    {requestInfo?.approvedByUsername || '管理员'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  size="large"
                  icon={<HomeOutlined />}
                  onClick={() => navigate('/dashboard')}
                >
                  进入系统
                </Button>
              </div>
            ]}
          />
        );

      case 'REJECTED':
        return (
          <Result
            status="error"
            title="申请被拒绝"
            subTitle={`很抱歉，您加入 ${requestInfo?.organizationName || '机构'} 的申请未通过审核`}
            extra={[
              <Card key="info" className="status-info-card">
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="申请机构">
                    {requestInfo?.organizationName}
                  </Descriptions.Item>
                  <Descriptions.Item label="拒绝理由">
                    <span className="reject-reason">
                      {requestInfo?.rejectReason || '未提供拒绝理由'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="审批时间">
                    {new Date(requestInfo?.approvedAt).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                  <Descriptions.Item label="审批人">
                    {requestInfo?.approvedByUsername || '管理员'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  size="large"
                  onClick={() => navigate('/select-organization', {
                    state: { wechatUserInfo }
                  })}
                >
                  重新申请
                </Button>
              </div>
            ]}
          />
        );

      default:
        return (
          <Result
            status="warning"
            title="状态未知"
            subTitle="申请状态异常，请联系管理员"
            extra={[
              <Button 
                key="back"
                type="primary"
                onClick={() => navigate('/login')}
              >
                返回登录
              </Button>
            ]}
          />
        );
    }
  };

  return (
    <div className="application-status-container">
      <div className="status-content">
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/login')}
          className="status-back-button"
        >
          返回登录
        </Button>
        {renderStatusContent()}
      </div>
    </div>
  );
};

export default ApplicationStatus;

