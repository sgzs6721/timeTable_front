import React, { useState, useLayoutEffect, useRef } from 'react';
import { Card, Form, Input, Switch, DatePicker, Button, message, Row, Col, Modal } from 'antd';
import { CalendarOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createTimetable } from '../services/timetable';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// 检测是否为微信浏览器
const isWeChatBrowser = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
};

// 检测是否为移动端
const isMobile = () => {
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const CreateTimetable = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isWeekly, setIsWeekly] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
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

  // 处理日期选择器打开事件
  const handleDatePickerOpenChange = (open) => {
    setDatePickerOpen(open);
    if (open) {
      // 在移动端，确保日期选择器可见
      if (window.innerWidth <= 768) {
        // 滚动到日期选择器位置，确保弹出层可见
        setTimeout(() => {
          if (datePickerWrapperRef.current) {
            datePickerWrapperRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 100);
      }
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  // 处理日期选择（微信浏览器兼容）
  const handleDateRangeClick = () => {
    if (isWeChatBrowser() || isMobile()) {
      setShowDateModal(true);
    } else {
      setDatePickerOpen(true);
    }
  };

  // 处理模态框中的日期选择（直接填入，不需要确认）
  const handleModalDateChange = (dates) => {
    if (dates && dates.length === 2) {
      form.setFieldsValue({ dateRange: dates });
      setShowDateModal(false);
    }
  };

  // 处理模态框取消
  const handleDateModalCancel = () => {
    setShowDateModal(false);
  };

  // 处理原生日期输入
  const handleNativeDateChange = (type, value) => {
    const currentRange = form.getFieldValue('dateRange') || [null, null];
    if (type === 'start') {
      const newRange = [value ? dayjs(value) : null, currentRange[1]];
      form.setFieldsValue({ dateRange: newRange });
    } else {
      const newRange = [currentRange[0], value ? dayjs(value) : null];
      form.setFieldsValue({ dateRange: newRange });
    }
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
                  {isWeChatBrowser() ? (
                    // 微信浏览器使用原生日期输入
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '4px', fontSize: '12px', color: '#666' }}>开始日期</div>
                          <input
                            type="date"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                            min={dayjs().format('YYYY-MM-DD')}
                            onChange={(e) => handleNativeDateChange('start', e.target.value)}
                            value={form.getFieldValue('dateRange')?.[0]?.format('YYYY-MM-DD') || ''}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '4px', fontSize: '12px', color: '#666' }}>结束日期</div>
                          <input
                            type="date"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                            min={form.getFieldValue('dateRange')?.[0]?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD')}
                            onChange={(e) => handleNativeDateChange('end', e.target.value)}
                            value={form.getFieldValue('dateRange')?.[1]?.format('YYYY-MM-DD') || ''}
                          />
                        </div>
                      </div>
                      <div style={{
                        padding: '8px 12px',
                        background: '#f0f8ff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        💡 微信浏览器优化：点击日期框直接选择
                      </div>
                    </div>
                  ) : isMobile() ? (
                    // 其他移动端使用点击触发的方案
                    <div>
                      <Input
                        placeholder="点击选择日期范围"
                        readOnly
                        onClick={handleDateRangeClick}
                        value={
                          form.getFieldValue('dateRange')
                            ? `${form.getFieldValue('dateRange')[0]?.format('YYYY-MM-DD')} 至 ${form.getFieldValue('dateRange')[1]?.format('YYYY-MM-DD')}`
                            : ''
                        }
                        suffix={<CalendarOutlined />}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  ) : (
                    // 桌面端使用原来的 RangePicker
                    <div ref={datePickerWrapperRef} style={{ position: 'relative' }}>
                      <RangePicker
                        style={{ width: '100%' }}
                        placeholder={['开始日期', '结束日期']}
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                        getPopupContainer={() => datePickerWrapperRef.current}
                        popupClassName="mobile-friendly-rangepicker"
                        inputReadOnly={true}
                        open={datePickerOpen}
                        onOpenChange={handleDatePickerOpenChange}
                        dropdownStyle={{
                          width: '100%',
                          minWidth: '100%',
                          maxWidth: '100%'
                        }}
                      />
                    </div>
                  )}
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

      {/* 移动端日期选择模态框 */}
      <Modal
        title="选择课表时间范围"
        open={showDateModal}
        onCancel={handleDateModalCancel}
        width="90%"
        style={{ top: 20 }}
        styles={{
          body: {
            padding: '20px',
            maxHeight: '70vh',
            overflowY: 'auto'
          }
        }}
        footer={null}
      >
        <div style={{ padding: '10px 0' }}>
          <RangePicker
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            onChange={handleModalDateChange}
            size="large"
            inputReadOnly={false}
            getPopupContainer={(trigger) => trigger.parentNode}
            autoFocus
          />
        </div>
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#f0f8ff',
          borderRadius: 4,
          fontSize: '12px',
          color: '#666'
        }}>
          <div>💡 提示：选择日期范围后将自动填入</div>
          <div>• 开始日期不能早于今天</div>
          <div>• 选择完成后会自动关闭</div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateTimetable;