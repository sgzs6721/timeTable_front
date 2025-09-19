import React, { useState } from 'react';
import { Modal, Form, Input, Button } from 'antd';

/**
 * 请假申请弹窗
 * @param {boolean} visible 是否可见
 * @param {Function} onCancel 取消回调
 * @param {Function} onOk 确认回调，返回请假原因
 * @param {Object} schedule 当前课程对象
 */
const LeaveRequestModal = ({ visible, onCancel, onOk, schedule }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await onOk(values.leaveReason);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="学生请假申请"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      destroyOnClose
      okText="确认请假"
      cancelText="取消"
      confirmLoading={loading}
      width={320}
      style={{ top: 20 }}
      zIndex={2000}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
          课程信息：
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {schedule?.studentName} - {schedule?.startTime?.substring(0, 5)}~{schedule?.endTime?.substring(0, 5)}
        </div>
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          label="请假原因"
          name="leaveReason"
          rules={[
            { max: 100, message: '请假原因不能超过100个字符' }
          ]}
        >
          <Input
            placeholder="请输入请假原因（选填）"
            maxLength={100}
          />
        </Form.Item>
      </Form>
      
      <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
        注意：请假后该课程将从课表中移除
      </div>
    </Modal>
  );
};

export default LeaveRequestModal;
