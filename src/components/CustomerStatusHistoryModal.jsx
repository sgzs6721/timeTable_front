import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Timeline, Spin, message, Button, Space, Tag, DatePicker, TimePicker, Popconfirm } from 'antd';
import { ClockCircleOutlined, BellOutlined, EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { changeCustomerStatus, getCustomerStatusHistory, updateCustomerStatusHistory, deleteCustomerStatusHistory } from '../services/customerStatusHistory';
import { createTodo, getLatestTodoByCustomer, updateTodo } from '../services/todo';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const CustomerStatusHistoryModal = ({ visible, onCancel, customer, onSuccess, onTodoCreated }) => {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [histories, setHistories] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [showTodoReminder, setShowTodoReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState(null);
  const [reminderTime, setReminderTime] = useState(null);
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [existingTodoId, setExistingTodoId] = useState(null);

  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue({
        toStatus: customer.status
      });
      fetchHistory();
      fetchExistingTodo();
      setEditingHistoryId(null);
      setEditingNotes('');
    }
  }, [visible, customer]);

  const fetchExistingTodo = async () => {
    if (!customer) return;
    
    try {
      const response = await getLatestTodoByCustomer(customer.id);
      if (response && response.success && response.data) {
        // 有现有的待办，回显信息
        const todo = response.data;
        setExistingTodoId(todo.id);
        setShowTodoReminder(true);
        setReminderDate(todo.reminderDate ? dayjs(todo.reminderDate) : null);
        setReminderTime(todo.reminderTime ? dayjs(todo.reminderTime, 'HH:mm:ss') : null);
      } else {
        // 没有现有的待办，重置
        setExistingTodoId(null);
        setShowTodoReminder(false);
        setReminderDate(null);
        setReminderTime(null);
      }
    } catch (error) {
      console.error('获取待办信息失败:', error);
      // 失败时也重置
      setExistingTodoId(null);
      setShowTodoReminder(false);
      setReminderDate(null);
      setReminderTime(null);
    }
  };

  const fetchHistory = async () => {
    if (!customer) return;
    
    setFetchingHistory(true);
    try {
      const response = await getCustomerStatusHistory(customer.id);
      if (response && response.success) {
        setHistories(response.data || []);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleEditHistory = (history) => {
    setEditingHistoryId(history.id);
    setEditingNotes(history.notes || '');
  };

  const handleCancelEdit = () => {
    setEditingHistoryId(null);
    setEditingNotes('');
  };

  const handleSaveEdit = async (historyId) => {
    try {
      const response = await updateCustomerStatusHistory(historyId, {
        notes: editingNotes
      });

      if (response && response.success) {
        message.success('更新成功');
        setEditingHistoryId(null);
        setEditingNotes('');
        fetchHistory(); // 刷新历史记录
        
        // 通知父组件刷新客户卡片（更新最近流转信息）
        if (onSuccess) {
          // 重新获取历史记录以获取最新的备注
          const historyResponse = await getCustomerStatusHistory(customer.id);
          if (historyResponse && historyResponse.success) {
            const updatedHistories = historyResponse.data || [];
            const latestHistory = updatedHistories.length > 0 ? updatedHistories[0] : null;
            if (latestHistory) {
              onSuccess(latestHistory.toStatus, latestHistory.notes);
            }
          }
        }
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
      console.error('更新历史记录失败:', error);
    }
  };

  const handleDeleteHistory = async (historyId) => {
    try {
      const response = await deleteCustomerStatusHistory(historyId);

      if (response && response.success) {
        message.success('删除成功');
        fetchHistory(); // 刷新历史记录
        
        // 通知父组件刷新客户状态
        if (onSuccess) {
          // 重新获取历史记录以确定新的状态
          const historyResponse = await getCustomerStatusHistory(customer.id);
          if (historyResponse && historyResponse.success) {
            const updatedHistories = historyResponse.data || [];
            // 如果还有历史记录，状态应该是最新一条的toStatus，否则可能是null或初始状态
            const newStatus = updatedHistories.length > 0 ? updatedHistories[0].toStatus : null;
            const lastNote = updatedHistories.length > 0 ? updatedHistories[0].notes : null;
            onSuccess(newStatus, lastNote);
          }
        }
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('删除历史记录失败:', error);
    }
  };

  const handleSubmit = async (values) => {
    if (!customer) return;

    setLoading(true);
    try {
      // 如果选择的状态和当前状态一样，编辑最近一条历史记录
      if (values.toStatus === customer.status) {
        // 找到最近一条历史记录（第一条，因为按时间倒序）
        if (histories.length > 0) {
          const latestHistory = histories[0];
          const updateResponse = await updateCustomerStatusHistory(latestHistory.id, {
            notes: values.notes
          });
          
          if (updateResponse && updateResponse.success) {
            message.success('备注更新成功');
            fetchHistory(); // 刷新历史记录
            
            // 通知父组件刷新客户卡片
            if (onSuccess) {
              onSuccess(customer.status, values.notes);
            }
            
            // 如果设置了待办提醒，创建或更新待办
            if (showTodoReminder && reminderDate && reminderTime) {
              try {
                const todoData = {
                  customerId: customer.id,
                  customerName: customer.childName,
                  content: `跟进客户 ${customer.childName} - ${values.notes || '状态变更提醒'}`,
                  reminderDate: reminderDate.format('YYYY-MM-DD'),
                  reminderTime: reminderTime.format('HH:mm:ss'),
                  type: 'CUSTOMER_FOLLOW_UP',
                  status: 'PENDING'
                };

                let todoResponse;
                if (existingTodoId) {
                  // 更新现有待办
                  todoResponse = await updateTodo(existingTodoId, todoData);
                  if (todoResponse && todoResponse.success) {
                    message.success('待办提醒已更新');
                  }
                } else {
                  // 创建新待办
                  todoResponse = await createTodo(todoData);
                  if (todoResponse && todoResponse.success) {
                    message.success('待办提醒已创建');
                  }
                }
                
                if (todoResponse && todoResponse.success && onTodoCreated) {
                  onTodoCreated({
                    id: customer.id,
                    childName: customer.childName,
                    parentPhone: customer.parentPhone
                  });
                }
              } catch (error) {
                console.error('保存待办提醒失败:', error);
              }
            }
            
            form.resetFields();
            setShowTodoReminder(false);
            setReminderDate(null);
            setReminderTime(null);
            if (onSuccess) {
              onSuccess(values.toStatus, values.notes);
            }
            onCancel();
          } else {
            message.error(updateResponse?.message || '更新失败');
          }
        } else {
          message.warning('没有可编辑的历史记录');
        }
        return;
      }

      // 正常的状态变更
      const response = await changeCustomerStatus(customer.id, {
        toStatus: values.toStatus,
        notes: values.notes
      });

      if (response && response.success) {
        message.success('状态变更成功');
        
        // 如果设置了待办提醒，创建或更新待办
        if (showTodoReminder && reminderDate && reminderTime) {
          try {
            const todoData = {
              customerId: customer.id,
              customerName: customer.childName,
              content: `跟进客户 ${customer.childName} - ${values.notes || '状态变更提醒'}`,
              reminderDate: reminderDate.format('YYYY-MM-DD'),
              reminderTime: reminderTime.format('HH:mm:ss'),
              type: 'CUSTOMER_FOLLOW_UP',
              status: 'PENDING'
            };

            let todoResponse;
            if (existingTodoId) {
              // 更新现有待办
              todoResponse = await updateTodo(existingTodoId, todoData);
              if (todoResponse && todoResponse.success) {
                message.success('待办提醒已更新');
              }
            } else {
              // 创建新待办
              todoResponse = await createTodo(todoData);
              if (todoResponse && todoResponse.success) {
                message.success('待办提醒已创建');
              }
            }
            
            if (todoResponse && todoResponse.success && onTodoCreated) {
              // 通知外层：带上客户信息，便于局部刷新卡片上的铃铛与置灰状态
              onTodoCreated({
                id: customer.id,
                childName: customer.childName,
                parentPhone: customer.parentPhone
              });
            }
          } catch (error) {
            console.error('保存待办提醒失败:', error);
          }
        }
        
        form.resetFields();
        setShowTodoReminder(false);
        setReminderDate(null);
        setReminderTime(null);
        if (onSuccess) {
          onSuccess(values.toStatus, values.notes);
        }
        onCancel();
      } else {
        message.error(response?.message || '状态变更失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (selectedStatus) => {
    // 如果选择的状态和当前状态相同，回显最近一条历史记录的备注
    if (selectedStatus === customer?.status && histories.length > 0) {
      const latestHistory = histories[0];
      form.setFieldsValue({
        notes: latestHistory.notes || ''
      });
    }
    // 不再清空备注，保留用户输入的内容
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEW': 'blue',
      'CONTACTED': 'orange',
      'SCHEDULED': 'purple',
      'PENDING_CONFIRM': 'yellow',
      'VISITED': 'green',
      'SOLD': 'success',
      'RE_EXPERIENCE': 'cyan',
      'CLOSED': 'default'
    };
    return colors[status] || 'default';
  };

  // 获取所有状态选项，并标记哪些应该被禁用（当前状态之前的所有状态）
  const getAllStatusOptions = () => {
    const allOptions = [
      { value: 'NEW', label: '新建' },
      { value: 'CONTACTED', label: '已联系' },
      { value: 'PENDING_CONFIRM', label: '待确认' },
      { value: 'SCHEDULED', label: '待体验' },
      { value: 'VISITED', label: '已体验' },
      { value: 'RE_EXPERIENCE', label: '待再体验' },
      { value: 'SOLD', label: '已成交' },
      { value: 'CLOSED', label: '已结束' }
    ];

    // 找到当前状态在列表中的索引
    const currentStatusIndex = allOptions.findIndex(opt => opt.value === customer?.status);

    // 当前状态之前的所有状态都禁用，当前状态及之后的可选
    return allOptions.map((option, index) => ({
      ...option,
      disabled: index < currentStatusIndex
    }));
  };

  return (
    <Modal
      title={`状态流转记录 - ${customer?.childName || ''}`}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>切换状态</h3>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="toStatus"
            label="新状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select 
              placeholder="请选择新状态" 
              onChange={handleStatusChange}
              optionFilterProp="children"
            >
              {getAllStatusOptions().map(option => (
                <Option 
                  key={option.value} 
                  value={option.value}
                  disabled={option.disabled}
                >
                  <span style={{ color: option.disabled ? '#bfbfbf' : 'inherit' }}>
                    {option.label}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注信息"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入状态变更的相关信息，如联系结果、预约时间等" 
            />
          </Form.Item>

          <Form.Item>
            <div style={{ marginBottom: 12 }}>
              <Button 
                type="dashed"
                icon={<BellOutlined />}
                onClick={() => setShowTodoReminder(!showTodoReminder)}
                style={{ 
                  width: '100%',
                  borderColor: showTodoReminder ? '#1890ff' : undefined,
                  color: showTodoReminder ? '#1890ff' : undefined
                }}
              >
                {showTodoReminder ? '已开启待办提醒' : '设置待办提醒'}
              </Button>
            </div>
            
            {showTodoReminder && (
              <div style={{ 
                marginBottom: 12, 
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
              }}>
                <div style={{ marginBottom: 8, fontSize: '13px', color: '#666' }}>
                  <BellOutlined style={{ marginRight: 4 }} />
                  已设置提醒（点击客户卡片的铃铛图标可编辑）
                </div>
                <div style={{ fontSize: '14px', color: '#333' }}>
                  <div style={{ marginBottom: 4 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    提醒时间：{reminderDate?.format('YYYY-MM-DD')} {reminderTime?.format('HH:mm')}
                  </div>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  确认变更
                </Button>
                <Button danger onClick={onCancel}>
                  取消
                </Button>
              </Space>
            </div>
          </Form.Item>
        </Form>
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>历史记录</h3>
        {fetchingHistory ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
          </div>
        ) : histories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无状态变更记录
          </div>
        ) : (
          <Timeline>
            {histories.map((history) => {
              const isEditing = editingHistoryId === history.id;
              
              return (
                <Timeline.Item
                  key={history.id}
                  dot={<ClockCircleOutlined style={{ fontSize: '16px' }} />}
                >
                  <div
                    style={{
                      cursor: isEditing ? 'default' : 'pointer',
                      padding: '8px',
                      borderRadius: '4px',
                      backgroundColor: isEditing ? '#f0f5ff' : 'transparent',
                      transition: 'background-color 0.3s',
                      border: isEditing ? '1px solid #d9d9d9' : '1px solid transparent'
                    }}
                    onClick={() => !isEditing && handleEditHistory(history)}
                  >
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space>
                        {history.fromStatusText ? (
                          <>
                            <Tag color={getStatusColor(history.fromStatus)}>
                              {history.fromStatusText}
                            </Tag>
                            <span>→</span>
                          </>
                        ) : (
                          <span style={{ color: '#999' }}>初始状态 →</span>
                        )}
                        <Tag color={getStatusColor(history.toStatus)}>
                          {history.toStatusText}
                        </Tag>
                      </Space>
                      {!isEditing && (
                        <Space>
                          <EditOutlined 
                            style={{ fontSize: '12px', color: '#999', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditHistory(history);
                            }}
                          />
                          <Popconfirm
                            title="确定要删除这条历史记录吗？"
                            onConfirm={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(history.id);
                            }}
                            okText="确定"
                            cancelText="取消"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DeleteOutlined 
                              style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer' }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        </Space>
                      )}
                    </div>
                    
                    {isEditing ? (
                      <div style={{ marginBottom: 8 }}>
                        <TextArea
                          value={editingNotes}
                          onChange={(e) => setEditingNotes(e.target.value)}
                          placeholder="请输入备注信息"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          style={{ marginBottom: 8 }}
                        />
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<SaveOutlined />}
                            onClick={() => handleSaveEdit(history.id)}
                          >
                            保存
                          </Button>
                          <Button
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={handleCancelEdit}
                          >
                            取消
                          </Button>
                        </Space>
                      </div>
                    ) : (
                      <>
                        {history.notes && (
                          <div style={{ color: '#666', marginBottom: 4 }}>
                            {history.notes}
                          </div>
                        )}
                        <div style={{ color: '#999', fontSize: '12px' }}>
                          {history.createdByName} · {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </>
                    )}
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </div>
    </Modal>
  );
};

export default CustomerStatusHistoryModal;

