import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Button, message, Space, Tooltip, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getStudentOperationRecords, deleteStudentOperationRecord, updateStudentOperationRecord } from '../services/studentOperationRecords';
import dayjs from 'dayjs';

const StudentOperationRecordsModal = ({ visible, onClose, studentName, coachId, onOperationComplete }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  useEffect(() => {
    if (visible) {
      // 重置状态，避免显示上次的数据
      setRecords([]);
      setLoading(true);
      fetchRecords();
    } else {
      // 模态框关闭时重置状态
      setRecords([]);
      setLoading(false);
      setEditingRecord(null);
    }
  }, [visible, studentName, coachId]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // 传递教练ID参数
      // 如果有coachId但没有studentName，说明是查看该教练的所有记录
      // 如果有studentName，说明是查看特定学员的记录
      const response = await getStudentOperationRecords(true, studentName, coachId);
      if (response && response.success) {
        const records = response.data || [];
        
        setRecords(records);
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

  const handleDelete = async (id) => {
    try {
      await deleteStudentOperationRecord(id);
      message.success('删除成功');
      fetchRecords();
      // 通知父组件刷新学员列表
      if (onOperationComplete) {
        onOperationComplete();
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    try {
      await updateStudentOperationRecord(editingRecord.id, editingRecord);
      message.success('更新成功');
      setEditingRecord(null);
      fetchRecords();
      // 通知父组件刷新学员列表
      if (onOperationComplete) {
        onOperationComplete();
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  const getOperationTypeTag = (type) => {
    const typeMap = {
      'RENAME': { color: 'blue', text: '重命名' },
      'DELETE': { color: 'red', text: '删除' },
      'HIDE': { color: 'orange', text: '隐藏' },
      'ASSIGN_ALIAS': { color: 'green', text: '别名' },
      'MERGE': { color: 'purple', text: '合并' },
      'ASSIGN_HOURS': { color: 'cyan', text: '分配课时' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 按操作类型分组记录
  const groupRecordsByType = (records) => {
    const groups = {
      'RENAME': [],
      'HIDE': [],
      'MERGE': [],
      'ASSIGN_HOURS': [],
      'OTHER': []
    };

    records.forEach(record => {
      if (groups[record.operationType]) {
        groups[record.operationType].push(record);
      } else {
        groups['OTHER'].push(record);
      }
    });

    return groups;
  };

  // 重命名和隐藏的列配置
  const renameHideColumns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => getOperationTypeTag(type),
      width: 70,
      align: 'center',
    },
    {
      title: '原名称',
      dataIndex: 'oldName',
      key: 'oldName',
      ellipsis: true,
      width: 80,
      align: 'center',
    },
    {
      title: '新名称',
      dataIndex: 'newName',
      key: 'newName',
      ellipsis: true,
      width: 80,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={2}>
          {record.operationType !== 'HIDE' && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
              title="编辑"
              style={{ padding: '1px 3px' }}
            />
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这条操作记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              title="删除"
              style={{ padding: '1px 3px' }}
            />
          </Popconfirm>
        </Space>
      ),
      width: 50,
      align: 'center',
    },
  ];

  // 隐藏操作的列配置
  const hideColumns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => getOperationTypeTag(type),
      width: 70,
      align: 'center',
    },
    {
      title: '学员名',
      dataIndex: 'oldName',
      key: 'oldName',
      ellipsis: true,
      width: 100,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={2}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            title="编辑"
            style={{ padding: '1px 3px' }}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这条操作记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              title="删除"
              style={{ padding: '1px 3px' }}
            />
          </Popconfirm>
        </Space>
      ),
      width: 50,
      align: 'center',
    },
  ];

  // 合并的列配置
  const mergeColumns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => getOperationTypeTag(type),
      width: 70,
      align: 'center',
    },
    {
      title: '原学员',
      dataIndex: 'oldName',
      key: 'oldName',
      ellipsis: true,
      width: 100,
      align: 'center',
    },
    {
      title: '合并为',
      dataIndex: 'newName',
      key: 'newName',
      ellipsis: true,
      width: 80,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={2}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            title="编辑"
            style={{ padding: '1px 3px' }}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这条操作记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              title="删除"
              style={{ padding: '1px 3px' }}
            />
          </Popconfirm>
        </Space>
      ),
      width: 50,
      align: 'center',
    },
  ];

  // 分配课时的列配置
  const assignHoursColumns = [
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      render: (type) => getOperationTypeTag(type),
      width: 70,
      align: 'center',
    },
    {
      title: '目标学员',
      dataIndex: 'oldName',
      key: 'oldName',
      ellipsis: true,
      width: 100,
      align: 'center',
    },
    {
      title: '源课程',
      dataIndex: 'newName',
      key: 'newName',
      ellipsis: true,
      width: 80,
      align: 'center',
    },
    {
      title: '分配详情',
      key: 'details',
      render: (_, record) => {
        try {
          const details = JSON.parse(record.details || '{}');
          const hoursPerStudent = details.hoursPerStudent || 1;
          const tooltipText = `${record.newName}每${hoursPerStudent}个课时消耗${record.oldName}1课时`;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span>{hoursPerStudent}</span>
              <Tooltip title={tooltipText}>
                <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '12px', cursor: 'help' }} />
              </Tooltip>
            </div>
          );
        } catch {
          return '详情解析失败';
        }
      },
      width: 70,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size={2}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
            title="编辑"
            style={{ padding: '1px 3px' }}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这条操作记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              title="删除"
              style={{ padding: '1px 3px' }}
            />
          </Popconfirm>
        </Space>
      ),
      width: 50,
      align: 'center',
    },
  ];

  return (
    <>
      <style>
        {`
          .compact-table .ant-table-thead > tr > th,
          .compact-table .ant-table-tbody > tr > td {
            padding: 8px 4px !important;
            font-size: 12px !important;
            text-align: center !important;
            vertical-align: middle !important;
            height: 36px !important;
            line-height: 20px !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }
          
          .compact-table .ant-table-thead > tr,
          .compact-table .ant-table-tbody > tr {
            height: 36px !important;
          }
          
          .compact-table {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-table {
            font-size: 12px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-table-wrapper {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-table-container {
            border-bottom: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-table-content {
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
            height: auto !important;
          }
          
          .compact-table .ant-table-body {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-table-tbody {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .compact-table .ant-spin-nested-loading,
          .compact-table .ant-spin-container {
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
            height: auto !important;
          }
          
          .compact-table .ant-table-tbody > tr > td .ant-tag {
            margin: 0 !important;
            height: auto !important;
            line-height: 1.2 !important;
            padding: 2px 6px !important;
            font-size: 11px !important;
          }
          
          .compact-table .ant-table-tbody > tr > td .ant-btn {
            margin: 0 2px !important;
            height: auto !important;
            line-height: 1.2 !important;
            padding: 2px 6px !important;
            font-size: 11px !important;
          }
        `}
      </style>
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {studentName ? `${studentName} - 操作记录` : '学员操作记录'}
            </span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={600}
        destroyOnClose
      >
      {(() => {
        const groupedRecords = groupRecordsByType(records);
        const sections = [
          { type: 'RENAME', title: '重命名操作', columns: renameHideColumns, records: groupedRecords.RENAME },
          { type: 'HIDE', title: '隐藏操作', columns: hideColumns, records: groupedRecords.HIDE },
          { type: 'MERGE', title: '合并操作', columns: mergeColumns, records: groupedRecords.MERGE },
          { type: 'ASSIGN_HOURS', title: '分配课时操作', columns: assignHoursColumns, records: groupedRecords.ASSIGN_HOURS },
          { type: 'OTHER', title: '其他操作', columns: renameHideColumns, records: groupedRecords.OTHER }
        ];

        // 检查是否有任何记录
        const hasAnyRecords = sections.some(section => section.records.length > 0);
        
        // 如果正在加载，显示loading状态
        if (loading) {
          return (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#999'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                color: '#d9d9d9'
              }}>
                ⏳
              </div>
              <div style={{
                fontSize: '16px',
                marginBottom: '8px',
                color: '#666'
              }}>
                正在加载操作记录...
              </div>
            </div>
          );
        }
        
        // 如果没有记录且不在加载中，显示空状态
        if (!hasAnyRecords) {
          return (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#999'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                color: '#d9d9d9'
              }}>
                📋
              </div>
              <div style={{
                fontSize: '16px',
                marginBottom: '8px',
                color: '#666'
              }}>
                暂无操作记录
              </div>
              <div style={{
                fontSize: '14px',
                color: '#999'
              }}>
                {studentName ? `学员"${studentName}"还没有任何操作记录` : '还没有任何操作记录'}
              </div>
            </div>
          );
        }

        return sections.map(section => {
          if (section.records.length === 0) return null;
          
          return (
            <div key={section.type} style={{ marginBottom: 16 }}>
              <h4 style={{ 
                margin: '0 0 8px 0', 
                padding: '6px 12px', 
                background: '#f5f5f5', 
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {section.title} ({section.records.length}条)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <Table
                  columns={section.columns}
                  dataSource={section.records}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={false}
                  style={{ 
                    fontSize: '12px',
                    marginBottom: 0,
                    minWidth: '300px'
                  }}
                  className="compact-table"
                />
              </div>
            </div>
          );
        });
      })()}

      {/* 编辑记录的模态框 */}
      <Modal
        title="编辑操作记录"
        open={!!editingRecord}
        onOk={handleSaveEdit}
        onCancel={() => setEditingRecord(null)}
        okText="保存"
        cancelText="取消"
      >
        {editingRecord && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label>操作类型：</label>
              {getOperationTypeTag(editingRecord.operationType)}
            </div>
            {editingRecord.operationType === 'HIDE' ? (
              // 隐藏操作只显示学员名称
              <div style={{ marginBottom: 16 }}>
                <label>学员名称：</label>
                <input
                  type="text"
                  value={editingRecord.oldName}
                  onChange={(e) => setEditingRecord({
                    ...editingRecord,
                    oldName: e.target.value
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                />
              </div>
            ) : editingRecord.operationType === 'ASSIGN_HOURS' ? (
              // 分配课时操作显示目标学员、源课程和分配详情
              <>
                <div style={{ marginBottom: 16 }}>
                  <label>目标学员：</label>
                  <input
                    type="text"
                    value={editingRecord.oldName}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      oldName: e.target.value
                    })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label>源课程：</label>
                  <input
                    type="text"
                    value={editingRecord.newName}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      newName: e.target.value
                    })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'rgba(0, 0, 0, 0.88)', fontSize: '14px' }}>
                      其中每
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={(() => {
                        try {
                          const details = JSON.parse(editingRecord.details || '{}');
                          return details.hoursPerStudent || 1;
                        } catch {
                          return 1;
                        }
                      })()}
                      onChange={(e) => {
                        const hoursPerStudent = parseFloat(e.target.value) || 1;
                        const details = JSON.stringify({ hoursPerStudent });
                        setEditingRecord({
                          ...editingRecord,
                          details
                        });
                      }}
                      style={{ width: '80px', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                    />
                    <span style={{ color: 'rgba(0, 0, 0, 0.88)', fontSize: '14px' }}>
                      课时消耗 {editingRecord.oldName} 1课时
                    </span>
                  </div>
                </div>
              </>
            ) : (
              // 其他操作显示原名称和新名称
              <>
                <div style={{ marginBottom: 16 }}>
                  <label>原名称：</label>
                  <input
                    type="text"
                    value={editingRecord.oldName}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      oldName: e.target.value
                    })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label>新名称：</label>
                  <input
                    type="text"
                    value={editingRecord.newName}
                    onChange={(e) => setEditingRecord({
                      ...editingRecord,
                      newName: e.target.value
                    })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      </Modal>
    </>
  );
};

export default StudentOperationRecordsModal;