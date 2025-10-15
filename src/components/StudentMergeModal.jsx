import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Table, Popconfirm, Tag, Checkbox, Card, Space, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { getStudentMerges, createStudentMerge, updateStudentMerge, deleteStudentMerge } from '../services/studentMerge';
import { getStudentAliases, createStudentAlias, updateStudentAlias, deleteStudentAlias } from '../services/studentMerge';

const { Option } = Select;

const StudentMergeModal = ({ visible, onClose, availableStudents = [] }) => {
  const [form] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [aliasForm] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('manage');
  const [merges, setMerges] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingMerge, setEditingMerge] = useState(null);
  const [editingAlias, setEditingAlias] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mergeRes, aliasRes] = await Promise.all([
        getStudentMerges(),
        getStudentAliases()
      ]);
      setMerges(mergeRes.data || []);
      setAliases(aliasRes.data || []);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeSubmit = async (values) => {
    try {
      if (editingMerge) {
        await updateStudentMerge(editingMerge.id, values);
        message.success('更新学员合并成功');
      } else {
        await createStudentMerge(values);
        message.success('创建学员合并成功');
      }
      loadData();
      mergeForm.resetFields();
      setEditingMerge(null);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAliasSubmit = async (values) => {
    try {
      if (editingAlias) {
        await updateStudentAlias(editingAlias.id, values);
        message.success('更新学员别名成功');
      } else {
        await createStudentAlias(values);
        message.success('创建学员别名成功');
      }
      loadData();
      aliasForm.resetFields();
      setEditingAlias(null);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleEditMerge = (record) => {
    setEditingMerge(record);
    mergeForm.setFieldsValue({
      displayName: record.displayName,
      studentNames: record.studentNames
    });
    setActiveTab('merge');
  };

  const handleEditAlias = (record) => {
    setEditingAlias(record);
    aliasForm.setFieldsValue({
      aliasName: record.aliasName,
      studentNames: record.studentNames
    });
    setActiveTab('alias');
  };

  const handleDeleteMerge = async (id) => {
    try {
      await deleteStudentMerge(id);
      message.success('删除学员合并成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDeleteAlias = async (id) => {
    try {
      await deleteStudentAlias(id);
      message.success('删除学员别名成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const mergeColumns = [
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '合并学员',
      dataIndex: 'studentNames',
      key: 'studentNames',
      render: (names) => (
        <div>
          {names.map(name => (
            <Tag key={name} color="blue">{name}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <div>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEditMerge(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个合并设置吗？"
            onConfirm={() => handleDeleteMerge(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const aliasColumns = [
    {
      title: '别名',
      dataIndex: 'aliasName',
      key: 'aliasName',
    },
    {
      title: '关联学员',
      dataIndex: 'studentNames',
      key: 'studentNames',
      render: (names) => (
        <div>
          {names.map(name => (
            <Tag key={name} color="green">{name}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <div>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEditAlias(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个别名设置吗？"
            onConfirm={() => handleDeleteAlias(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="学员合并与别名管理"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <Button.Group>
          <Button 
            type={activeTab === 'merge' ? 'primary' : 'default'}
            onClick={() => setActiveTab('merge')}
          >
            学员合并
          </Button>
          <Button 
            type={activeTab === 'alias' ? 'primary' : 'default'}
            onClick={() => setActiveTab('alias')}
          >
            学员别名
          </Button>
        </Button.Group>
      </div>

      {activeTab === 'merge' && (
        <div>
          <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
            <h4>学员合并说明：</h4>
            <p>将多个学员合并为一个显示名称，在统计时会合并计算课时。</p>
            <Form
              form={mergeForm}
              layout="inline"
              onFinish={handleMergeSubmit}
            >
              <Form.Item
                name="displayName"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="合并后的显示名称" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item
                name="studentNames"
                label="选择学员"
                rules={[{ required: true, message: '请选择要合并的学员' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="选择2-3个学员"
                  style={{ width: 200 }}
                  maxTagCount={3}
                >
                  {availableStudents.map(student => (
                    <Option key={student} value={student}>{student}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                  {editingMerge ? '更新' : '创建'}
                </Button>
                {editingMerge && (
                  <Button onClick={() => { setEditingMerge(null); mergeForm.resetFields(); }}>
                    取消
                  </Button>
                )}
              </Form.Item>
            </Form>
          </div>
          <Table
            columns={mergeColumns}
            dataSource={merges}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>
      )}

      {activeTab === 'alias' && (
        <div>
          <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
            <h4>学员别名说明：</h4>
            <p>设置一个别名代表多个学员，当课表中出现该别名时，所有关联学员都会计课时。</p>
            <Form
              form={aliasForm}
              layout="inline"
              onFinish={handleAliasSubmit}
            >
              <Form.Item
                name="aliasName"
                label="别名"
                rules={[{ required: true, message: '请输入别名' }]}
              >
                <Input placeholder="别名" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item
                name="studentNames"
                label="关联学员"
                rules={[{ required: true, message: '请选择关联的学员' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="选择关联的学员"
                  style={{ width: 200 }}
                >
                  {availableStudents.map(student => (
                    <Option key={student} value={student}>{student}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                  {editingAlias ? '更新' : '创建'}
                </Button>
                {editingAlias && (
                  <Button onClick={() => { setEditingAlias(null); aliasForm.resetFields(); }}>
                    取消
                  </Button>
                )}
              </Form.Item>
            </Form>
          </div>
          <Table
            columns={aliasColumns}
            dataSource={aliases}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>
      )}
    </Modal>
  );
};

export default StudentMergeModal;
