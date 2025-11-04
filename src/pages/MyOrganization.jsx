import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Modal, Form, Input, message, Tag, 
  Card, Spin
} from 'antd';
import {
  EditOutlined, EyeOutlined, SettingOutlined, 
  UsergroupAddOutlined, DollarOutlined, LeftOutlined
} from '@ant-design/icons';
import {
  getOrganizationById,
  updateOrganization
} from '../services/organization';
import './OrganizationManagement.css';

const MyOrganization = ({ user }) => {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user?.organizationId) {
      fetchOrganization();
    }
  }, [user]);

  const fetchOrganization = async () => {
    if (!user?.organizationId) {
      message.error('未找到所属机构');
      return;
    }

    try {
      setLoading(true);
      const response = await getOrganizationById(user.organizationId);
      if (response.success) {
        setOrganization(response.data);
      } else {
        message.error('获取机构信息失败');
      }
    } catch (error) {
      console.error('获取机构信息失败:', error);
      message.error(error.response?.data?.message || '获取机构信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    form.setFieldsValue(organization);
    setModalVisible(true);
  };

  const handleViewDetail = () => {
    setDetailModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const loadingMsg = message.loading('正在更新机构...', 0);
      
      const response = await updateOrganization(organization.id, values);

      loadingMsg();

      if (response.success) {
        message.success('✓ 更新机构成功');
        setModalVisible(false);
        form.resetFields();
        await fetchOrganization();
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const renderOrganizationCard = (org) => (
    <Card className="org-card">
      <div className="org-card-header">
        <div className="org-card-title">
          <h3>{org.name}</h3>
          <Tag color={org.status === 'ACTIVE' ? 'success' : 'default'}>
            {org.status === 'ACTIVE' ? '启用' : '停用'}
          </Tag>
        </div>
        <div className="org-card-meta">
          <span className="org-card-id">ID: {org.id}</span>
          <span className="org-card-code">代码: {org.code}</span>
        </div>
      </div>

      <div className="org-card-actions" onClick={(e) => e.stopPropagation()}>
        <Button
          icon={<UsergroupAddOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/organizations/${org.id}/roles`);
          }}
          className="action-btn role-btn"
        >
          角色管理
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/organizations/${org.id}/permissions`);
          }}
          className="action-btn settings-btn"
        >
          权限设置
        </Button>
        <Button
          icon={<DollarOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/organizations/${org.id}/salary`);
          }}
          className="action-btn salary-btn"
        >
          工资管理
        </Button>
        <Button
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleEdit();
          }}
          className="action-btn edit-btn"
        >
          编辑
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="organization-management">
      <div className="org-tabs">
        <div className="page-header" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Button
            onClick={() => navigate(-1)}
            icon={<LeftOutlined />}
            shape="circle"
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1
            }}
          />
          <div className="header-left">
            <h2>我的机构</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : !organization ? (
          <div className="empty-container">
            <div className="empty-icon">📋</div>
            <h3>未找到机构信息</h3>
            <p>您可能尚未加入任何机构</p>
          </div>
        ) : (
          <div className="org-cards-container">
            {renderOrganizationCard(organization)}
          </div>
        )}
      </div>

      {/* 查看详情Modal */}
      <Modal
        title="机构详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              handleEdit();
            }}
          >
            编辑
          </Button>
        ]}
        width={600}
      >
        {organization && (
          <div className="org-detail-content">
            <div className="detail-item">
              <label>机构名称：</label>
              <span>{organization.name}</span>
            </div>
            <div className="detail-item">
              <label>机构代码：</label>
              <span>{organization.code}</span>
            </div>
            <div className="detail-item">
              <label>详细地址：</label>
              <span>{organization.address || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>联系电话：</label>
              <span>{organization.contactPhone || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>负责人：</label>
              <span>{organization.contactPerson || '暂无'}</span>
            </div>
            <div className="detail-item">
              <label>状态：</label>
              <span>
                <Tag color={organization.status === 'ACTIVE' ? 'green' : 'red'} style={{ marginRight: 0 }}>
                  {organization.status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
              </span>
            </div>
            <div className="detail-item">
              <label>创建时间：</label>
              <span>{new Date(organization.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑机构Modal */}
      <Modal
        title="编辑机构"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="机构名称"
            name="name"
            rules={[{ required: true, message: '请输入机构名称' }]}
          >
            <Input placeholder="请输入机构名称" />
          </Form.Item>

          <Form.Item
            label="机构代码"
            name="code"
            rules={[
              { required: true, message: '请输入机构代码' },
              { pattern: /^[A-Z0-9_]+$/, message: '机构代码只能包含大写字母、数字和下划线' }
            ]}
          >
            <Input placeholder="例如：ORG_ZGC" disabled />
          </Form.Item>

          <Form.Item
            label="详细地址"
            name="address"
          >
            <Input placeholder="请输入详细地址" />
          </Form.Item>

          <Form.Item
            label="联系电话"
            name="contactPhone"
            rules={[
              { pattern: /^1[3-9]\d{9}$|^\d{3,4}-\d{7,8}$/, message: '请输入有效的电话号码' }
            ]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            label="负责人"
            name="contactPerson"
          >
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MyOrganization;

