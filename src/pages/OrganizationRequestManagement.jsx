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

  const columns = [
    {
      title: '申请人',
      dataIndex: 'wechatNickname',
      key: 'wechatNickname',
      render: (text, record) => (
        <div className="applicant-info">
          <Avatar 
            src={record.wechatAvatar} 
            icon={<UserOutlined />}
            size={40}
          />
          <div className="applicant-details">
            <div className="applicant-name">{text || '未知用户'}</div>
            <div className="applicant-sex">
              {record.wechatSex === 1 ? '男' : record.wechatSex === 2 ? '女' : '未知'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '申请机构',
      dataIndex: 'organizationName',
      key: 'organizationName',
    },
    {
      title: '机构地址',
      dataIndex: 'organizationAddress',
      key: 'organizationAddress',
      ellipsis: true,
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          'PENDING': { color: 'gold', text: '待审批' },
          'APPROVED': { color: 'green', text: '已批准' },
          'REJECTED': { color: 'red', text: '已拒绝' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
            style={{ color: '#52c41a' }}
          >
            通过
          </Button>
          <Button
            type="link"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReject(record)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="organization-request-management">
      <Card>
        <div className="page-header">
          <h2>机构申请管理</h2>
          <Button 
            icon={<ReloadOutlined />}
            onClick={fetchPendingRequests}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条申请`,
          }}
        />
      </Card>

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

