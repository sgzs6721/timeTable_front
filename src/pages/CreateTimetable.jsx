import React, { useState, useLayoutEffect, useRef } from 'react';
import { Card, Form, Input, Switch, DatePicker, Button, message, Row, Col } from 'antd';
import { CalendarOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createTimetable } from '../services/timetable';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const CreateTimetable = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isWeekly, setIsWeekly] = useState(false);
  const navigate = useNavigate();

  const datePickerWrapperRef = useRef(null);
  const [datePickerWidth, setDatePickerWidth] = useState(0);

  useLayoutEffect(() => {
    const updateWidth = () => {
      if (datePickerWrapperRef.current) {
        const width = datePickerWrapperRef.current.offsetWidth;
        setDatePickerWidth(width);

        // 动态设置CSS变量来控制弹出框宽度
        document.documentElement.style.setProperty('--rangepicker-width', `${width}px`);

        // 同时设置到body上，确保弹出框能够获取到
        document.body.style.setProperty('--rangepicker-width', `${width}px`);
      }
    };

    // 延迟执行以确保DOM完全渲染
    const timer = setTimeout(updateWidth, 100);

    // 监听窗口大小变化
    window.addEventListener('resize', updateWidth);

    // 监听DOM变化，确保在表单项显示/隐藏时重新计算
    const observer = new MutationObserver(updateWidth);
    if (datePickerWrapperRef.current) {
      observer.observe(datePickerWrapperRef.current, {
        attributes: true,
        childList: true,
        subtree: true
      });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, [isWeekly]); // 添加isWeekly依赖，当切换时重新计算宽度

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const timetableData = {
        name: values.name,
        type: values.isWeekly ? 'WEEKLY' : 'DATE_RANGE',
        startDate: values.isWeekly ? null : values.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: values.isWeekly ? null : values.dateRange?.[1]?.format('YYYY-MM-DD'),
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
      form.setFieldsValue({ dateRange: null });
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
                <Form.Item
                  name="dateRange"
                  label="课表时间范围"
                  rules={[
                    { required: !isWeekly, message: '请选择课表的时间范围!' }
                  ]}
                >
                  <div ref={datePickerWrapperRef}>
                    <RangePicker
                      style={{ width: '100%' }}
                      placeholder={['开始日期', '结束日期']}
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                      getPopupContainer={(trigger) => datePickerWrapperRef.current || trigger.ownerDocument.body}
                      popupClassName="mobile-friendly-rangepicker"
                      dropdownStyle={{
                        width: datePickerWidth > 0 ? `${datePickerWidth}px` : '100%',
                        minWidth: datePickerWidth > 0 ? `${datePickerWidth}px` : '100%',
                        maxWidth: datePickerWidth > 0 ? `${datePickerWidth}px` : '100%'
                      }}
                    />
                  </div>
                </Form.Item>
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