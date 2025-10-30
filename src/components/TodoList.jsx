import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Empty, Spin, message, Popconfirm, Space, Timeline, DatePicker, TimePicker } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
  EditOutlined,
  HistoryOutlined,
  UserOutlined
} from '@ant-design/icons';
import { 
  getTodos, 
  markTodoAsRead, 
  markTodoAsCompleted, 
  deleteTodo,
  updateTodoReminderTime
} from '../services/todo';
import CustomerStatusHistoryModal from './CustomerStatusHistoryModal';
import dayjs from 'dayjs';
import './TodoList.css';

const TodoList = ({ onUnreadCountChange }) => {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('today'); // today, all, pending, completed
  const [expandedHistory, setExpandedHistory] = useState({}); // 控制流转记录展开状态
  const [editingTimeId, setEditingTimeId] = useState(null); // 正在编辑时间的待办ID
  const [editingDate, setEditingDate] = useState(null); // 编辑中的日期
  const [editingTime, setEditingTime] = useState(null); // 编辑中的时间
  const [historyModalVisible, setHistoryModalVisible] = useState(false); // 状态流转模态框
  const [selectedCustomer, setSelectedCustomer] = useState(null); // 选中的客户

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone).then(() => message.success('手机号已复制'));
      } else {
        const input = document.createElement('input');
        input.value = phone;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        message.success('手机号已复制');
      }
    } catch (e) {
      console.error(e);
      message.error('复制失败');
    }
  };

  const handleGoToCustomer = (todo, e) => {
    if (e) {
      e.stopPropagation();
    }
    // 跳转到Dashboard的客源tab，并传递客户ID和客户名称
    const customerId = todo.customerId;
    const customerName = todo.customerName;
    if (customerId && customerName) {
      navigate(`/dashboard?tab=customers&customerId=${customerId}&customerName=${encodeURIComponent(customerName)}`);
    } else if (customerId) {
      navigate(`/dashboard?tab=customers&customerId=${customerId}`);
    } else {
      navigate('/dashboard?tab=customers');
    }
  };

  // 计算今日待办数量
  const getTodayTodoCount = (todoList) => {
    const today = dayjs().format('YYYY-MM-DD');
    return todoList.filter(todo => {
      if (todo.status === 'COMPLETED') return false;
      if (!todo.reminderDate) return false;
      const reminderDay = dayjs(todo.reminderDate).format('YYYY-MM-DD');
      return reminderDay === today;
    }).length;
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const response = await getTodos();
      if (response && response.success) {
        // 按创建时间倒序排列
        const sortedTodos = (response.data || []).sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        setTodos(sortedTodos);
        
        // 更新今日待办数量
        if (onUnreadCountChange) {
          const todayCount = getTodayTodoCount(sortedTodos);
          onUnreadCountChange(todayCount);
        }
      } else {
        message.error('获取待办列表失败');
      }
    } catch (error) {
      console.error('获取待办列表失败:', error);
      message.error('获取待办列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (todoId) => {
    try {
      const response = await markTodoAsRead(todoId);
      if (response && response.success) {
        setTodos(prevTodos => {
          const newTodos = prevTodos.map(todo => 
            todo.id === todoId ? { ...todo, isRead: true } : todo
          );
          
          // 更新今日待办数量
          if (onUnreadCountChange) {
            const todayCount = getTodayTodoCount(newTodos);
            onUnreadCountChange(todayCount);
          }
          
          return newTodos;
        });
        message.success('已标记为已读');
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      console.error('标记已读失败:', error);
      message.error('操作失败');
    }
  };

  const handleMarkAsCompleted = async (todoId) => {
    try {
      const response = await markTodoAsCompleted(todoId);
      if (response && response.success) {
        setTodos(prevTodos => {
          const newTodos = prevTodos.map(todo => 
            todo.id === todoId ? { ...todo, status: 'COMPLETED', completedAt: new Date().toISOString() } : todo
          );
          
          // 更新今日待办数量
          if (onUnreadCountChange) {
            const todayCount = getTodayTodoCount(newTodos);
            onUnreadCountChange(todayCount);
          }
          
          return newTodos;
        });
        message.success('已标记为完成');
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      console.error('标记完成失败:', error);
      message.error('操作失败');
    }
  };

  const handleDelete = async (todoId) => {
    try {
      const response = await deleteTodo(todoId);
      if (response && response.success) {
        setTodos(prevTodos => {
          const newTodos = prevTodos.filter(todo => todo.id !== todoId);
          
          // 更新今日待办数量
          if (onUnreadCountChange) {
            const todayCount = getTodayTodoCount(newTodos);
            onUnreadCountChange(todayCount);
          }
          
          return newTodos;
        });
        message.success('删除成功');
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleStartEditTime = (todo) => {
    setEditingTimeId(todo.id);
    setEditingDate(todo.reminderDate);
    setEditingTime(todo.reminderTime || '09:00:00');
  };

  const handleCancelEditTime = () => {
    setEditingTimeId(null);
    setEditingDate(null);
    setEditingTime(null);
  };

  const handleConfirmEditTime = async (todoId) => {
    if (!editingDate) {
      message.warning('请选择日期');
      return;
    }
    
    const dateStr = dayjs(editingDate).format('YYYY-MM-DD');
    const timeStr = editingTime || '09:00:00';
    const newDateTime = `${dateStr} ${timeStr}`;
    
    try {
      const response = await updateTodoReminderTime(todoId, newDateTime);
      if (response && response.success) {
        setTodos(prevTodos => {
          const newTodos = prevTodos.map(todo => {
            if (todo.id === todoId) {
              return { 
                ...todo, 
                reminderDate: dateStr,
                reminderTime: timeStr
              };
            }
            return todo;
          });
          
          // 更新今日待办数量
          if (onUnreadCountChange) {
            const todayCount = getTodayTodoCount(newTodos);
            onUnreadCountChange(todayCount);
          }
          
          return newTodos;
        });
        handleCancelEditTime();
        message.success('提醒时间已更新');
      } else {
        message.error('更新失败');
      }
    } catch (error) {
      console.error('更新提醒时间失败:', error);
      message.error('更新失败');
    }
  };

  const handleOpenHistory = (todo, e) => {
    if (e) {
      e.stopPropagation();
    }
    // 将todo转换为customer格式供CustomerStatusHistoryModal使用
    setSelectedCustomer({
      id: todo.customerId,
      childName: todo.customerName,
      parentPhone: todo.customerPhone,
      status: todo.customerStatus,
      source: todo.customerSource
    });
    setHistoryModalVisible(true);
  };

  const handleHistorySuccess = async (newStatus, lastChangeNote) => {
    // 状态流转成功后，更新待办列表中对应客户的状态
    if (selectedCustomer) {
      setTodos(prevTodos => 
        prevTodos.map(todo => {
          if (todo.customerId === selectedCustomer.id) {
            return {
              ...todo,
              customerStatus: newStatus || todo.customerStatus,
              customerStatusText: newStatus ? getStatusText(newStatus) : todo.customerStatusText
            };
          }
          return todo;
        })
      );
    }
  };

  const handleTodoUpdated = ({ todoId, reminderDate, reminderTime }) => {
    // 更新待办列表中的提醒时间
    setTodos(prevTodos => 
      prevTodos.map(todo => {
        if (todo.id === todoId) {
          return {
            ...todo,
            reminderDate,
            reminderTime
          };
        }
        return todo;
      })
    );
  };

  const getStatusText = (status) => {
    if (!status) return '未知';
    const statusMap = {
      'NEW': '新客户',
      'POTENTIAL': '潜在客户',
      'VISITED': '已到访',
      'TRIAL': '试课',
      'RE_EXPERIENCE': '待再体验',
      'SIGNED': '已签约',
      'DEFERRED': '延期',
      'LOST': '已流失',
      'PENDING_SOLD': '待售'
    };
    return statusMap[status] || status;
  };

  const getFilteredTodos = () => {
    if (filter === 'today') {
      // 今日待办：提醒日期是今天的未完成待办
      const today = dayjs().format('YYYY-MM-DD');
      return todos.filter(todo => {
        if (todo.status === 'COMPLETED') return false;
        if (!todo.reminderDate) return false;
        const reminderDay = dayjs(todo.reminderDate).format('YYYY-MM-DD');
        return reminderDay === today;
      });
    } else if (filter === 'pending') {
      return todos.filter(todo => todo.status !== 'COMPLETED');
    } else if (filter === 'completed') {
      return todos.filter(todo => todo.status === 'COMPLETED');
    }
    return todos;
  };

  const filteredTodos = getFilteredTodos();

  const toggleHistoryExpand = (todoId) => {
    setExpandedHistory(prev => ({
      ...prev,
      [todoId]: !prev[todoId]
    }));
  };

  const renderTodoCard = (todo) => {
    const isCompleted = todo.status === 'COMPLETED';
    const isUnread = !todo.isRead && !isCompleted;
    const isPast = todo.reminderDate && dayjs(todo.reminderDate).isBefore(dayjs(), 'day');
    const hasHistory = todo.statusHistory && todo.statusHistory.length > 0;
    const isHistoryExpanded = expandedHistory[todo.id];

    return (
      <Card
        className="todo-card"
        key={todo.id}
        style={{ 
          marginBottom: 12,
          borderLeft: isUnread ? '4px solid #1890ff' : isCompleted ? '4px solid #52c41a' : '4px solid #d9d9d9',
          backgroundColor: isUnread ? '#f0f5ff' : 'white',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: '12px 16px 10px 16px', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 4 }}>
                  {todo.customerName && (
                    <>
                      <span style={{ fontSize: '16px', color: '#000', fontWeight: 600 }}>
                        {todo.customerName}
                      </span>
                      {todo.customerPhone && (
                        <span style={{ fontSize: '14px', color: '#666', fontWeight: 400 }}>
                          <a 
                            href={`tel:${todo.customerPhone}`}
                            style={{ color: '#1890ff', textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {todo.customerPhone}
                          </a>
                          <CopyOutlined
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPhone(todo.customerPhone);
                            }}
                            style={{ marginLeft: 6, color: '#999', cursor: 'pointer', verticalAlign: 'middle' }}
                            title="复制手机号"
                          />
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* 状态和地点 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {todo.customerStatusText && (
                    <Tag color="blue" style={{ margin: 0, fontSize: '12px' }}>
                      {todo.customerStatusText}
                    </Tag>
                  )}
                  {todo.customerSource && (
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      📍 {todo.customerSource}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                {isUnread && (
                  <Tag color="blue" style={{ margin: 0, border: 'none' }} icon={<ExclamationCircleOutlined />}>未处理</Tag>
                )}
                {isCompleted && (
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, border: 'none' }}>已处理</Tag>
                )}
                {isPast && !isCompleted && (
                  <Tag color="red" style={{ margin: 0, border: 'none' }}>已逾期</Tag>
                )}
              </div>
            </div>

            <div style={{ 
              fontSize: '14px', 
              fontWeight: 400,
              marginBottom: 8,
              textDecoration: 'none',
              color: isCompleted ? '#999' : '#000'
            }}>
              {todo.content}
            </div>

            {todo.reminderDate && (
              <div style={{ 
                fontSize: '12px', 
                color: isPast && !isCompleted ? '#ff4d4f' : '#999',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ClockCircleOutlined />
                {editingTimeId === todo.id ? (
                  <Space size="small">
                    <DatePicker
                      value={editingDate ? dayjs(editingDate) : null}
                      format="YYYY-MM-DD"
                      size="small"
                      style={{ width: 130 }}
                      onChange={(date) => {
                        setEditingDate(date ? date.format('YYYY-MM-DD') : null);
                      }}
                    />
                    <TimePicker
                      value={editingTime ? dayjs(editingTime, 'HH:mm:ss') : null}
                      format="HH:mm"
                      size="small"
                      style={{ width: 80 }}
                      onChange={(time) => {
                        setEditingTime(time ? `${time.format('HH:mm')}:00` : null);
                      }}
                    />
                    <Button 
                      type="primary"
                      size="small" 
                      onClick={() => handleConfirmEditTime(todo.id)}
                    >
                      确定
                    </Button>
                    <Button 
                      size="small" 
                      onClick={handleCancelEditTime}
                    >
                      取消
                    </Button>
                  </Space>
                ) : (
                  <>
                    <span>
                      提醒时间：{dayjs(todo.reminderDate).format('YYYY-MM-DD')}
                      {todo.reminderTime && ` ${todo.reminderTime.substring(0, 5)}`}
                    </span>
                    {!isCompleted && (
                      <EditOutlined 
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditTime(todo);
                        }}
                        title="编辑时间"
                      />
                    )}
                  </>
                )}
              </div>
            )}

                  {isCompleted && todo.completedAt && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      完成时间：{dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  )}

            {/* 流转记录 */}
            {(hasHistory || todo.customerNotes) && (
              <div style={{ 
                marginTop: 16, 
                paddingTop: 12, 
                borderTop: '1px solid #f0f0f0',
                marginLeft: '-16px',
                marginRight: '-60px',
                paddingLeft: '16px',
                paddingRight: '60px'
              }}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: isHistoryExpanded ? 10 : 0
                  }}
                  onClick={() => toggleHistoryExpand(todo.id)}
                >
                  <span style={{ fontWeight: '500' }}>流转记录 ({hasHistory ? todo.statusHistory.length : 0})</span>
                  {isHistoryExpanded ? <UpOutlined style={{ fontSize: '10px' }} /> : <DownOutlined style={{ fontSize: '10px' }} />}
                </div>
                
                {isHistoryExpanded && (
                  <div className="history-scroll-container">
                    <Timeline
                      style={{ marginTop: 8, marginBottom: -12 }}
                      items={[
                        // 所有流转记录（过滤掉fromStatus和toStatus都是NEW的记录，因为底部有专门的新建记录）
                        ...(hasHistory ? todo.statusHistory.filter(history => {
                          const isFromNew = !history.fromStatus || history.fromStatus === 'null' || history.fromStatus === 'NEW';
                          const isToNew = history.toStatus === 'NEW';
                          return !(isFromNew && isToNew);
                        }).map((history, index, array) => {
                          const fromLabel = (!history.fromStatus || history.fromStatus === 'null' || history.fromStatus === 'NEW') ? '新建' : history.fromStatusText || '无';
                          
                          return {
                            color: 'blue',
                            children: (
                              <div style={{ 
                                fontSize: '12px', 
                                paddingBottom: 0
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <div>
                                    <Tag color={fromLabel === '新建' ? "green" : "default"} style={{ marginRight: 4 }}>
                                      {fromLabel}
                                    </Tag>
                                    <span style={{ margin: '0 4px' }}>→</span>
                                    <Tag color="blue">{history.toStatusText}</Tag>
                                  </div>
                                  <div style={{ color: '#999', fontSize: '11px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                                    {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                                    {history.createdByName && ` · ${history.createdByName}`}
                                  </div>
                                </div>
                                {/* 如果是待体验状态且有体验时间，显示体验安排信息 */}
                                {(history.toStatus === 'SCHEDULED' || history.toStatus === 'RE_EXPERIENCE') && 
                                 history.trialScheduleDate && history.trialStartTime && history.trialEndTime && (
                                  <div style={{ 
                                    marginTop: 4,
                                    marginBottom: 4,
                                    padding: '6px 8px',
                                    backgroundColor: '#f0f5ff',
                                    borderRadius: '4px',
                                    border: '1px solid #91caff'
                                  }}>
                                    <div style={{ fontSize: '11px', color: '#1890ff', marginBottom: 2 }}>
                                      📅 体验安排：
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>
                                      {dayjs(history.trialScheduleDate).format('YYYY-MM-DD')} {' '}
                                      {dayjs(history.trialStartTime, 'HH:mm:ss').format('HH:mm')}-
                                      {dayjs(history.trialEndTime, 'HH:mm:ss').format('HH:mm')}
                                    </div>
                                  </div>
                                )}
                                {history.notes && history.notes.trim() && (
                                  <div style={{ 
                                    color: '#666', 
                                    marginTop: 4,
                                    fontSize: '12px',
                                    lineHeight: '1.5'
                                  }}>
                                    {history.notes.trim()}
                                  </div>
                                )}
                              </div>
                            )
                          };
                        }) : []),
                        // 最底部：手动添加"新建"记录，显示客户notes
                        {
                          color: 'blue',
                          children: (
                            <div style={{ 
                              fontSize: '12px', 
                              paddingBottom: 0
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div>
                                  <Tag color="green" style={{ marginRight: 4 }}>新建</Tag>
                                </div>
                                <div style={{ color: '#999', fontSize: '11px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                                  {todo.statusHistory.length > 0 && todo.statusHistory[todo.statusHistory.length - 1].createdAt 
                                    ? dayjs(todo.statusHistory[todo.statusHistory.length - 1].createdAt).format('YYYY-MM-DD HH:mm')
                                    : ''}
                                </div>
                              </div>
                              {todo.customerNotes && todo.customerNotes.trim() && (
                                <div style={{ 
                                  color: '#666', 
                                  marginTop: 4,
                                  fontSize: '12px',
                                  lineHeight: '1.5'
                                }}>
                                  {todo.customerNotes.trim()}
                                </div>
                              )}
                            </div>
                          )
                        }
                      ]}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
            <Button 
              type="text" 
              size="small"
              icon={<UserOutlined />}
              title="转到客源"
              onClick={(e) => handleGoToCustomer(todo, e)}
              style={{ color: '#722ed1' }}
            />
            {todo.customerId && (
              <Button 
                type="text" 
                size="small"
                icon={<HistoryOutlined />}
                title="状态流转"
                onClick={(e) => handleOpenHistory(todo, e)}
                style={{ color: '#1890ff' }}
              />
            )}
            {!isCompleted && (
              <Popconfirm
                title="确定要标记为已处理吗？"
                onConfirm={() => handleMarkAsCompleted(todo.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  type="text" 
                  size="small"
                  icon={<CheckCircleOutlined />}
                  title="标记为完成"
                  style={{ color: '#52c41a' }}
                />
              </Popconfirm>
            )}
            <Popconfirm
              title="确定要删除这条待办吗？"
              onConfirm={() => handleDelete(todo.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="text" 
                size="small"
                danger
                icon={<DeleteOutlined />}
                title="删除"
              />
            </Popconfirm>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* 顶部筛选tab */}
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        gap: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        padding: '4px',
        borderRadius: '8px',
        border: '1px solid rgba(217, 217, 217, 0.3)'
      }}>
        <div 
          onClick={() => setFilter('all')}
          style={{
            flex: 1,
            padding: '8px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            backgroundColor: filter === 'all' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
            color: filter === 'all' ? '#1890ff' : '#666',
            backdropFilter: filter === 'all' ? 'blur(10px)' : 'none',
            border: filter === 'all' ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
            whiteSpace: 'nowrap'
          }}
        >
          全部
        </div>
        <div 
          onClick={() => setFilter('today')}
          style={{
            flex: 1,
            padding: '8px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            backgroundColor: filter === 'today' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
            color: filter === 'today' ? '#1890ff' : '#666',
            backdropFilter: filter === 'today' ? 'blur(10px)' : 'none',
            border: filter === 'today' ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
            whiteSpace: 'nowrap'
          }}
        >
          今日 (<span style={{ color: '#ff4d4f' }}>{(() => {
            const today = dayjs().format('YYYY-MM-DD');
            return todos.filter(todo => {
              if (todo.status === 'COMPLETED') return false;
              if (!todo.reminderDate) return false;
              const reminderDay = dayjs(todo.reminderDate).format('YYYY-MM-DD');
              return reminderDay === today;
            }).length;
          })()}</span>)
        </div>
        <div 
          onClick={() => setFilter('pending')}
          style={{
            flex: 1,
            padding: '8px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            backgroundColor: filter === 'pending' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
            color: filter === 'pending' ? '#1890ff' : '#666',
            backdropFilter: filter === 'pending' ? 'blur(10px)' : 'none',
            border: filter === 'pending' ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
            whiteSpace: 'nowrap'
          }}
        >
          未处理 (<span style={{ color: '#ff4d4f' }}>{todos.filter(t => t.status !== 'COMPLETED').length}</span>)
        </div>
        <div 
          onClick={() => setFilter('completed')}
          style={{
            flex: 1,
            padding: '8px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            backgroundColor: filter === 'completed' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
            color: filter === 'completed' ? '#1890ff' : '#666',
            backdropFilter: filter === 'completed' ? 'blur(10px)' : 'none',
            border: filter === 'completed' ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
            whiteSpace: 'nowrap'
          }}
        >
          已处理 (<span style={{ color: '#52c41a' }}>{todos.filter(t => t.status === 'COMPLETED').length}</span>)
        </div>
      </div>

      {/* 待办列表 */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : filteredTodos.length === 0 ? (
          <Empty 
            description={
              filter === 'all' ? '暂无待办' : 
              filter === 'today' ? '今日暂无待办事项' :
              filter === 'pending' ? '暂无待办事项' : 
              '暂无已处理事项'
            }
            style={{ padding: '50px 0' }}
          />
        ) : (
          <div>
            {filteredTodos.map(todo => renderTodoCard(todo))}
          </div>
        )}
      </div>

      {/* 状态流转模态框 */}
      <CustomerStatusHistoryModal
        visible={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        onSuccess={handleHistorySuccess}
        onTodoCreated={null}
        onTodoUpdated={handleTodoUpdated}
      />
    </div>
  );
};

export default TodoList;

