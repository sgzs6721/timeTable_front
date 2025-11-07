import React, { useState, useEffect } from 'react';
import { 
  Table, Button, message, Modal, Input, Tag, Card, 
  Space, Avatar, Descriptions, Select, Form, Spin 
} from 'antd';
import { 
  CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import './OrganizationRequestManagement.css';

const { TextArea } = Input;
const { Option } = Select;

/**
 * 机构申请管理页面（管理员）
 */
const OrganizationRequestManagement = ({ onUpdate }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveForm] = Form.useForm();
  const [hasManagerInOrg, setHasManagerInOrg] = useState(false);
  const [checkingManager, setCheckingManager] = useState(false);

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
        const allRequests = response.data.data || [];
        
        // 排序：未审核的在前面，然后按时间倒序
        const sortedRequests = allRequests.sort((a, b) => {
          // 先按状态排序，PENDING在前
          if (a.status === 'PENDING' && b.status !== 'PENDING') {
            return -1;
          }
          if (a.status !== 'PENDING' && b.status === 'PENDING') {
            return 1;
          }
          
          // 同一状态内按时间倒序（最新的在前）
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        setRequests(sortedRequests);
        // 通知父组件更新数量
        if (onUpdate) {
          onUpdate();
        }
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

  const handleApprove = async (record) => {
    setSelectedRequest(record);
    approveForm.resetFields();
    setApproveModalVisible(true);
    
    // 检查机构是否已有管理职位成员
    await checkOrganizationManager(record.organizationId);
  };
  
  const checkOrganizationManager = async (organizationId) => {
    try {
      setCheckingManager(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const users = response.data.data || [];
        // 检查该机构是否有MANAGER职位的用户
        const hasManager = users.some(user => 
          user.organizationId === organizationId && 
          user.position === 'MANAGER' &&
          user.status === 'APPROVED'
        );
        setHasManagerInOrg(hasManager);
        
        // 如果没有管理职位成员，默认设置为MANAGER
        if (!hasManager) {
          approveForm.setFieldsValue({ defaultPosition: 'MANAGER' });
        } else {
          approveForm.setFieldsValue({ defaultPosition: 'COACH' });
        }
      }
    } catch (error) {
      console.error('检查机构管理职位失败:', error);
    } finally {
      setCheckingManager(false);
    }
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
      let defaultPosition = 'COACH';
      
      // 如果机构没有管理职位成员，自动设置为MANAGER
      if (!hasManagerInOrg) {
        defaultPosition = 'MANAGER';
      } else {
        // 如果有管理职位成员，从表单获取选择的职位
        const values = await approveForm.validateFields();
        defaultPosition = values.defaultPosition || 'COACH';
      }
      
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/organization-requests/approve`,
        {
          requestId: selectedRequest.id,
          approved: true,
          defaultRole: 'USER',
          defaultPosition: defaultPosition
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

  const renderRequestCard = (request) => {
    // 判断是否为普通注册申请（ID为负数）
    const isNormalRegistration = request.id < 0;
    const isPending = request.status === 'PENDING';
    const isApproved = request.status === 'APPROVED';
    const isRejected = request.status === 'REJECTED';
    
    return (
      <Card 
        key={request.id}
        className="request-card"
        hoverable
        style={isApproved ? { borderColor: '#52c41a' } : isRejected ? { borderColor: '#ff4d4f' } : {}}
      >
        <div className="request-card-content">
          <div className="request-info">
            <Avatar 
              src={request.wechatAvatar} 
              icon={<UserOutlined />}
              size={48}
              style={isNormalRegistration ? { backgroundColor: '#87d068' } : {}}
            />
            <div className="request-details">
              <div className="request-name">
                {request.wechatNickname || '未知用户'}
                {isNormalRegistration && request.applyReason && request.applyReason.includes('用户名') && (
                  <span style={{ 
                    marginLeft: '12px', 
                    fontSize: '14px', 
                    color: '#666',
                    fontWeight: 'normal'
                  }}>
                    {request.applyReason.split('，').find(part => part.includes('用户名'))}
                  </span>
                )}
              </div>
              <div className="request-meta">
                {isNormalRegistration ? (
                  <Tag color="green">普通注册</Tag>
                ) : request.wechatAvatar && (
                  <Tag color="blue">微信用户</Tag>
                )}
                <span className="request-time">
                  {new Date(request.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div style={{ 
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '12px', color: '#666' }}>申请加入</span>
                {request.organizationName && (
                  <Tag color="purple">{request.organizationName}</Tag>
                )}
              </div>
              {isRejected && request.rejectReason && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#ff4d4f', 
                  marginTop: '4px',
                  maxWidth: '400px'
                }}>
                  拒绝理由：{request.rejectReason}
                </div>
              )}
            </div>
          </div>
          
          <div className="request-actions">
            {isPending && <Tag color="gold">待审批</Tag>}
            {isApproved && <Tag color="green">已批准</Tag>}
            {isRejected && <Tag color="red">已拒绝</Tag>}
            
            {isPending && (
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
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="organization-request-management">
      {loading ? (
        <div className="loading-container">
          <Spin tip="加载中..." />
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-container">
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '40px 0' }}>
            <div style={{ fontSize: 48, color: '#d9d9d9' }}>📋</div>
            <div style={{ color: '#999' }}>暂无申请记录</div>
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
            
            {checkingManager ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="检查机构职位信息..." />
              </div>
            ) : (
              <Form form={approveForm} layout="vertical">
                {!hasManagerInOrg ? (
                  <div style={{ 
                    padding: '12px', 
                    background: '#e6f7ff', 
                    border: '1px solid #91d5ff',
                    borderRadius: '4px',
                    marginBottom: '16px'
                  }}>
                    <p style={{ margin: 0, color: '#1890ff' }}>
                      该机构暂无管理职位成员，将自动设置为<strong>管理职位</strong>
                    </p>
                  </div>
                ) : (
                  <Form.Item 
                    label="职位" 
                    name="defaultPosition"
                    initialValue="COACH"
                    rules={[{ required: true, message: '请选择职位' }]}
                  >
                    <Select>
                      <Option value="COACH">教练</Option>
                      <Option value="SALES">销售</Option>
                      <Option value="RECEPTIONIST">前台</Option>
                      <Option value="MANAGER">管理</Option>
                    </Select>
                  </Form.Item>
                )}
              </Form>
            )}
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

