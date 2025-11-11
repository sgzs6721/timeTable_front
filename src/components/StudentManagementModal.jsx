import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Table, Popconfirm, Tag, Checkbox, Card, Space, Divider, List, Avatar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { getStudentMerges, createStudentMerge, updateStudentMerge, deleteStudentMerge, renameStudent, deleteStudent as deleteStudentApi, assignStudentAlias } from '../services/studentMerge';
import { getStudentAliases, createStudentAlias, updateStudentAlias, deleteStudentAlias } from '../services/studentMerge';

const { Option } = Select;

const StudentManagementModal = ({ visible, onClose, availableStudents = [] }) => {
  const [form] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('manage');
  const [merges, setMerges] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [editingMerge, setEditingMerge] = useState(null);
  const [editingAlias, setEditingAlias] = useState(null);
  const [operationType, setOperationType] = useState(null);

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

  const handleStudentSelect = (studentName, checked) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentName]);
    } else {
      setSelectedStudents(selectedStudents.filter(name => name !== studentName));
    }
  };

  const handleRename = () => {
    if (selectedStudents.length !== 1) {
      message.warning('请选择一个学员进行重命名');
      return;
    }
    setOperationType('rename');
    renameForm.setFieldsValue({
      newName: selectedStudents[0]
    });
  };

  const handleAssign = () => {
    if (selectedStudents.length !== 1) {
      message.warning('请选择一个学员进行分配');
      return;
    }
    setShowAssignModal(true);
  };

  const handleMerge = () => {
    if (selectedStudents.length < 2) {
      message.warning('请选择至少两个学员进行合并');
      return;
    }
    setShowMergeModal(true);
  };

  const handleRenameSubmit = async (values) => {
    try {
      const oldName = selectedStudents[0];
      const newName = values.newName;
      
      await renameStudent({
        oldName,
        newName
      });
      
      message.success(`学员 "${oldName}" 已重命名为 "${newName}"`);
      setOperationType(null);
      renameForm.resetFields();
      setSelectedStudents([]);
    } catch (error) {
      message.error('重命名失败');
    }
  };

  const handleAssignSubmit = async (values) => {
    try {
      const studentName = selectedStudents[0];
      const aliasName = values.aliasName;
      
      await assignStudentAlias({
        oldName: studentName,
        aliasName
      });
      
      message.success(`学员 "${studentName}" 已分配给别名 "${aliasName}"`);
      setShowAssignModal(false);
      assignForm.resetFields();
      setSelectedStudents([]);
      loadData();
    } catch (error) {
      message.error('分配失败');
    }
  };

  const handleMergeSubmit = async (values) => {
    try {
      const displayName = values.displayName;
      
      // 创建合并设置
      await createStudentMerge({
        displayName,
        studentNames: selectedStudents
      });
      
      message.success(`已创建合并设置 "${displayName}"`);
      setShowMergeModal(false);
      mergeForm.resetFields();
      setSelectedStudents([]);
      loadData();
    } catch (error) {
      message.error('合并失败');
    }
  };

  const handleDeleteStudent = async (studentName) => {
    try {
      await deleteStudentApi({
        oldName: studentName
      });
      
      message.success(`学员 "${studentName}" 已删除`);
      setSelectedStudents(selectedStudents.filter(name => name !== studentName));
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
            onClick={() => {
              setEditingMerge(record);
              mergeForm.setFieldsValue({
                displayName: record.displayName,
                studentNames: record.studentNames
              });
            }}
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
            onClick={() => {
              setEditingAlias(record);
              assignForm.setFieldsValue({
                aliasName: record.aliasName,
                studentNames: record.studentNames
              });
            }}
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

  const handleDeleteMerge = async (id) => {
    try {
      await deleteStudentMerge(id);
      message.success('删除合并设置成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDeleteAlias = async (id) => {
    try {
      await deleteStudentAlias(id);
      message.success('删除别名设置成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  return (
    <Modal
      title="学员管理"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <Space.Compact>
          <Button
            type={activeTab === 'manage' ? 'primary' : 'default'}
            onClick={() => setActiveTab('manage')}
            icon={<UserOutlined />}
          >
            学员管理
          </Button>
          <Button
            type={activeTab === 'merge' ? 'primary' : 'default'}
            onClick={() => setActiveTab('merge')}
            icon={<TeamOutlined />}
          >
            合并设置
          </Button>
          <Button
            type={activeTab === 'alias' ? 'primary' : 'default'}
            onClick={() => setActiveTab('alias')}
            icon={<SettingOutlined />}
          >
            别名设置
          </Button>
        </Space.Compact>
      </div>

      {activeTab === 'manage' && (
        <div>
          <Card title="选择学员" size="small" style={{ marginBottom: 16 }}>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <List
                grid={{ gutter: 16, column: 4 }}
                dataSource={availableStudents}
                renderItem={(student) => (
                  <List.Item>
                    <Card
                      size="small"
                      style={{ 
                        cursor: 'pointer',
                        border: selectedStudents.includes(student) ? '2px solid #1890ff' : '1px solid #d9d9d9'
                      }}
                      onClick={() => handleStudentSelect(student, !selectedStudents.includes(student))}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <Avatar size={40} style={{ backgroundColor: '#1890ff', marginBottom: 8 }}>
                          {student.charAt(0)}
                        </Avatar>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{student}</div>
                        <Checkbox 
                          checked={selectedStudents.includes(student)}
                          onChange={(e) => handleStudentSelect(student, e.target.checked)}
                        />
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </Card>

          {selectedStudents.length > 0 && (
            <Card title="操作面板" size="small" style={{ marginBottom: 16 }}>
              <Space>
                <div>
                  已选择 {selectedStudents.length} 个学员：
                  {selectedStudents.map(name => (
                    <Tag key={name} color="blue">{name}</Tag>
                  ))}
                </div>
              </Space>
              <Divider />
              
              {operationType === 'rename' ? (
                <div>
                  <Form form={renameForm} onFinish={handleRenameSubmit} layout="inline">
                    <Form.Item
                      name="newName"
                      rules={[{ required: true, message: '请输入新名称' }]}
                    >
                      <Input placeholder="输入新的学员名称" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        确认重命名
                      </Button>
                    </Form.Item>
                    <Form.Item>
                      <Button onClick={() => setOperationType(null)}>
                        取消
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              ) : (
                <Space>
                  {selectedStudents.length === 1 && (
                    <>
                      <Button
                        type="primary"
                        danger
                        onClick={() => handleDeleteStudent(selectedStudents[0])}
                      >
                        删除学员
                      </Button>
                      <Button
                        type="default"
                        onClick={handleRename}
                      >
                        重命名
                      </Button>
                      <Button
                        type="default"
                        onClick={handleAssign}
                      >
                        分配别名
                      </Button>
                    </>
                  )}
                  {selectedStudents.length >= 2 && (
                    <Button
                      type="primary"
                      onClick={handleMerge}
                    >
                      合并学员
                    </Button>
                  )}
                </Space>
              )}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'merge' && (
        <div>
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
          <Table
            columns={aliasColumns}
            dataSource={aliases}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </div>
      )}


      {/* 分配别名模态框 */}
      <Modal
        title="分配别名"
        open={showAssignModal}
        onCancel={() => setShowAssignModal(false)}
        onOk={() => assignForm.submit()}
      >
        <Form form={assignForm} onFinish={handleAssignSubmit}>
          <Form.Item
            name="aliasName"
            label="别名"
            rules={[{ required: true, message: '请输入别名' }]}
          >
            <Input placeholder="输入别名" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合并学员模态框 */}
      <Modal
        title="合并学员"
        open={showMergeModal}
        onCancel={() => setShowMergeModal(false)}
        onOk={() => mergeForm.submit()}
      >
        <Form form={mergeForm} onFinish={handleMergeSubmit}>
          <Form.Item
            name="displayName"
            label="合并后名称"
            rules={[{ required: true, message: '请输入合并后的名称' }]}
          >
            <Input placeholder="输入合并后的显示名称" />
          </Form.Item>
          <div>
            将合并的学员：{selectedStudents.map(name => (
              <Tag key={name} color="blue">{name}</Tag>
            ))}
          </div>
        </Form>
      </Modal>
    </Modal>
  );
};

export default StudentManagementModal;
