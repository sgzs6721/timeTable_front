import React, { useState } from 'react';
import { Card, Form, Input, Switch, DatePicker, Button, message, Row, Col } from 'antd';
import { CalendarOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createTimetable } from '../services/timetable';
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
      };

      const response = await createTimetable(timetableData);
      if (response.success) {
        message.success('课表创建成功');
        navigate('/dashboard');
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
    navigate('/dashboard');
  };

  return (
    <div className="content-container">
      <Row justify="center">
        <Col xs={24} sm={20} md={16} lg={12} xl={10}>
          <Card
            title={
              <div style={{ textAlign: 'center' }}>
                创建课表
              </div>
            }
            styles={{ body: { overflow: 'visible' } }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              size="large"
            >
              <Form.Item
                name="name"
                label="课表名称"
                rules={[
                  { required: true, message: '请输入课表名称!' },
                  { min: 2, message: '课表名称至少2个字符!' }
                ]}
              >
                <Input placeholder="请输入课表名称，例如：2024年春季课表" />
              </Form.Item>

              <Form.Item
                name="isWeekly"
                label="课表类型"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="周固定课表"
                  unCheckedChildren="日期范围课表"
                  onChange={handleWeeklyChange}
                />
              </Form.Item>

              {!isWeekly && (
                <>
                  <Form.Item
                    name="startDate"
                    label="开始日期"
                    rules={[
                      { required: !isWeekly, message: '请选择开始日期!' }
                    ]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="选择开始日期"
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                      inputReadOnly={true}
                      popupClassName="mobile-friendly-datepicker"
                    />
                  </Form.Item>

                  <Form.Item
                    name="endDate"
                    label="结束日期"
                    rules={[
                      { required: !isWeekly, message: '请选择结束日期!' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const startDate = getFieldValue('startDate');
                          if (!value || !startDate) {
                            return Promise.resolve();
                          }
                          if (value.isBefore(startDate)) {
                            return Promise.reject(new Error('结束日期不能早于开始日期!'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="选择结束日期"
                      disabledDate={(current) => {
                        const startDate = form.getFieldValue('startDate');
                        if (startDate) {
                          return current && current < startDate;
                        }
                        return current && current < dayjs().startOf('day');
                      }}
                      inputReadOnly={true}
                      popupClassName="mobile-friendly-datepicker"
                    />
                  </Form.Item>
                </>
              )}

              <div style={{ marginTop: 32 }}>
                <Form.Item>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <Button
                      type="default"
                      danger
                      onClick={handleBack}
                      size="large"
                      style={{ flex: 1 }}
                    >
                      取消
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      size="large"
                      style={{ flex: 1 }}
                    >
                      创建
                    </Button>
                  </div>
                </Form.Item>
              </div>
            </Form>

            <div style={{
              marginTop: 24,
              padding: 16,
              background: '#f6f8fa',
              borderRadius: 6,
              fontSize: '13px',
              color: '#666'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📝 说明：</div>
              <div><strong>周固定课表：</strong>适用于每周重复的固定课程安排</div>
              <div><strong>日期范围课表：</strong>适用于有开始和结束时间的课程安排</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CreateTimetable;