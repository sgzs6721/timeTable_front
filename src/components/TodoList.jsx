import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Empty, Spin, message, Popconfirm, Space, Timeline, DatePicker, TimePicker, Modal, Descriptions } from 'antd';
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
  UserOutlined,
  CalendarOutlined,
  EyeOutlined,
  PhoneOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { 
  getTodos, 
  markTodoAsRead, 
  markTodoAsCompleted, 
  deleteTodo,
  updateTodoReminderTime
} from '../services/todo';
import { getTrialCustomers } from '../services/customer';
import { cancelTrialSchedule } from '../services/customerStatusHistory';
import CustomerStatusHistoryModal from './CustomerStatusHistoryModal';
import dayjs from 'dayjs';
import './TodoList.css';

const TodoList = ({ onUnreadCountChange }) => {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('today'); // today, all, pending, completed, trials
  const [expandedHistory, setExpandedHistory] = useState({}); // 控制流转记录展开状态
  const [editingTimeId, setEditingTimeId] = useState(null); // 正在编辑时间的待办ID
  const [editingDate, setEditingDate] = useState(null); // 编辑中的日期
  const [editingTime, setEditingTime] = useState(null); // 编辑中的时间
  const [historyModalVisible, setHistoryModalVisible] = useState(false); // 状态流转模态框
  const [selectedCustomer, setSelectedCustomer] = useState(null); // 选中的客户
  const [trials, setTrials] = useState([]); // 待体验客户列表
  const [loadingTrials, setLoadingTrials] = useState(false); // 加载待体验客户
  const [trialDetailVisible, setTrialDetailVisible] = useState(false); // 体验详情模态框
  const [selectedTrial, setSelectedTrial] = useState(null); // 选中的待体验客户

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

  const fetchTrialCustomers = async () => {
    setLoadingTrials(true);
    try {
      const response = await getTrialCustomers();
      if (response && response.success) {
        setTrials(response.data || []);
      } else {
        setTrials([]);
        message.error(response.message || '获取待体验客户失败');
      }
    } catch (error) {
      console.error('获取待体验客户失败:', error);
      message.error('获取待体验客户失败');
    } finally {
      setLoadingTrials(false);
    }
  };

  // 当切换到体验tab时获取数据
  useEffect(() => {
    if (filter === 'trials') {
      fetchTrialCustomers();
    }
  }, [filter]);

  // 从待体验列表中取消体验
  const handleCancelTrialFromList = async (trial) => {
    try {
      message.loading({ content: '正在取消体验课程...', key: 'cancelTrial' });
      
      const response = await cancelTrialSchedule(
        trial.customerId,
        trial.historyId
      );
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已取消', key: 'cancelTrial' });
        // 刷新待体验列表
        fetchTrialCustomers();
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
    }
  };

  // 从待办流转记录中取消体验
  const handleCancelTrialFromHistory = async (todo, history) => {
    try {
      message.loading({ content: '正在取消体验课程...', key: 'cancelTrial' });
      
      const response = await cancelTrialSchedule(
        todo.customerId,
        history.id
      );
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已取消', key: 'cancelTrial' });
        // 刷新待办列表
        fetchTodos();
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
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
    // 状态流转成功后，重新获取待办列表以更新客户状态和流转记录
    if (selectedCustomer) {
      console.log('[TodoList] 流转记录添加成功，重新加载待办列表');
      await fetchTodos();
      
      // 关闭模态框
      setHistoryModalVisible(false);
      setSelectedCustomer(null);
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

  const handleViewTrialDetail = (trial) => {
    setSelectedTrial(trial);
    setTrialDetailVisible(true);
  };

  const renderTrialCard = (trial) => {
    return (
      <Card
        key={trial.customerId}
        style={{
          marginBottom: '16px',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: '16px' }}
        className="todo-card"
      >
        {/* 顶部：标题行和查看详情按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '16px', fontWeight: '500' }}>
              {trial.childName || '未命名'}
            </span>
            <Tag color={trial.status === 'SCHEDULED' ? 'purple' : 'cyan'}>
              {trial.statusText}
            </Tag>
          </div>
          {/* 联系方式 */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#666', flexShrink: 0 }}>
            <PhoneOutlined style={{ marginRight: '4px', fontSize: '13px' }} />
            <a 
              href={`tel:${trial.parentPhone}`}
              style={{ 
                fontSize: '13px', 
                fontFamily: 'Menlo, Monaco, Consolas, monospace',
                color: '#1890ff',
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {trial.parentPhone}
            </a>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyPhone(trial.parentPhone)}
              style={{ marginLeft: '4px', padding: '0 4px' }}
            />
          </div>
          <Button
            type="primary"
            size="small"
            onClick={() => handleViewTrialDetail(trial)}
            style={{ flexShrink: 0 }}
          >
            详情
          </Button>
        </div>

        {/* 体验时间 */}
        <div style={{ 
          marginBottom: '8px',
          padding: '8px',
          backgroundColor: trial.trialCancelled ? '#f5f5f5' : '#f0f5ff',
          borderRadius: '4px',
          border: trial.trialCancelled ? '1px solid #d9d9d9' : '1px solid #91caff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
            <CalendarOutlined style={{ color: trial.trialCancelled ? '#999' : '#1890ff', fontSize: '14px' }} />
            <span style={{ fontSize: '13px', color: '#666' }}>
              体验时间：
            </span>
            <span style={{ 
              fontSize: '13px', 
              fontWeight: 'bold', 
              color: trial.trialCancelled ? '#999' : '#1890ff',
              textDecoration: trial.trialCancelled ? 'line-through' : 'none'
            }}>
              {dayjs(trial.trialScheduleDate).format('YYYY-MM-DD')}
              {trial.trialStartTime && trial.trialEndTime && 
                ` ${trial.trialStartTime.substring(0, 5)}-${trial.trialEndTime.substring(0, 5)}`
              }
              {' '}
              {(() => {
                const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                return weekdays[dayjs(trial.trialScheduleDate).day()];
              })()}
            </span>
            {trial.trialCancelled && (
              <Tag color="default" style={{ marginLeft: 8 }}>已取消</Tag>
            )}
          </div>
          {trial.trialCancelled !== true && (
            <Popconfirm
              title="确定取消体验课程？"
              description="取消后将标记为已取消，如有权限也会从课表中删除"
              onConfirm={() => handleCancelTrialFromList(trial)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="text" 
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                style={{ marginLeft: 8 }}
              >
                取消
              </Button>
            </Popconfirm>
          )}
        </div>

        {/* 教练信息 */}
        {trial.trialCoachName && (
          <div style={{ fontSize: '13px', color: '#666' }}>
            <UserOutlined style={{ marginRight: '6px' }} />
            教练：{trial.trialCoachName}
          </div>
        )}
      </Card>
    );
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
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClockCircleOutlined />
                  {editingTimeId === todo.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      </Space>
                      <Space size="small">
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
                    </div>
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
                
                {/* 操作按钮 - 右对齐 */}
                <div style={{ display: 'flex', gap: '8px' }}>
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
            )}

            {isCompleted && todo.completedAt && (
              <div style={{ fontSize: '12px', color: '#999', marginTop: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                完成时间：{dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}
              </div>
            )}
          </div>
        </div>

        {/* 流转记录 - 独立区域 */}
        {(hasHistory || todo.customerNotes) && (
          <div style={{ 
            marginTop: 8, 
            paddingTop: 8, 
            borderTop: '1px solid #f0f0f0'
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
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              flexWrap: 'nowrap',
                              marginBottom: 4 
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <Tag color={
                                  fromLabel === '新建' ? "green" :
                                  fromLabel === '已联系' ? "blue" :
                                  fromLabel === '待确认' ? "gold" :
                                  fromLabel === '待体验' ? "orange" :
                                  fromLabel === '待再体验' ? "purple" :
                                  fromLabel === '已成交' ? "red" :
                                  fromLabel === '已流失' ? "default" :
                                  "geekblue"
                                } style={{ marginRight: 4, flexShrink: 0, width: '5em', display: 'inline-block', textAlign: 'center' }}>
                                  {fromLabel}
                                </Tag>
                                <span style={{ margin: '0 4px', flexShrink: 0 }}>→</span>
                                <Tag color={
                                  history.toStatusText === '新建' ? "green" :
                                  history.toStatusText === '已联系' ? "blue" :
                                  history.toStatusText === '待确认' ? "gold" :
                                  history.toStatusText === '待体验' ? "orange" :
                                  history.toStatusText === '待再体验' ? "purple" :
                                  history.toStatusText === '已成交' ? "red" :
                                  history.toStatusText === '已流失' ? "default" :
                                  "cyan"
                                } style={{ flexShrink: 0, width: '5em', display: 'inline-block', textAlign: 'center' }}>{history.toStatusText}</Tag>
                              </div>
                              <div style={{ 
                                color: '#999', 
                                fontSize: '11px', 
                                marginLeft: '8px', 
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                textAlign: 'right'
                              }}>
                                {history.createdByName && `${history.createdByName} · `}
                                {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                              </div>
                            </div>
                            {/* 如果是待体验状态且有体验时间，显示体验时间信息 */}
                            {(history.toStatus === 'SCHEDULED' || history.toStatus === 'RE_EXPERIENCE') && 
                             history.trialScheduleDate && history.trialStartTime && history.trialEndTime && (
                              <div style={{ 
                                marginTop: 12,
                                marginBottom: 4,
                                padding: '8px',
                                backgroundColor: history.trialCancelled ? '#f5f5f5' : '#f0f5ff',
                                borderRadius: '4px',
                                border: history.trialCancelled ? '1px solid #d9d9d9' : '1px solid #91caff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '11px', color: history.trialCancelled ? '#999' : '#1890ff', marginBottom: 4 }}>
                                    <CalendarOutlined style={{ marginRight: 4 }} />
                                    体验时间：
                                    {history.trialCancelled && (
                                      <Tag color="default" size="small" style={{ marginLeft: 8 }}>已取消</Tag>
                                    )}
                                  </div>
                                  <div style={{ 
                                    fontWeight: 'bold', 
                                    color: '#666', 
                                    fontSize: '11px',
                                    textDecoration: history.trialCancelled ? 'line-through' : 'none'
                                  }}>
                                    {dayjs(history.trialScheduleDate).format('YYYY-MM-DD')} {' '}
                                    {dayjs(history.trialStartTime, 'HH:mm:ss').format('HH:mm')}-
                                    {dayjs(history.trialEndTime, 'HH:mm:ss').format('HH:mm')}
                                  </div>
                                </div>
                                {history.trialCancelled !== true && (
                                  <Popconfirm
                                    title="确定取消体验课程？"
                                    description="取消后将标记为已取消，如有权限也会从课表中删除"
                                    onConfirm={() => handleCancelTrialFromHistory(todo, history)}
                                    okText="确定"
                                    cancelText="取消"
                                  >
                                    <Button 
                                      type="text" 
                                      danger
                                      size="small"
                                      icon={<CloseCircleOutlined />}
                                      style={{ marginLeft: 8 }}
                                    >
                                      取消
                                    </Button>
                                  </Popconfirm>
                                )}
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
                              <Tag color="green" style={{ marginRight: 4, width: '5em', display: 'inline-block', textAlign: 'center' }}>新建</Tag>
                            </div>
                            <div style={{ 
                              color: '#999', 
                              fontSize: '11px', 
                              marginLeft: '8px', 
                              whiteSpace: 'nowrap',
                              textAlign: 'right'
                            }}>
                              {todo.statusHistory.length > 0 && todo.statusHistory[todo.statusHistory.length - 1].createdByName && 
                                `${todo.statusHistory[todo.statusHistory.length - 1].createdByName} · `}
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
      </Card>
    );
  };

  return (
    <div style={{ padding: '12px', maxWidth: '100%', width: '100%' }}>
      {/* 顶部筛选tab - 支持左右滑动 */}
      <div 
        className="tab-scroll-container"
        style={{ 
          marginBottom: 16, 
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch'
        }}>
        <div style={{ 
          display: 'flex', 
          gap: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid rgba(217, 217, 217, 0.3)',
          minWidth: 'max-content'
        }}>
          <div 
            onClick={() => setFilter('all')}
            style={{
              minWidth: '80px',
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
            onClick={() => setFilter('trials')}
            style={{
              minWidth: '80px',
              padding: '8px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.3s',
              backgroundColor: filter === 'trials' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
              color: filter === 'trials' ? '#1890ff' : '#666',
              backdropFilter: filter === 'trials' ? 'blur(10px)' : 'none',
              border: filter === 'trials' ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
              whiteSpace: 'nowrap'
            }}
          >
            体验 (<span style={{ color: '#722ed1' }}>{trials.length}</span>)
          </div>
          <div 
            onClick={() => setFilter('today')}
            style={{
              minWidth: '80px',
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
              minWidth: '80px',
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
              minWidth: '80px',
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
      </div>

      {/* 待办列表 */}
      <div style={{ flex: 1 }}>
        {filter === 'trials' ? (
          // 体验列表
          loadingTrials ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin tip="加载中..." />
            </div>
          ) : trials.length === 0 ? (
            <Empty description="暂无待体验客户" style={{ padding: '50px 0' }} />
          ) : (
            <div>
              {trials.map(trial => renderTrialCard(trial))}
            </div>
          )
        ) : (
          // 待办列表
          loading ? (
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
          )
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

      {/* 体验详情模态框 */}
      <Modal
        title="体验详情"
        open={trialDetailVisible}
        onCancel={() => {
          setTrialDetailVisible(false);
          setSelectedTrial(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setTrialDetailVisible(false);
            setSelectedTrial(null);
          }}>
            关闭
          </Button>,
          selectedTrial && selectedTrial.trialCancelled !== true && (
            <Popconfirm
              key="cancel"
              title="确定取消体验课程？"
              description="取消后将标记为已取消，如有权限也会从课表中删除"
              onConfirm={() => {
                handleCancelTrialFromList(selectedTrial);
                setTrialDetailVisible(false);
                setSelectedTrial(null);
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<CloseCircleOutlined />}>
                取消体验
              </Button>
            </Popconfirm>
          )
        ]}
        width={500}
      >
        {selectedTrial && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="客户姓名">
              {selectedTrial.childName}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PhoneOutlined />
                <span style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
                  {selectedTrial.parentPhone}
                </span>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyPhone(selectedTrial.parentPhone)}
                />
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Space>
                <Tag color={selectedTrial.status === 'SCHEDULED' ? 'purple' : 'cyan'}>
                  {selectedTrial.statusText}
                </Tag>
                {selectedTrial.trialCancelled && (
                  <Tag color="default">已取消</Tag>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="体验日期">
              <span style={{ textDecoration: selectedTrial.trialCancelled ? 'line-through' : 'none' }}>
                {dayjs(selectedTrial.trialScheduleDate).format('YYYY年MM月DD日')}
                {' '}
                <span style={{ color: '#666' }}>
                  {(() => {
                    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                    return weekdays[dayjs(selectedTrial.trialScheduleDate).day()];
                  })()}
                </span>
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="体验时间">
              <span style={{ textDecoration: selectedTrial.trialCancelled ? 'line-through' : 'none' }}>
                {selectedTrial.trialStartTime && selectedTrial.trialEndTime && 
                  `${selectedTrial.trialStartTime.substring(0, 5)} - ${selectedTrial.trialEndTime.substring(0, 5)}`
                }
              </span>
            </Descriptions.Item>
            {selectedTrial.trialCoachName && (
              <Descriptions.Item label="体验教练">
                {selectedTrial.trialCoachName}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TodoList;

