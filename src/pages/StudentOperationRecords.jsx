import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  message, 
  Space, 
  Tag, 
  Popconfirm,
  Typography,
  Descriptions
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { 
  getStudentOperationRecords, 
  updateStudentOperationRecord, 
  deleteStudentOperationRecord 
} from '../services/studentOperationRecords';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const StudentOperationRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [form] = Form.useForm();

  // 获取操作记录
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await getStudentOperationRecords();
      if (response && response.success) {
        setRecords(response.data || []);
      } else {
        message.error('获取操作记录失败');
      }
    } catch (error) {
      console.error('获取操作记录失败:', error);
      message.error('获取操作记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // 查看详情
  const handleViewDetail = (record) => {
    setCurrentRecord(record);
    setDetailModalVisible(true);
  };

  // 编辑记录
  const handleEdit = (record) => {
    setCurrentRecord(record);
    form.setFieldsValue({
      newName: record.newName,
      details: record.details
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      await updateStudentOperationRecord(currentRecord.id, values);
      message.success('更新成功');
      setEditModalVisible(false);
      fetchRecords();
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // 删除记录
  const handleDelete = async (id) => {
    try {
      await deleteStudentOperationRecord(id);
      message.success('删除成功');
      fetchRecords();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 获取操作类型标签颜色
  const getOperationTypeColor = (type) => {
    const colorMap = {
      'RENAME': 'blue',
      'DELETE': 'red',
      'ASSIGN_ALIAS': 'green',
      'MERGE': 'purple'
    };
    return colorMap[type] || 'default';
  };

  // 获取操作类型文本
  const getOperationTypeText = (type) => {
    const textMap = {
      'RENAME': '重命名',
      'DELETE': '删除',
      'ASSIGN_ALIAS': '分配别名',
      'MERGE': '合并'
    };
    return textMap[type] || type;
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => (
        <Tag color={getOperationTypeColor(type)}>
          {getOperationTypeText(type)}
        </Tag>
      ),
    },
    {
      title: '原学员姓名',
      dataIndex: 'oldName',
      key: 'oldName',
    },
    {
      title: '新学员姓名/描述',
      dataIndex: 'newName',
      key: 'newName',
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '16px' 
        }}>
          <Title level={3} style={{ margin: 0 }}>
            学员操作记录
          </Title>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />}
            onClick={fetchRecords}
            loading={loading}
          >
            刷新
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="操作记录详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="操作类型">
              <Tag color={getOperationTypeColor(currentRecord.operationType)}>
                {getOperationTypeText(currentRecord.operationType)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="原学员姓名">
              {currentRecord.oldName}
            </Descriptions.Item>
            <Descriptions.Item label="新学员姓名/描述">
              {currentRecord.newName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {dayjs(currentRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="操作详情">
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '8px', 
                borderRadius: '4px',
                margin: 0,
                whiteSpace: 'pre-wrap'
              }}>
                {currentRecord.details || '-'}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 编辑模态框 */}
      <Modal
        title="编辑操作记录"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="新学员姓名/描述"
            name="newName"
            rules={[{ required: true, message: '请输入新学员姓名/描述' }]}
          >
            <Input placeholder="请输入新学员姓名/描述" />
          </Form.Item>
          <Form.Item
            label="操作详情"
            name="details"
          >
            <TextArea 
              rows={4} 
              placeholder="请输入操作详情（JSON格式）" 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentOperationRecords;