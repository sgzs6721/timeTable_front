import React, { useState, useEffect } from 'react';
import { 
  Table, Button, message, Modal, Input, Tag, Card, 
  Space, Avatar, Descriptions, Select, Form 
} from 'antd';
import { 
  CheckOutlined, CloseOutlined, EyeOutlined,
  ReloadOutlined, UserOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './OrganizationRequestManagement.css';

const { TextArea } = Input;
const { Option } = Select;

/**
 * 机构申请管理页面（管理员）
 */
const OrganizationRequestManagement = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveForm] = Form.useForm();

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_BASE_URL}/organization-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setRequests(response.data.data || []);
      } else {
        message.error('获取申请列表失败');
      }
    } catch (error) {
      console.error('获取申请列表失败:', error);
      message.error(error.response?.data?.message || '获取申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (record) => {
    setSelectedRequest(record);
    approveForm.resetFields();
    setApproveModalVisible(true);
  };

  const handleReject = (record) => {
    setSelectedRequest(record);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedRequest(record);
    setDetailModalVisible(true);
  };

  const confirmApprove = async () => {
    try {
      const values = await approveForm.validateFields();
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/organization-requests/approve`,
        {
          requestId: selectedRequest.id,
          approved: true,
          defaultRole: values.defaultRole || 'USER',
          defaultPosition: values.defaultPosition || 'COACH'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        message.success('申请已批准');
        setApproveModalVisible(false);
        fetchPendingRequests();
      } else {
        message.error(response.data.message || '批准失败');
      }
    } catch (error) {
      console.error('批准失败:', error);
      message.error(error.response?.data?.message || '批准失败');
    }
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('请填写拒绝理由');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/organization-requests/approve`,
        {
          requestId: selectedRequest.id,
          approved: false,
          rejectReason: rejectReason.trim()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        message.success('申请已拒绝');
        setRejectModalVisible(false);
        fetchPendingRequests();
      } else {
        message.error(response.data.message || '拒绝失败');
      }
    } catch (error) {
      console.error('拒绝失败:', error);
      message.error(error.response?.data?.message || '拒绝失败');
    }
  };

  const renderRequestCard = (request) => (
    <Card 
      key={request.id}
      className="request-card"
      hoverable
    >
      <div className="request-card-content">
        <div className="request-info">
          <Avatar 
            src={request.wechatAvatar} 
            icon={<UserOutlined />}
            size={48}
          />
          <div className="request-details">
            <div className="request-name">{request.wechatNickname || '未知用户'}</div>
            <div className="request-meta">
              <span className="request-time">
                {new Date(request.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="request-org">{request.organizationName}</div>
          </div>
        </div>
        
        <div className="request-actions">
          <Tag color="gold">待审批</Tag>
          <Space size="small">
            <Button
              size="small"
              icon={<CheckOutlined />}
              type="primary"
              onClick={() => handleApprove(request)}
            >
              通过
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => handleReject(request)}
            >
              拒绝
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="organization-request-management">
      {loading ? (
        <div className="loading-container">
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
            <ReloadOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
            <div>加载中...</div>
          </Space>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-container">
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
            <div style={{ fontSize: 48, color: '#d9d9d9' }}>📋</div>
            <div style={{ color: '#999' }}>暂无待审批申请</div>
          </Space>
        </div>
      ) : (
        <>
          <div className="requests-grid">
            {requests.map(request => renderRequestCard(request))}
          </div>
          <div className="requests-footer">
            共 {requests.length} 条申请
          </div>
        </>
      )}

      {/* 查看详情Modal */}
      <Modal
        title="申请详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="approve" 
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              handleApprove(selectedRequest);
            }}
          >
            批准
          </Button>,
          <Button 
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              handleReject(selectedRequest);
            }}
          >
            拒绝
          </Button>,
        ]}
      >
        {selectedRequest && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="申请人">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar src={selectedRequest.wechatAvatar} icon={<UserOutlined />} />
                <span>{selectedRequest.wechatNickname}</span>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="性别">
              {selectedRequest.wechatSex === 1 ? '男' : 
               selectedRequest.wechatSex === 2 ? '女' : '未知'}
            </Descriptions.Item>
            <Descriptions.Item label="申请机构">
              {selectedRequest.organizationName}
            </Descriptions.Item>
            <Descriptions.Item label="机构地址">
              {selectedRequest.organizationAddress || '暂无'}
            </Descriptions.Item>
            <Descriptions.Item label="申请理由">
              {selectedRequest.applyReason || '无'}
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {new Date(selectedRequest.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 批准Modal */}
      <Modal
        title="批准申请"
        open={approveModalVisible}
        onOk={confirmApprove}
        onCancel={() => setApproveModalVisible(false)}
        okText="确认批准"
        cancelText="取消"
      >
        {selectedRequest && (
          <>
            <p>确认批准 <strong>{selectedRequest.wechatNickname}</strong> 加入 <strong>{selectedRequest.organizationName}</strong> 吗？</p>
            
            <Form form={approveForm} layout="vertical">
              <Form.Item 
                label="默认角色" 
                name="defaultRole"
                initialValue="USER"
              >
                <Select>
                  <Option value="USER">普通用户</Option>
                  <Option value="ADMIN">管理员</Option>
                </Select>
              </Form.Item>

              <Form.Item 
                label="默认职位" 
                name="defaultPosition"
                initialValue="COACH"
              >
                <Select>
                  <Option value="COACH">教练</Option>
                  <Option value="SALES">销售</Option>
                  <Option value="RECEPTIONIST">前台</Option>
                </Select>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* 拒绝Modal */}
      <Modal
        title="拒绝申请"
        open={rejectModalVisible}
        onOk={confirmReject}
        onCancel={() => setRejectModalVisible(false)}
        okText="确认拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {selectedRequest && (
          <>
            <p>确认拒绝 <strong>{selectedRequest.wechatNickname}</strong> 的申请吗？</p>
            <TextArea
              placeholder="请填写拒绝理由（必填）"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              style={{ marginTop: 16 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default OrganizationRequestManagement;

