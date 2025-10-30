import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Result, Button, Card, Descriptions } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  HomeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  PlusOutlined
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
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
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
              <Descriptions key="info" column={1} bordered className="status-descriptions">
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
              </Descriptions>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  onClick={() => window.location.reload()}
                  block
                >
                  刷新状态
                </Button>
                <Button 
                  onClick={() => navigate('/select-organization', {
                    state: { wechatUserInfo }
                  })}
                  block
                >
                  申请其他机构
                </Button>
                <Button 
                  onClick={() => navigate('/login')}
                  block
                >
                  返回登录
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
              <Descriptions key="info" column={1} bordered className="status-descriptions">
                <Descriptions.Item label="所属机构">
                  {requestInfo?.organizationName}
                </Descriptions.Item>
                <Descriptions.Item label="审批时间">
                  {new Date(requestInfo?.approvedAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
                <Descriptions.Item label="审批人">
                  {requestInfo?.approvedByUsername || '管理员'}
                </Descriptions.Item>
              </Descriptions>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  size="large"
                  onClick={() => navigate('/dashboard')}
                  block
                >
                  进入系统
                </Button>
                <Button 
                  onClick={() => navigate('/login')}
                  block
                >
                  返回登录
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
              <Descriptions key="info" column={1} bordered className="status-descriptions">
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
              </Descriptions>,
              <div key="actions" className="action-buttons">
                <Button 
                  type="primary" 
                  size="large"
                  onClick={() => navigate('/select-organization', {
                    state: { wechatUserInfo }
                  })}
                  block
                >
                  重新申请
                </Button>
                <Button 
                  onClick={() => navigate('/login')}
                  block
                >
                  返回登录
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

  // 加载中时不渲染内容，避免闪现"状态未知"
  if (loading) {
    return null;
  }

  return (
    <div className="application-status-container">
      <div className="status-content">
        {renderStatusContent()}
      </div>
    </div>
  );
};

export default ApplicationStatus;

