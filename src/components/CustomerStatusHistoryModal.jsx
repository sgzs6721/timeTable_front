import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Timeline, Spin, message, Button, Space, Tag } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { changeCustomerStatus, getCustomerStatusHistory } from '../services/customerStatusHistory';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const CustomerStatusHistoryModal = ({ visible, onCancel, customer, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue({
        toStatus: customer.status
      });
      fetchHistory();
    }
  }, [visible, customer]);

  const fetchHistory = async () => {
    if (!customer) return;
    
    setFetchingHistory(true);
    try {
      const response = await getCustomerStatusHistory(customer.id);
      if (response && response.success) {
        setHistories(response.data || []);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleSubmit = async (values) => {
    if (!customer) return;

    // 检查状态是否有变化
    if (values.toStatus === customer.status) {
      message.warning('请选择不同的状态');
      return;
    }

    setLoading(true);
    try {
      const response = await changeCustomerStatus(customer.id, {
        toStatus: values.toStatus,
        notes: values.notes
      });

      if (response && response.success) {
        message.success('状态变更成功');
        form.resetFields();
        if (onSuccess) {
          onSuccess(values.toStatus, values.notes);
        }
        onCancel();
      } else {
        message.error(response?.message || '状态变更失败');
      }
    } catch (error) {
      console.error('状态变更失败:', error);
      message.error('状态变更失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEW': 'blue',
      'CONTACTED': 'orange',
      'SCHEDULED': 'purple',
      'PENDING_CONFIRM': 'yellow',
      'VISITED': 'green',
      'SOLD': 'success',
      'RE_EXPERIENCE': 'cyan',
      'CLOSED': 'default'
    };
    return colors[status] || 'default';
  };

  return (
    <Modal
      title={`状态流转记录 - ${customer?.childName || ''}`}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>切换状态</h3>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="toStatus"
            label="新状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择新状态">
              <Option value="NEW">新建</Option>
              <Option value="CONTACTED">已联系</Option>
              <Option value="SCHEDULED">已安排上门</Option>
              <Option value="PENDING_CONFIRM">待确认</Option>
              <Option value="VISITED">已上门</Option>
              <Option value="SOLD">已成交</Option>
              <Option value="RE_EXPERIENCE">待再体验</Option>
              <Option value="CLOSED">已结束</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注信息"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入状态变更的相关信息，如联系结果、预约时间等" 
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                确认变更
              </Button>
              <Button onClick={onCancel}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>历史记录</h3>
        {fetchingHistory ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : histories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无状态变更记录
          </div>
        ) : (
          <Timeline>
            {histories.map((history) => (
              <Timeline.Item
                key={history.id}
                dot={<ClockCircleOutlined style={{ fontSize: '16px' }} />}
              >
                <div style={{ marginBottom: 8 }}>
                  <Space>
                    {history.fromStatusText ? (
                      <>
                        <Tag color={getStatusColor(history.fromStatus)}>
                          {history.fromStatusText}
                        </Tag>
                        <span>→</span>
                      </>
                    ) : (
                      <span style={{ color: '#999' }}>初始状态 →</span>
                    )}
                    <Tag color={getStatusColor(history.toStatus)}>
                      {history.toStatusText}
                    </Tag>
                  </Space>
                </div>
                {history.notes && (
                  <div style={{ color: '#666', marginBottom: 4 }}>
                    {history.notes}
                  </div>
                )}
                <div style={{ color: '#999', fontSize: '12px' }}>
                  {history.createdByName} · {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </div>
    </Modal>
  );
};

export default CustomerStatusHistoryModal;

