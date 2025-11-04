import React, { useState, useEffect } from 'react';
import { Card, Input, Button, message, Spin, Select, Form, DatePicker, Row, Col, Divider } from 'antd';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { getCurrentSalarySystemSettings, saveOrUpdateSalarySystemSettings } from '../services/salarySystemSettings';

const SalarySystemSettings = ({ organizationId }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [initialValues, setInitialValues] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // 初始化表单默认值
  useEffect(() => {
    if (organizationId) {
      fetchCurrentSettings();
    }
  }, [form, organizationId]);

  const fetchCurrentSettings = async () => {
    setLoading(true);
    try {
      const response = await getCurrentSalarySystemSettings(organizationId);
      let values;
      if (response && response.success) {
        const settings = response.data;
        values = {
          salaryStartDay: settings.salaryStartDay || 1,
          salaryEndDay: settings.salaryEndDay || 31,
          salaryPayDay: settings.salaryPayDay || 5
        };
      } else {
        // 如果获取失败，使用默认值
        values = {
          salaryStartDay: 1,
          salaryEndDay: 31,
          salaryPayDay: 5
        };
      }
      
      form.setFieldsValue(values);
      setInitialValues(values);
      setHasChanges(false); // 重置变化状态
    } catch (error) {
      console.error('获取工资系统设置失败:', error);
      // 如果获取失败，使用默认值
      const values = {
        salaryStartDay: 1,
        salaryEndDay: 31,
        salaryPayDay: 5
      };
      form.setFieldsValue(values);
      setInitialValues(values);
      setHasChanges(false); // 重置变化状态
    } finally {
      setLoading(false);
    }
  };

  // 检查表单值是否有变化
  const checkValuesChanged = (currentValues, initial) => {
    const keys = ['salaryStartDay', 'salaryEndDay', 'salaryPayDay'];
    return keys.some(key => currentValues[key] !== initial[key]);
  };

  // 监听表单值变化
  const onValuesChange = (changedValues, allValues) => {
    const changed = checkValuesChanged(allValues, initialValues);
    setHasChanges(changed);
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await saveOrUpdateSalarySystemSettings(values, organizationId);
      if (response && response.success) {
        message.success('工资设置保存成功');
        // 更新初始值并重置变化状态
        setInitialValues(values);
        setHasChanges(false);
      } else {
        message.error(response?.message || '保存工资设置失败');
      }
    } catch (error) {
      console.error('保存工资设置失败:', error);
      message.error('保存工资设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 24px 24px 24px' }}>
      <div style={{ marginBottom: 20, fontSize: '16px', fontWeight: 500 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        工资系统设置
      </div>

      <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={onValuesChange}
          style={{ maxWidth: 800 }}
        >
          <Divider orientation="left">记薪周期设置</Divider>
          
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                label="记薪开始日"
                name="salaryStartDay"
                rules={[
                  { required: true, message: '请选择记薪开始日' },
                  { type: 'number', min: 1, max: 31, message: '请选择1-31号之间的日期' }
                ]}
              >
                <Select
                  placeholder="请选择开始日"
                  style={{ width: '100%' }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <Select.Option key={day} value={day}>
                      {day}号
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col xs={24} sm={8}>
              <Form.Item
                label="记薪结束日"
                name="salaryEndDay"
                rules={[
                  { required: true, message: '请选择记薪结束日' },
                  { type: 'number', min: 1, max: 31, message: '请选择1-31号之间的日期' }
                ]}
              >
                <Select
                  placeholder="请选择结束日"
                  style={{ width: '100%' }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <Select.Option key={day} value={day}>
                      {day}号
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col xs={24} sm={8}>
              <Form.Item
                label="工资发放日"
                name="salaryPayDay"
                rules={[
                  { required: true, message: '请选择工资发放日' }
                ]}
              >
                <Select
                  placeholder="请选择发放日"
                  style={{ width: '100%' }}
                >
                  <Select.Option key={0} value={0}>
                    月末（最后一天）
                  </Select.Option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <Select.Option key={day} value={day}>
                      {day}号
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>


          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
              disabled={!hasChanges || loading}
              size="large"
              style={{ minWidth: 120 }}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SalarySystemSettings;
