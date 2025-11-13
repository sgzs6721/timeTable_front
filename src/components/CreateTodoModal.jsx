import React, { useState } from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, message } from 'antd';
import { createTodo } from '../services/todo';
import dayjs from 'dayjs';

const CreateTodoModal = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { title, content, reminderDate, reminderTime } = values;

      const todoData = {
        customerName: title,
        content: content,
        reminderDate: reminderDate ? dayjs(reminderDate).format('YYYY-MM-DD') : null,
        reminderTime: reminderTime ? dayjs(reminderTime).format('HH:mm:ss') : '09:00:00',
        type: 'MANUAL',
        status: 'PENDING'
      };

      const result = await createTodo(todoData);

      if (result.success) {
        message.success('待办创建成功');
        form.resetFields();
        onSuccess && onSuccess(result.data);
        onCancel();
      } else {
        message.error(result.message || '创建失败');
      }
    } catch (error) {
      console.error('创建待办失败:', error);
      if (error.errorFields) {
        message.warning('请填写完整信息');
      } else {
        message.error('创建待办失败');
      }
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
      title="新建待办"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 20 }}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[
            { required: true, message: '请输入标题' },
            { max: 100, message: '标题不能超过100个字符' }
          ]}
        >
          <Input 
            placeholder="请输入待办标题"
            maxLength={100}
          />
        </Form.Item>

        <Form.Item
          name="content"
          label="内容"
          rules={[
            { required: true, message: '请输入内容' },
            { max: 500, message: '内容不能超过500个字符' }
          ]}
        >
          <Input.TextArea
            placeholder="请输入待办内容"
            rows={4}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="reminderDate"
          label="提醒日期"
          rules={[{ required: true, message: '请选择提醒日期' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            placeholder="选择提醒日期"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            inputReadOnly
          />
        </Form.Item>

        <Form.Item
          name="reminderTime"
          label="提醒时间"
          rules={[{ required: true, message: '请选择提醒时间' }]}
          initialValue={dayjs('09:00', 'HH:mm')}
        >
          <TimePicker
            style={{ width: '100%' }}
            format="HH:mm"
            placeholder="选择提醒时间"
            inputReadOnly
            popupClassName="ios-timepicker-fix"
            getPopupContainer={() => document.body}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTodoModal;

