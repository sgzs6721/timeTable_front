import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Empty, Spin, message, Popconfirm, Timeline, DatePicker, TimePicker, Select, Space, Input } from 'antd';
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
  PhoneOutlined,
  CloseCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { 
  getTodos, 
  markTodoAsRead, 
  markTodoAsCompleted, 
  deleteTodo,
  updateTodoReminderTime
} from '../services/todo';
import { getTrialCustomers } from '../services/customer';
import { 
  cancelTrialSchedule, 
  changeCustomerStatus,
  updateCustomerStatusHistory,
  deleteCustomerStatusHistory
} from '../services/customerStatusHistory';
import CustomerStatusHistoryModal from './CustomerStatusHistoryModal';
import CreateTodoModal from './CreateTodoModal';
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
  const [selectedCreator, setSelectedCreator] = useState(null); // 选中的录入人员ID
  const [trialDateFilter, setTrialDateFilter] = useState(null); // 体验日期过滤
  const [creatorsMap, setCreatorsMap] = useState({}); // 录入人员映射 {id: name}
  const [createModalVisible, setCreateModalVisible] = useState(false); // 新建待办模态框
  const [editingHistoryId, setEditingHistoryId] = useState(null); // 正在编辑的流转记录ID
  const [editingHistoryNotes, setEditingHistoryNotes] = useState(''); // 编辑中的流转记录备注

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
      if (todo.status === 'COMPLETED' || todo.status === 'CANCELLED') return false;
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
      // 构建查询参数
      const params = {};
      if (selectedCreator) {
        params.createdById = selectedCreator;
      }
      if (trialDateFilter) {
        params.trialDate = dayjs(trialDateFilter).format('YYYY-MM-DD');
      }
      
      const response = await getTrialCustomers(params);
      if (response && response.success) {
        const data = response.data || [];
        setTrials(data);
        
        // 如果是首次加载（没有过滤条件），提取所有录入人员映射
        if (!selectedCreator && !trialDateFilter && data.length > 0) {
          const map = {};
          data.forEach(t => {
            if (t.createdById && t.createdByName && !map[t.createdById]) {
              map[t.createdById] = t.createdByName;
            }
          });
          setCreatorsMap(map);
        }
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
    } else {
      // 切换到其他tab时清空体验过滤条件
      setSelectedCreator(null);
      setTrialDateFilter(null);
      setCreatorsMap({});
    }
  }, [filter]);

  // 当过滤条件改变时重新获取数据
  useEffect(() => {
    if (filter === 'trials') {
      fetchTrialCustomers();
    }
  }, [selectedCreator, trialDateFilter]);

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
        await fetchTrialCustomers();
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
    }
  };

  // 完成体验课程（标记为已体验）
  const handleCompleteTrialFromList = async (trial) => {
    try {
      message.loading({ content: '正在标记为已体验...', key: 'completeTrial' });
      
      // 调用状态变更接口，将状态改为 VISITED
      const response = await changeCustomerStatus(trial.customerId, {
        toStatus: 'VISITED',
        notes: '体验课程已完成'
      });
      
      if (response && response.success) {
        message.success({ content: '✓ 已标记为已体验', key: 'completeTrial' });
        // 刷新待体验列表
        await fetchTrialCustomers();
        // 刷新待办计数
        if (onUnreadCountChange) {
          const updatedTodos = await getTodos();
          if (updatedTodos && updatedTodos.success) {
            const todayCount = getTodayTodoCount(updatedTodos.data || []);
            onUnreadCountChange(todayCount);
          }
        }
      } else {
        message.error({ content: response.message || '标记失败', key: 'completeTrial' });
      }
    } catch (error) {
      console.error('完成体验课程失败:', error);
      message.error({ content: '标记为已体验失败', key: 'completeTrial' });
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
        await fetchTodos();
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

  const handleCreateSuccess = async (newTodo) => {
    // 新建待办成功后，重新获取待办列表
    await fetchTodos();
  };

  // 开始编辑流转记录
  const handleStartEditHistory = (history, e) => {
    if (e) {
      e.stopPropagation();
    }
    setEditingHistoryId(history.id);
    setEditingHistoryNotes(history.notes || '');
  };

  // 取消编辑流转记录
  const handleCancelEditHistory = () => {
    setEditingHistoryId(null);
    setEditingHistoryNotes('');
  };

  // 确认编辑流转记录
  const handleConfirmEditHistory = async (historyId) => {
    try {
      const response = await updateCustomerStatusHistory(historyId, {
        notes: editingHistoryNotes
      });
      if (response && response.success) {
        message.success('流转记录已更新');
        // 刷新待办列表
        await fetchTodos();
        handleCancelEditHistory();
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新流转记录失败:', error);
      message.error('更新失败');
    }
  };

  // 删除流转记录
  const handleDeleteHistory = async (historyId) => {
    try {
      const response = await deleteCustomerStatusHistory(historyId);
      if (response && response.success) {
        message.success('流转记录已删除');
        // 刷新待办列表
        await fetchTodos();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除流转记录失败:', error);
      message.error('删除失败');
    }
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
        if (todo.status === 'COMPLETED' || todo.status === 'CANCELLED') return false;
        if (!todo.reminderDate) return false;
        const reminderDay = dayjs(todo.reminderDate).format('YYYY-MM-DD');
        return reminderDay === today;
      });
    } else if (filter === 'pending') {
      return todos.filter(todo => todo.status !== 'COMPLETED' && todo.status !== 'CANCELLED');
    } else if (filter === 'completed') {
      return todos.filter(todo => todo.status === 'COMPLETED' || todo.status === 'CANCELLED');
    }
    // 默认返回今日待办
    const today = dayjs().format('YYYY-MM-DD');
    return todos.filter(todo => {
      if (todo.status === 'COMPLETED' || todo.status === 'CANCELLED') return false;
      if (!todo.reminderDate) return false;
      const reminderDay = dayjs(todo.reminderDate).format('YYYY-MM-DD');
      return reminderDay === today;
    });
  };

  const filteredTodos = getFilteredTodos();

  const toggleHistoryExpand = (todoId) => {
    setExpandedHistory(prev => ({
      ...prev,
      [todoId]: !prev[todoId]
    }));
  };

  const renderTrialCard = (trial) => {
    return (
      <Card
        key={trial.historyId}
        style={{
          marginBottom: '16px',
          borderRadius: '8px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden'
        }}
        styles={{ body: { padding: '16px' } }}
        className="todo-card"
      >
        {/* 顶部：标题行 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <Tag color={trial.status === 'SCHEDULED' ? 'purple' : 'cyan'}>
              {trial.statusText}
            </Tag>
            <span style={{ fontSize: '16px', fontWeight: '500' }}>
              {trial.childName || '未命名'}
            </span>
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
        </div>

        {/* 体验时间和教练信息框 */}
        <div style={{ 
          marginBottom: '8px',
          padding: '8px',
          backgroundColor: trial.trialCancelled ? '#f5f5f5' : (trial.trialCompleted ? '#f6ffed' : '#f0f5ff'),
          borderRadius: '4px',
          border: trial.trialCancelled ? '1px solid #d9d9d9' : (trial.trialCompleted ? '1px solid #95de64' : '1px solid #91caff')
        }}>
          {/* 第一行：体验时间信息（不换行） */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            marginBottom: '8px',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}>
            <CalendarOutlined style={{ 
              color: trial.trialCancelled ? '#999' : (trial.trialCompleted ? '#52c41a' : '#1890ff'), 
              fontSize: '14px', 
              flexShrink: 0 
            }} />
            <span style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>
              体验时间
            </span>
            {trial.trialCancelled ? (
              <Tag color="default" size="small" style={{ margin: 0, flexShrink: 0 }}>已取消</Tag>
            ) : trial.trialCompleted ? (
              <Tag color="success" size="small" style={{ margin: 0, flexShrink: 0 }}>已完成</Tag>
            ) : (
              <Tag color="processing" size="small" style={{ margin: 0, flexShrink: 0 }}>待体验</Tag>
            )}
            <span style={{ 
              fontSize: '13px', 
              fontWeight: 'bold', 
              color: trial.trialCancelled ? '#999' : (trial.trialCompleted ? '#52c41a' : '#1890ff'),
              textDecoration: trial.trialCancelled ? 'line-through' : 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap'
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
          </div>

          {/* 第二行：教练信息和操作按钮 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '13px', 
            color: '#666'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <UserOutlined style={{ marginRight: '6px' }} />
              教练：{trial.trialCoachName || '未指定'}
            </div>
            
            {/* 操作按钮（右对齐）- 只有待体验状态才显示 */}
            {!trial.trialCancelled && !trial.trialCompleted && (
              <div style={{ display: 'flex', gap: '8px' }}>
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
                  >
                    取消
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="确定标记为已体验？"
                  description="标记后客户状态将变更为已体验"
                  onConfirm={() => handleCompleteTrialFromList(trial)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ color: '#52c41a' }}
                  >
                    完成
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        </div>

        {/* 录入信息 */}
        {(trial.createdByName || trial.createdAt) && (
          <div style={{ 
            fontSize: '12px', 
            color: '#999',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {trial.createdByName && (
              <span>{trial.createdByName}</span>
            )}
            {trial.createdAt && (
              <span>
                录入于 {dayjs(trial.createdAt).format('YYYY-MM-DD HH:mm')}
              </span>
            )}
          </div>
        )}
      </Card>
    );
  };

  const renderTodoCard = (todo) => {
    const isCompleted = todo.status === 'COMPLETED';
    const isCancelled = todo.status === 'CANCELLED';
    const isProcessed = isCompleted || isCancelled; // 已完成或已取消都视为已处理
    const isUnread = !todo.isRead && !isProcessed;
    const isPast = todo.reminderDate && dayjs(todo.reminderDate).isBefore(dayjs(), 'day');
    const hasHistory = todo.statusHistory && todo.statusHistory.length > 0;
    const isHistoryExpanded = expandedHistory[todo.id];
    const isManualTodo = !todo.customerId; // 没有customerId的是手动创建的待办

    return (
      <Card
        className="todo-card"
        key={todo.id}
        style={{ 
          marginBottom: 12,
          borderLeft: isUnread ? '4px solid #1890ff' : isCompleted ? '4px solid #52c41a' : isCancelled ? '4px solid #faad14' : '4px solid #d9d9d9',
          backgroundColor: isUnread ? '#f0f5ff' : 'white',
          overflow: 'hidden'
        }}
        styles={{ body: { padding: '12px 16px 10px 16px', overflow: 'hidden' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: 4 }}>
                  {/* 手动创建的待办显示模式 */}
                  {isManualTodo && (
                    <>
                      <Tag color="orange" style={{ margin: 0, fontSize: '12px' }}>
                        手动创建
                      </Tag>
                      <span style={{ fontSize: '16px', color: '#000', fontWeight: 600 }}>
                        {todo.customerName}
                      </span>
                    </>
                  )}
                  {/* 从客源创建的待办显示模式 */}
                  {!isManualTodo && todo.customerName && (
                    <>
                      <span style={{ fontSize: '16px', color: '#000', fontWeight: 600 }}>
                        {todo.customerName}
                      </span>
                      {todo.customerSource && (
                        <Tag color="default" style={{ margin: 0, fontSize: '12px' }}>
                          📍 {todo.customerSource}
                        </Tag>
                      )}
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                {isUnread && (
                  <Tag color="blue" style={{ margin: 0, border: 'none' }} icon={<ExclamationCircleOutlined />}>未处理</Tag>
                )}
                {isCompleted && (
                  <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, border: 'none' }}>已完成</Tag>
                )}
                {isCancelled && (
                  <Tag color="orange" icon={<CloseCircleOutlined />} style={{ margin: 0, border: 'none' }}>已取消</Tag>
                )}
                {isPast && !isProcessed && (
                  <Tag color="red" style={{ margin: 0, border: 'none' }}>已逾期</Tag>
                )}
              </div>
            </div>

            {/* 状态标签和内容 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8, flexWrap: 'wrap' }}>
              {/* 状态标签 - 只对客源创建的待办显示 */}
              {!isManualTodo && todo.customerStatusText && (
                <Tag color="blue" style={{ margin: 0, fontSize: '12px' }}>
                  {todo.customerStatusText}
                </Tag>
              )}
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 400,
                textDecoration: 'none',
                color: isProcessed ? '#999' : '#000'
              }}>
                {todo.content}
              </span>
            </div>

            {todo.reminderDate && (
              <div style={{ 
                fontSize: '12px', 
                color: isPast && !isProcessed ? '#ff4d4f' : '#999',
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
                      {!isProcessed && (
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
                  {/* 只有客源创建的待办才显示转到客源和状态流转按钮 */}
                  {!isManualTodo && (
                    <>
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
                    </>
                  )}
                  {!isProcessed && (
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
            {isCancelled && todo.cancelledAt && (
              <div style={{ fontSize: '12px', color: '#999', marginTop: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CloseCircleOutlined style={{ color: '#faad14' }} />
                取消时间：{dayjs(todo.cancelledAt).format('YYYY-MM-DD HH:mm')}
              </div>
            )}
          </div>
        </div>

        {/* 流转记录 - 独立区域 - 只对客源创建的待办显示 */}
        {!isManualTodo && (hasHistory || todo.customerNotes) && (
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
                                <Tag 
                                  color={
                                    fromLabel === '新建' ? "green" :
                                    fromLabel === '已联系' ? "blue" :
                                    fromLabel === '待确认' ? "gold" :
                                    fromLabel === '待体验' ? "orange" :
                                    fromLabel === '待再体验' ? "purple" :
                                    fromLabel === '已成交' ? "red" :
                                    fromLabel === '已流失' ? "default" :
                                    "geekblue"
                                  } 
                                  style={{ marginRight: 4, flexShrink: 0, width: '5em', display: 'inline-block', textAlign: 'center' }}
                                >
                                  {fromLabel}
                                </Tag>
                                <span style={{ margin: '0 4px', flexShrink: 0 }}>→</span>
                                <Tag 
                                  color={
                                    history.toStatusText === '新建' ? "green" :
                                    history.toStatusText === '已联系' ? "blue" :
                                    history.toStatusText === '待确认' ? "gold" :
                                    history.toStatusText === '待体验' ? "orange" :
                                    history.toStatusText === '待再体验' ? "purple" :
                                    history.toStatusText === '已成交' ? "red" :
                                    history.toStatusText === '已流失' ? "default" :
                                    "cyan"
                                  } 
                                  style={{ flexShrink: 0, width: '5em', display: 'inline-block', textAlign: 'center' }}
                                >
                                  {history.toStatusText}
                                </Tag>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={(e) => handleStartEditHistory(history, e)}
                                  style={{ padding: '0 4px', height: '20px', color: '#1890ff' }}
                                  title="编辑备注"
                                />
                                <Popconfirm
                                  title="确定删除此流转记录？"
                                  onConfirm={() => handleDeleteHistory(history.id)}
                                  okText="确定"
                                  cancelText="取消"
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ padding: '0 4px', height: '20px' }}
                                    title="删除记录"
                                  />
                                </Popconfirm>
                              </div>
                            </div>
                            {/* 如果是待体验状态且有体验时间，显示体验时间信息 */}
                            {(history.toStatus === 'SCHEDULED' || history.toStatus === 'RE_EXPERIENCE') && 
                             history.trialScheduleDate && history.trialStartTime && history.trialEndTime && (
                              <div style={{ 
                                marginTop: 12,
                                marginBottom: 4,
                                padding: '8px',
                                backgroundColor: history.trialCancelled ? '#f5f5f5' : (history.trialCompleted ? '#f6ffed' : '#f0f5ff'),
                                borderRadius: '4px',
                                border: history.trialCancelled ? '1px solid #d9d9d9' : (history.trialCompleted ? '1px solid #95de64' : '1px solid #91caff'),
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: '#000',
                                    marginBottom: 4
                                  }}>
                                    <CalendarOutlined style={{ marginRight: 4 }} />
                                    体验时间：
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
                                {history.trialCancelled ? (
                                  <Tag color="default" size="small" style={{ marginLeft: 8 }}>已取消</Tag>
                                ) : history.trialCompleted ? (
                                  <Tag color="success" size="small" style={{ marginLeft: 8 }}>已完成</Tag>
                                ) : (
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
                            {/* 备注编辑/显示区域 */}
                            {editingHistoryId === history.id ? (
                              <div style={{ marginTop: 8 }}>
                                <Input.TextArea
                                  value={editingHistoryNotes}
                                  onChange={(e) => setEditingHistoryNotes(e.target.value)}
                                  placeholder="输入备注..."
                                  autoSize={{ minRows: 2, maxRows: 4 }}
                                  style={{ fontSize: '12px', marginBottom: 8 }}
                                />
                                <Space size="small">
                                  <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => handleConfirmEditHistory(history.id)}
                                  >
                                    确定
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={handleCancelEditHistory}
                                  >
                                    取消
                                  </Button>
                                </Space>
                              </div>
                            ) : (
                              <>
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
                                {/* 录入人和时间信息 */}
                                <div style={{ 
                                  color: '#999', 
                                  fontSize: '11px', 
                                  marginTop: history.notes && history.notes.trim() ? '8px' : '4px'
                                }}>
                                  {history.createdByName && `${history.createdByName} · `}
                                  {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                                </div>
                              </>
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
                          <div style={{ marginBottom: 4 }}>
                            <Tag color="green" style={{ width: '5em', display: 'inline-block', textAlign: 'center' }}>新建</Tag>
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
                          {/* 录入人和时间信息 */}
                          <div style={{ 
                            color: '#999', 
                            fontSize: '11px', 
                            marginTop: todo.customerNotes && todo.customerNotes.trim() ? '8px' : '4px'
                          }}>
                            {todo.statusHistory.length > 0 && todo.statusHistory[todo.statusHistory.length - 1].createdByName && 
                              `${todo.statusHistory[todo.statusHistory.length - 1].createdByName} · `}
                            {todo.statusHistory.length > 0 && todo.statusHistory[todo.statusHistory.length - 1].createdAt 
                              ? dayjs(todo.statusHistory[todo.statusHistory.length - 1].createdAt).format('YYYY-MM-DD HH:mm')
                              : ''}
                          </div>
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
          minWidth: 'max-content',
          alignItems: 'center'
        }}>
          {/* 新建按钮 */}
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
            style={{ 
              borderRadius: '6px',
              flexShrink: 0,
              height: '36px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            新建
          </Button>
          
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
                if (todo.status === 'COMPLETED' || todo.status === 'CANCELLED') return false;
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
            未处理 (<span style={{ color: '#ff4d4f' }}>{todos.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length}</span>)
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
            已处理 (<span style={{ color: '#52c41a' }}>{todos.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED').length}</span>)
          </div>
        </div>
      </div>

      {/* 体验过滤器 */}
      {filter === 'trials' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Select
              value={selectedCreator}
              onChange={(value) => setSelectedCreator(value)}
              placeholder="全部录入人员"
              style={{ flex: 1 }}
              size="large"
              allowClear
            >
              {Object.entries(creatorsMap).map(([id, name]) => (
                <Select.Option key={id} value={parseInt(id)}>{name}</Select.Option>
              ))}
            </Select>
            
            <DatePicker
              value={trialDateFilter}
              onChange={(date) => setTrialDateFilter(date)}
              placeholder="选择体验日期"
              style={{ flex: 1 }}
              size="large"
              allowClear
              format="YYYY-MM-DD"
            />
          </div>
        </div>
      )}

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

      {/* 新建待办模态框 */}
      <CreateTodoModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default TodoList;

