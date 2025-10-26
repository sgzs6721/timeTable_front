import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Empty, Spin, message, Popconfirm, Space, Timeline, Pagination } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  BellOutlined
} from '@ant-design/icons';
import { 
  getTodos, 
  markTodoAsRead, 
  markTodoAsCompleted, 
  deleteTodo
} from '../services/todo';
import dayjs from 'dayjs';
import './TodoList.css';

const TodoList = ({ onUnreadCountChange }) => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('today'); // today, all, pending, completed
  const [expandedHistory, setExpandedHistory] = useState({}); // 控制流转记录展开状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // 每页10个

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
          
          // 如果当前在"待办"筛选，标记完成后可能导致当前页数据减少
          if (filter === 'pending') {
            const newFilteredTodos = newTodos.filter(t => t.status !== 'COMPLETED');
            const maxPage = Math.ceil(newFilteredTodos.length / pageSize);
            if (currentPage > maxPage && maxPage > 0) {
              setCurrentPage(maxPage);
            }
          }
          
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
          
          // 如果删除后当前页没有数据了，跳转到上一页
          const newFilteredTodos = filter === 'pending' 
            ? newTodos.filter(t => t.status !== 'COMPLETED')
            : filter === 'completed' 
            ? newTodos.filter(t => t.status === 'COMPLETED')
            : newTodos;
          
          const maxPage = Math.ceil(newFilteredTodos.length / pageSize);
          if (currentPage > maxPage && maxPage > 0) {
            setCurrentPage(maxPage);
          }
          
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

  // 计算分页数据
  const totalTodos = filteredTodos.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTodos = filteredTodos.slice(startIndex, endIndex);

  // 当筛选条件变化时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {todo.customerName && (
                  <>
                    <span style={{ fontSize: '16px', color: '#000', fontWeight: 600 }}>
                      {todo.customerName}
                    </span>
                    {todo.customerPhone && (
                      <span style={{ fontSize: '14px', color: '#666', fontWeight: 400, marginLeft: '2em' }}>
                        {todo.customerPhone}
                        <CopyOutlined
                          onClick={() => handleCopyPhone(todo.customerPhone)}
                          style={{ marginLeft: 6, color: '#999', cursor: 'pointer', verticalAlign: 'middle' }}
                          title="复制手机号"
                        />
                      </span>
                    )}
                  </>
                )}
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
                gap: '4px'
              }}>
                <ClockCircleOutlined />
                提醒时间：{dayjs(todo.reminderDate).format('YYYY-MM-DD')}
                {todo.reminderTime && ` ${todo.reminderTime.substring(0, 5)}`}
              </div>
            )}

                  {isCompleted && todo.completedAt && (
                    <div style={{ fontSize: '12px', color: '#999', marginTop: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      完成时间：{dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  )}

            {/* 流转记录 */}
            {hasHistory && (
              <div style={{ 
                marginTop: 16, 
                paddingTop: 12, 
                borderTop: '1px solid #f0f0f0'
              }}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'flex-start',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: isHistoryExpanded ? 10 : 0,
                    position: 'relative',
                    paddingRight: 32
                  }}
                  onClick={() => toggleHistoryExpand(todo.id)}
                >
                  <span style={{ fontWeight: '500' }}>流转记录 ({todo.statusHistory.length})</span>
                  <span style={{ position: 'absolute', right: '-12px', top: '50%', transform: 'translateY(-50%)' }}>
                    {isHistoryExpanded ? <UpOutlined style={{ fontSize: '10px' }} /> : <DownOutlined style={{ fontSize: '10px' }} />}
                  </span>
                </div>
                
                {isHistoryExpanded && (
                  <div className="history-scroll-container">
                    <Timeline
                      style={{ marginTop: 8, marginBottom: -12 }}
                      items={todo.statusHistory.map((history, index, array) => ({
                        color: 'blue',
                        children: (
                          <div style={{ 
                            fontSize: '12px', 
                            paddingBottom: index === array.length - 1 ? '0px' : '4px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div>
                                <Tag color="default" style={{ marginRight: 4 }}>{history.fromStatusText || history.fromStatus || '无'}</Tag>
                                <span style={{ margin: '0 4px' }}>→</span>
                                <Tag color="blue">{history.toStatusText || history.toStatus}</Tag>
                              </div>
                              <div style={{ color: '#999', fontSize: '11px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                                {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                                {history.createdByName && ` · ${history.createdByName}`}
                              </div>
                            </div>
                            {history.notes && (
                              <div style={{ color: '#666', marginBottom: 4 }}>
                                备注：{history.notes}
                              </div>
                            )}
                          </div>
                        )
                      }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
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
      <div style={{ flex: 1, marginBottom: 16 }}>
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
            {paginatedTodos.map(todo => renderTodoCard(todo))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {filteredTodos.length > 0 && (
        <div style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ textAlign: 'center', marginBottom: 6, fontSize: '13px', color: '#666' }}>
            共 {totalTodos} 条，当前页 {startIndex + 1}-{Math.min(endIndex, totalTodos)} 条记录
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalTodos}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoList;

