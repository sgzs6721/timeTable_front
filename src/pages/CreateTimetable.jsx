import React, { useState } from 'react';
import { Form, Input, DatePicker, Button, message, Row, Col, Radio } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createTimetable } from '../services/timetable';
import Footer from '../components/Footer';
import dayjs from 'dayjs';

const CreateTimetable = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isWeekly, setIsWeekly] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const timetableData = {
        name: values.name,
        type: values.isWeekly ? 'WEEKLY' : 'DATE_RANGE',
        startDate: values.isWeekly ? null : values.startDate?.format('YYYY-MM-DD'),
        endDate: values.isWeekly ? null : values.endDate?.format('YYYY-MM-DD'),
        organizationId: user?.organizationId,
      };

      const response = await createTimetable(timetableData);
      if (response.success) {
        message.success('课表创建成功');
        navigate('/dashboard?tab=timetables&refresh=true');
      } else {
        message.error(response.message || '创建失败');
      }
    } catch (error) {
      message.error('创建失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleWeeklyChange = (checked) => {
    setIsWeekly(checked);
    if (checked) {
      form.setFieldsValue({ startDate: null, endDate: null });
    }
  };

  const handleBack = () => {
    navigate('/dashboard?tab=timetables');
  };

  
  return (
    <div className="page-container">
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>创建新课表</h1>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        size="large"
        style={{ maxWidth: '600px', margin: '0 auto' }}
      >
        <Form.Item
          name="name"
          label="课表名称"
          rules={[
            { required: true, message: '请输入课表名称!' },
            { min: 2, message: '课表名称至少2个字符!' }
          ]}
        >
          <Input placeholder="例如：2024年春季课表" />
        </Form.Item>

        <Form.Item
          name="isWeekly"
          label="课表类型"
          initialValue={false}
        >
          <Radio.Group 
            onChange={(e) => handleWeeklyChange(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value={false}>日期范围课表</Radio.Button>
            <Radio.Button value={true}>周固定课表</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {!isWeekly && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期!' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择开始日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="结束日期"
                rules={[
                  { required: true, message: '请选择结束日期!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('startDate');
                      if (!value || !startDate || value.isAfter(startDate)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('结束日期不能早于开始日期!'));
                    },
                  }),
                ]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择结束日期" />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Form.Item style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button
              type="default"
              danger
              onClick={handleBack}
              style={{ flex: 1 }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ flex: 1 }}
            >
              创建
            </Button>
          </div>
        </Form.Item>

        <div style={{
          marginTop: 24,
          padding: 16,
          background: '#fafafa',
          border: '1px solid #e8e8e8',
          borderRadius: 6,
          fontSize: '13px',
          color: '#666'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📝 说明：</div>
          <div><strong>周固定课表：</strong>适用于每周重复的固定课程安排。</div>
          <div><strong>日期课表：</strong>适用于有明确开始和结束日期的课程，如假期班。</div>
        </div>
      </Form>
      
      {/* 版权信息 */}
      <Footer />
    </div>
  );
};

export default CreateTimetable;