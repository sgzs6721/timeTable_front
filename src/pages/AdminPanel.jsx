import React, { useState, useEffect } from 'react';
import { Table, Button, message, Modal, Form, Input, Select, Space, Tag } from 'antd';
import { UserOutlined, CalendarOutlined, MergeOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllTimetables, mergeTimetables } from '../services/timetable';

const { Option } = Select;

const AdminPanel = ({ user }) => {
  const [allTimetables, setAllTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [selectedTimetables, setSelectedTimetables] = useState([]);
  const [mergeForm] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllTimetables();
  }, []);

  const fetchAllTimetables = async () => {
    try {
      const response = await getAllTimetables();
      if (response.success) {
        setAllTimetables(response.data);
      } else {
        message.error(response.message || '获取课表数据失败');
      }
    } catch (error) {
      message.error('获取课表数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeTimetables = () => {
    if (selectedTimetables.length < 2) {
      message.warning('请至少选择两个课表进行合并');
      return;
    }
    setMergeModalVisible(true);
  };

  const handleMergeSubmit = async (values) => {
    try {
      const response = await mergeTimetables(selectedTimetables, values.mergedName);
      if (response.success) {
        message.success('课表合并成功');
        setMergeModalVisible(false);
        setSelectedTimetables([]);
        mergeForm.resetFields();
        fetchAllTimetables();
      } else {
        message.error(response.message || '合并失败');
      }
    } catch (error) {
      message.error('合并失败，请重试');
    }
  };

  const columns = [
    {
      title: '课表名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <CalendarOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '所属用户',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isWeekly',
      key: 'isWeekly',
      render: (isWeekly) => (
        <Tag color={isWeekly ? 'blue' : 'green'}>
          {isWeekly ? '周固定课表' : '日期范围课表'}
        </Tag>
      ),
    },
    {
      title: '时间范围',
      dataIndex: 'dateRange',
      key: 'dateRange',
      render: (_, record) => {
        if (record.isWeekly) {
          return <span style={{ color: '#666' }}>每周重复</span>;
        }
        return `${record.startDate} 至 ${record.endDate}`;
      },
    },
    {
      title: '课程数量',
      dataIndex: 'scheduleCount',
      key: 'scheduleCount',
      render: (count) => (
        <Tag color="orange">{count || 0} 个课程</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/view-timetable/${record.id}`)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedTimetables,
    onChange: (selectedRowKeys) => {
      setSelectedTimetables(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  const selectedTableNames = allTimetables
    .filter(table => selectedTimetables.includes(table.id))
    .map(table => `${table.name} (${table.username})`)
    .join('、');

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>管理员面板</h1>
        <Button onClick={() => navigate('/dashboard')} icon={<ArrowLeftOutlined />}>
          返回
        </Button>
      </div>
      
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>
          已选择 {selectedTimetables.length} 个课表
        </span>
        <Button 
          type="primary" 
          icon={<MergeOutlined />}
          onClick={handleMergeTimetables}
          disabled={selectedTimetables.length < 2}
        >
          合并选中课表
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={allTimetables}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        }}
        rowSelection={rowSelection}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="合并课表"
        open={mergeModalVisible}
        onCancel={() => {
          setMergeModalVisible(false);
          mergeForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <h4>将要合并的课表：</h4>
          <div style={{ 
            background: '#f6f8fa', 
            padding: 12, 
            borderRadius: 6,
            color: '#666',
            fontSize: '14px'
          }}>
            {selectedTableNames}
          </div>
        </div>

        <Form
          form={mergeForm}
          layout="vertical"
          onFinish={handleMergeSubmit}
          size="large"
        >
          <Form.Item
            name="mergedName"
            label="合并后的课表名称"
            rules={[
              { required: true, message: '请输入合并后的课表名称!' },
              { min: 2, message: '课表名称至少2个字符!' }
            ]}
          >
            <Input placeholder="例如：2024年春季合并课表" />
          </Form.Item>

          <div style={{ 
            background: '#fff7e6', 
            border: '1px solid #ffd591',
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: '14px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>⚠️ 合并说明：</div>
            <div>• 合并后将创建一个新的课表，包含所有选中课表的课程安排</div>
            <div>• 如果存在时间冲突，系统会智能处理并标注</div>
            <div>• 原课表不会被删除，仍可正常查看和使用</div>
            <div>• 合并后的课表将显示在您的课表列表中</div>
          </div>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                icon={<MergeOutlined />}
              >
                确认合并
              </Button>
              <Button onClick={() => {
                setMergeModalVisible(false);
                mergeForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Card style={{ marginTop: 24 }} title="管理员统计">
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              {allTimetables.length}
            </div>
            <div style={{ color: '#666' }}>总课表数</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
              {new Set(allTimetables.map(t => t.userId)).size}
            </div>
            <div style={{ color: '#666' }}>用户数</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
              {allTimetables.reduce((sum, t) => sum + (t.scheduleCount || 0), 0)}
            </div>
            <div style={{ color: '#666' }}>总课程数</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
              {allTimetables.filter(t => t.isWeekly).length}
            </div>
            <div style={{ color: '#666' }}>周固定课表</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminPanel; 