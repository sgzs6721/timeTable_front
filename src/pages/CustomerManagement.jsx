import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  message, 
  Tag, 
  Space, 
  Popconfirm,
  Popover,
  Row,
  Col,
  Spin,
  Radio,
  DatePicker,
  TimePicker
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  HistoryOutlined,
  CalendarOutlined,
  CopyOutlined,
  BellOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  SaveOutlined,
  CloseOutlined,
  UserSwitchOutlined,
  UserOutlined
} from '@ant-design/icons';
import CustomerStatusHistoryModal from '../components/CustomerStatusHistoryModal';
import AssignCustomerModal from '../components/AssignCustomerModal';
import { 
  createCustomer, 
  getCustomers, 
  updateCustomer, 
  deleteCustomer, 
  getCustomersByStatus,
  assignCustomer as assignCustomerApi
} from '../services/customer';
import { createTodo, checkCustomerHasTodo, getTodos, updateTodo, deleteTodo, getLatestTodosByCustomers } from '../services/todo';
import { getTrialSchedule } from '../services/timetable';
import { getCustomerStatusHistory, updateCustomerStatusHistory, deleteCustomerStatusHistory, cancelTrialSchedule, completeTrialSchedule } from '../services/customerStatusHistory';
import { getApiBaseUrl } from '../config/api';
import dayjs from 'dayjs';
import './CustomerManagement.css';

const { Option } = Select;
const { TextArea } = Input;

const CustomerManagement = ({ user, onTodoCreated, highlightCustomerId, searchCustomerName, onShowTrialsList }, ref) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('all');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [todoCustomer, setTodoCustomer] = useState(null);
  const [todoReminderDate, setTodoReminderDate] = useState(null);
  const [todoReminderTime, setTodoReminderTime] = useState(null);
  const [todoContent, setTodoContent] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [salesFilter, setSalesFilter] = useState('all');
  const [currentDatePage, setCurrentDatePage] = useState(0);
  const [salesList, setSalesList] = useState([]);
  const [selectedFilterDate, setSelectedFilterDate] = useState(null);
  const [customerTodoStatus, setCustomerTodoStatus] = useState({});
  const [latestTodoByCustomer, setLatestTodoByCustomer] = useState({});
  const [todoInfoLoadingId, setTodoInfoLoadingId] = useState(null);
  const [trialScheduleCache, setTrialScheduleCache] = useState({});
  const [loadingTrialSchedule, setLoadingTrialSchedule] = useState(false);
  const [viewTodoModalVisible, setViewTodoModalVisible] = useState(false);
  const [viewTodoCustomer, setViewTodoCustomer] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSmartParse, setShowSmartParse] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchDebounceTimer = useRef(null);
  const [customerHistories, setCustomerHistories] = useState({});
  const [expandedHistories, setExpandedHistories] = useState({});
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingHistoryNotes, setEditingHistoryNotes] = useState('');
  const [editingTrialHistoryId, setEditingTrialHistoryId] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [editingTimeRange, setEditingTimeRange] = useState(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningCustomer, setAssigningCustomer] = useState(null);

  // 监听searchCustomerName参数，自动填入搜索框
  useEffect(() => {
    if (searchCustomerName) {
      const decodedName = decodeURIComponent(searchCustomerName);
      setSearchKeyword(decodedName);
      setSearchInputValue(decodedName);
    }
  }, [searchCustomerName]);

  // 监听highlightCustomerId变化，滚动到对应客户
  useEffect(() => {
    if (highlightCustomerId && customers.length > 0) {
      setTimeout(() => {
        const customerCard = document.getElementById(`customer-card-${highlightCustomerId}`);
        if (customerCard) {
          customerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 高亮效果
          customerCard.style.backgroundColor = '#e6f7ff';
          setTimeout(() => {
            customerCard.style.backgroundColor = '';
          }, 2000);
        }
      }, 300);
    }
  }, [highlightCustomerId, customers]);
  // 供外部调用：当其它地方创建了待办后，局部刷新某个客户的铃铛和数据
  React.useImperativeHandle(ref, () => ({
    onTodoCreatedExternally: ({ id, childName, parentPhone }) => {
      setCustomerTodoStatus(prev => ({ ...prev, [id]: true }));
      // 简单更新最新提醒缓存，避免再次点击为空
      setLatestTodoByCustomer(prev => ({
        ...prev,
        [id]: prev[id] || { customerId: id, customerName: childName, customerPhone: parentPhone }
      }));
    }
  }));

  const isAdmin = user?.position?.toUpperCase() === 'MANAGER';
  const isManager = user?.position?.toUpperCase() === 'MANAGER';
  const isSales = user?.position?.toUpperCase() === 'SALES';

  useEffect(() => {
    // 管理员和管理职位可以查看所有销售
    if (isAdmin || isManager) {
      fetchSalesList();
    }
    // 销售职位只能看自己的，设置筛选为自己
    if (isSales && user?.id) {
      setSalesFilter(user.id.toString());
    }
    // fetchCustomers 会由筛选条件的 useEffect 触发，无需在这里调用
  }, []);

  useEffect(() => {
    checkAllCustomerTodos();
    fetchAllCustomerHistories();
  }, [customers]);

  useEffect(() => {
    // 筛选条件变化时，重置分页并重新加载
    setCustomers([]);
    setCurrentPage(0);
    setHasMore(true);
    fetchCustomers(0, true);
  }, [activeTab, salesFilter, selectedFilterDate, searchKeyword]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, []);

  // 处理搜索输入变化（带防抖）
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchInputValue(value);
    
    // 清除之前的定时器
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    
    // 如果输入为空，立即更新searchKeyword以触发搜索
    if (value === '') {
      setSearchKeyword('');
      return;
    }
    
    // 设置新的定时器，500ms后更新searchKeyword触发搜索
    searchDebounceTimer.current = setTimeout(() => {
      setSearchKeyword(value);
    }, 500);
  };

  const fetchCustomers = async (page = currentPage, reset = false) => {
    if (!hasMore && !reset) return;
    
    // 防止并发请求
    if (loading || loadingMore) return;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const params = {
        page: page,
        pageSize: 20
      };
      
      // 添加过滤参数
      if (activeTab && activeTab !== 'all') {
        params.status = activeTab.toUpperCase();
      }
      
      if (salesFilter && salesFilter !== 'all') {
        params.salesId = parseInt(salesFilter);
      }
      
      if (selectedFilterDate) {
        params.filterDate = selectedFilterDate.format('YYYY-MM-DD');
      }
      
      if (searchKeyword) {
        params.keyword = searchKeyword;
      }
      
      const response = await getCustomers(params);
      if (response && response.success) {
        const newData = response.data || [];
        
        if (reset) {
          setCustomers(newData);
        } else {
          // 合并数据并去重（基于customer.id）
          setCustomers(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const uniqueNewData = newData.filter(c => !existingIds.has(c.id));
            return [...prev, ...uniqueNewData];
          });
        }
        
        // 如果返回的数据少于pageSize，说明没有更多数据了
        if (newData.length < 20) {
          setHasMore(false);
        }
        
        setCurrentPage(page + 1);
      } else {
        message.error('获取客户列表失败');
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const checkAllCustomerTodos = async () => {
    if (!customers || customers.length === 0) return;
    
    const todoStatus = {};
    const latestMap = {};
    
    try {
      // 使用新的批量接口，传入客户ID列表
      const customerIds = customers.map(c => c.id);
      const response = await getLatestTodosByCustomers(customerIds);
      
      if (response && response.success && response.data) {
        const allTodos = response.data || [];
        
        // 建立 customerId -> todo 的映射
        allTodos.forEach(todo => {
          if (todo.customerId) {
            latestMap[todo.customerId] = todo;
            todoStatus[todo.customerId] = true;
          }
        });
      }
    } catch (e) {
      console.error('批量获取客户待办失败:', e);
    }
    
    // 设置所有没有待办的客户状态为false
    customers.forEach(customer => {
      if (!todoStatus[customer.id]) {
        todoStatus[customer.id] = false;
      }
    });

    setCustomerTodoStatus(todoStatus);
    setLatestTodoByCustomer(latestMap);
  };

  const fetchAllCustomerHistories = async () => {
    if (!customers || customers.length === 0) return;
    
    const histories = {};
    
    // 并发获取所有客户的历史记录
    const promises = customers.map(async (customer) => {
      try {
        const response = await getCustomerStatusHistory(customer.id);
        if (response && response.success && response.data) {
          histories[customer.id] = response.data;
        }
      } catch (error) {
        console.error(`获取客户 ${customer.id} 的历史记录失败:`, error);
      }
    });
    
    await Promise.all(promises);
    setCustomerHistories(histories);
  };

  // 编辑历史记录
  const handleEditHistory = (history) => {
    setEditingHistoryId(history.id);
    setEditingHistoryNotes(history.notes || '');
  };

  // 取消编辑
  const handleCancelEditHistory = () => {
    setEditingHistoryId(null);
    setEditingHistoryNotes('');
  };

  // 保存编辑
  const handleSaveEditHistory = async (customerId, historyId) => {
    try {
      const response = await updateCustomerStatusHistory(historyId, {
        notes: editingHistoryNotes
      });

      if (response && response.success) {
        message.success('更新成功');
        setEditingHistoryId(null);
        setEditingHistoryNotes('');
        
        // 刷新该客户的历史记录
        const historyResponse = await getCustomerStatusHistory(customerId);
        if (historyResponse && historyResponse.success && historyResponse.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [customerId]: historyResponse.data
          }));
        }
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
      console.error('更新历史记录失败:', error);
    }
  };

  // 删除历史记录
  const handleDeleteHistory = async (customerId, historyId) => {
    try {
      const response = await deleteCustomerStatusHistory(historyId);

      if (response && response.success) {
        message.success('删除成功');
        
        // 刷新该客户的历史记录
        const historyResponse = await getCustomerStatusHistory(customerId);
        if (historyResponse && historyResponse.success && historyResponse.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [customerId]: historyResponse.data
          }));
        }
        
        // 同时更新客户列表中的状态（如果删除的是最新的记录）
        const updatedHistories = historyResponse?.data || [];
        if (updatedHistories.length > 0) {
          const latestHistory = updatedHistories[0];
          setCustomers(prevCustomers =>
            prevCustomers.map(c =>
              c.id === customerId
                ? {
                    ...c,
                    status: latestHistory.toStatus,
                    statusText: getStatusText(latestHistory.toStatus),
                    lastStatusChangeNote: latestHistory.notes,
                    lastStatusChangeTime: latestHistory.createdAt
                  }
                : c
            )
          );
        }
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('删除历史记录失败:', error);
    }
  };

  // 取消体验课程
  const handleCancelTrialSchedule = async (customerId, historyId) => {
    try {
      message.loading({ content: '正在取消体验课程...', key: 'cancelTrial' });
      
      const response = await cancelTrialSchedule(customerId, historyId);
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已取消', key: 'cancelTrial' });
        
        // 刷新该客户的历史记录
        const historyResponse = await getCustomerStatusHistory(customerId);
        if (historyResponse && historyResponse.success && historyResponse.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [customerId]: historyResponse.data
          }));
        }
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
    }
  };

  // 完成体验课程
  const handleCompleteTrialSchedule = async (customerId, historyId) => {
    try {
      message.loading({ content: '正在标记体验完成...', key: 'completeTrial' });
      
      const response = await completeTrialSchedule(customerId, historyId);
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已标记完成', key: 'completeTrial' });
        
        // 刷新该客户的历史记录
        const historyResponse = await getCustomerStatusHistory(customerId);
        if (historyResponse && historyResponse.success && historyResponse.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [customerId]: historyResponse.data
          }));
        }
      } else {
        message.error({ content: response.message || '标记失败', key: 'completeTrial' });
      }
    } catch (error) {
      console.error('标记体验完成失败:', error);
      message.error({ content: '标记体验完成失败', key: 'completeTrial' });
    }
  };

  // 开始编辑体验时间
  const handleStartEditTrial = (history) => {
    setEditingTrialHistoryId(history.id);
    setEditingDate(history.trialScheduleDate ? dayjs(history.trialScheduleDate) : null);
    if (history.trialStartTime && history.trialEndTime) {
      setEditingTimeRange([
        dayjs(history.trialStartTime, 'HH:mm:ss'),
        dayjs(history.trialEndTime, 'HH:mm:ss')
      ]);
    } else {
      setEditingTimeRange(null);
    }
  };

  // 保存编辑的体验时间
  const handleSaveEditTrial = async (customerId, history) => {
    if (!editingDate || !editingTimeRange || editingTimeRange.length !== 2) {
      message.warning('请选择完整的日期和时间');
      return;
    }

    setEditingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiBaseUrl()}/customers/${customerId}/status-history/${history.id}/update-trial-time`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trialScheduleDate: editingDate.format('YYYY-MM-DD'),
            trialStartTime: editingTimeRange[0].format('HH:mm:ss'),
            trialEndTime: editingTimeRange[1].format('HH:mm:ss')
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        message.success('体验时间已更新');
        setEditingTrialHistoryId(null);
        setEditingDate(null);
        setEditingTimeRange(null);
        
        // 刷新该客户的历史记录
        const historyResponse = await getCustomerStatusHistory(customerId);
        if (historyResponse && historyResponse.success && historyResponse.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [customerId]: historyResponse.data
          }));
        }
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新体验时间失败:', error);
      message.error('更新失败');
    } finally {
      setEditingLoading(false);
    }
  };

  // 取消编辑体验时间
  const handleCancelEditTrial = () => {
    setEditingTrialHistoryId(null);
    setEditingDate(null);
    setEditingTimeRange(null);
  };

  const fetchSalesList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data && data.success) {
        // 只获取销售人员
        const sales = (data.data || []).filter(u => u.position === 'SALES' || u.position === 'MANAGER');
        setSalesList(sales);
      }
    } catch (error) {
      console.error('获取销售人员列表失败:', error);
    }
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue({
      childName: customer.childName,
      parentPhone: customer.parentPhone,
      notes: customer.notes,
      source: customer.source
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await deleteCustomer(id);
      if (response && response.success) {
        message.success('删除成功');
        // 局部刷新：从列表中移除被删除的客户
        setCustomers(prevCustomers => prevCustomers.filter(c => c.id !== id));
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleOpenHistory = (customer, e) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedCustomer(customer);
    setHistoryModalVisible(true);
  };

  const handleHistorySuccess = async (newStatus, lastChangeNote) => {
    // 局部刷新：只更新当前客户的状态和流转记录
    if (selectedCustomer) {
      setCustomers(prevCustomers => 
        prevCustomers.map(c => {
          if (c.id === selectedCustomer.id) {
            return {
              ...c,
              status: newStatus || c.status, // 如果 newStatus 为 null，保持原状态
              statusText: newStatus ? getStatusText(newStatus) : c.statusText,
              lastStatusChangeNote: lastChangeNote !== undefined ? lastChangeNote : c.lastStatusChangeNote,
              lastStatusChangeTime: lastChangeNote !== undefined ? new Date().toISOString() : c.lastStatusChangeTime
            };
          }
          return c;
        })
      );
      
      // 刷新该客户的历史记录
      try {
        const response = await getCustomerStatusHistory(selectedCustomer.id);
        if (response && response.success && response.data) {
          setCustomerHistories(prev => ({
            ...prev,
            [selectedCustomer.id]: response.data
          }));
        }
      } catch (error) {
        console.error('刷新客户历史记录失败:', error);
      }
      
      // 更新待办状态
      if (newStatus) {
        await checkAllCustomerTodos();
      }
    }
  };

  const handleOpenTodoModal = async (customer, e) => {
    if (e) {
      e.stopPropagation();
    }
    setTodoCustomer(customer);
    
    // 检查是否有现有的待办，如果有则回显
    const existingTodo = latestTodoByCustomer[customer.id];
    if (existingTodo) {
      setEditingTodoId(existingTodo.id);
      setTodoContent(existingTodo.content || `跟进客户 ${customer.childName}`);
      setTodoReminderDate(existingTodo.reminderDate ? dayjs(existingTodo.reminderDate) : null);
      setTodoReminderTime(existingTodo.reminderTime ? dayjs(existingTodo.reminderTime, 'HH:mm:ss') : null);
    } else {
      setEditingTodoId(null);
      setTodoContent(`跟进客户 ${customer.childName}`);
      setTodoReminderDate(null);
      setTodoReminderTime(null);
    }
    
    setTodoModalVisible(true);
  };

  // 打开查看待办模态框
  const handleViewTodoModal = async (customer, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    // 如果没有缓存的待办信息，先获取
    if (!latestTodoByCustomer[customer.id]) {
      await fetchLatestTodoForCustomer(customer);
    }
    
    setViewTodoCustomer(customer);
    setViewTodoModalVisible(true);
  };

  // 从查看模态框切换到编辑模态框
  const handleSwitchToEditTodo = (customer) => {
    setViewTodoModalVisible(false);
    // 延迟一下，让关闭动画完成
    setTimeout(() => {
      handleOpenTodoModal(customer);
    }, 200);
  };

  // 取消提醒
  const handleCancelReminder = async (customer) => {
    if (!customer || !latestTodoByCustomer[customer.id]) return;
    
    try {
      const todoId = latestTodoByCustomer[customer.id].id;
      const response = await deleteTodo(todoId);
      
      if (response && response.success) {
        message.success('提醒已取消');
        
        // 更新本地状态
        setCustomerTodoStatus(prev => ({ ...prev, [customer.id]: false }));
        setLatestTodoByCustomer(prev => {
          const newState = { ...prev };
          delete newState[customer.id];
          return newState;
        });
        
        // 关闭模态框
        setViewTodoModalVisible(false);
        setViewTodoCustomer(null);
        
        // 不需要刷新整个页面，本地状态已更新
      } else {
        message.error('取消提醒失败');
      }
    } catch (error) {
      console.error('取消提醒失败:', error);
      message.error('取消提醒失败');
    }
  };

  const handleCreateTodo = async () => {
    if (!todoCustomer) return;
    
    if (!todoReminderDate) {
      message.warning('请选择提醒日期');
      return;
    }

    if (!todoReminderTime) {
      message.warning('请选择提醒时间');
      return;
    }

    if (!todoContent || todoContent.trim() === '') {
      message.warning('请输入待办内容');
      return;
    }

    try {
      const todoData = {
        customerId: todoCustomer.id,
        customerName: todoCustomer.childName,
        content: todoContent,
        reminderDate: todoReminderDate.format('YYYY-MM-DD'),
        reminderTime: todoReminderTime.format('HH:mm:ss'),
        type: 'CUSTOMER_FOLLOW_UP',
        status: 'PENDING'
      };

      let response;
      if (editingTodoId) {
        // 更新现有待办
        response = await updateTodo(editingTodoId, todoData);
        if (response && response.success) {
          message.success('待办提醒已更新');
        }
      } else {
        // 创建新待办
        response = await createTodo(todoData);
        if (response && response.success) {
          message.success('待办提醒已创建');
        }
      }

      if (response && response.success) {
        setTodoModalVisible(false);
        setTodoCustomer(null);
        setTodoContent('');
        setTodoReminderDate(null);
        setTodoReminderTime(null);
        setEditingTodoId(null);
        
        // 更新客户待办状态
        setCustomerTodoStatus(prev => ({
          ...prev,
          [todoCustomer.id]: true
        }));

        // 更新缓存的待办信息
        setLatestTodoByCustomer(prev => ({
          ...prev,
          [todoCustomer.id]: response.data
        }));
        
        // 刷新Dashboard的待办数量
        if (onTodoCreated) {
          onTodoCreated();
        }
      } else {
        message.error(response?.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleCopyCustomerInfo = (customer) => {
    let copyText = `${customer.childName}\n`;
    if (customer.parentPhone) {
      copyText += `${customer.parentPhone}\n`;
    }
    if (customer.source) {
      copyText += `地点：${customer.source}\n`;
    }
    copyText += `状态：${getStatusText(customer.status)}\n`;
    if (customer.notes) {
      copyText += `备注：${customer.notes}\n`;
    }
    
    // 只有当流转备注存在且与客户备注不同时才显示最近流转
    if (customer.lastStatusChangeNote && customer.lastStatusChangeNote !== customer.notes) {
      copyText += `\n最近流转：\n${getStatusText(customer.status)}：${customer.lastStatusChangeNote}`;
      if (customer.lastStatusChangeTime) {
        copyText += ` ${dayjs(customer.lastStatusChangeTime).format('MM-DD HH:mm')}`;
      }
      copyText += '\n';
    }

    navigator.clipboard.writeText(copyText).then(() => {
      message.success('客户信息已复制');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleOpenAssignModal = (customer, e) => {
    if (e) {
      e.stopPropagation();
    }
    setAssigningCustomer(customer);
    setAssignModalVisible(true);
  };

  const handleAssignCustomer = async (assignedUserId) => {
    if (!assigningCustomer) return;
    
    try {
      const response = await assignCustomerApi(assigningCustomer.id, assignedUserId);
      
      if (response && response.success) {
        message.success('分配成功');
        setAssignModalVisible(false);
        setAssigningCustomer(null);
        
        // 局部刷新：更新客户列表中的分配信息
        setCustomers(prevCustomers => 
          prevCustomers.map(c => 
            c.id === assigningCustomer.id 
              ? { ...c, assignedSalesId: assignedUserId, assignedSalesName: response.data.assignedSalesName }
              : c
          )
        );
      } else {
        message.error(response?.message || '分配失败');
      }
    } catch (error) {
      console.error('分配客户失败:', error);
      message.error('分配客户失败');
    }
  };

  const handleResetFilters = () => {
    setSalesFilter('all');
    setActiveTab('all');
    setSelectedFilterDate(null);
    setCurrentDatePage(0);
  };

  const handleSalesFilterChange = (value) => {
    setSalesFilter(value);
    setCurrentDatePage(0);
  };

  const handleActiveTabChange = (value) => {
    setActiveTab(value);
    setCurrentDatePage(0);
  };

  // 智能解析客户信息
  const handleSmartParse = () => {
    if (!parseText.trim()) {
      message.warning('请输入要解析的文本');
      return;
    }

    setParsing(true);
    
    try {
      // 解析逻辑：智能提取姓名、电话、微信、年龄、性别等信息
      let text = parseText.trim();
      
      // 1. 提取手机号（11位数字）
      const phoneMatch = text.match(/1[3-9]\d{9}/);
      const phone = phoneMatch ? phoneMatch[0] : '';
      
      // 2. 提取微信号（字母数字组合，长度6-20位）
      // 微信号规则：可以包含字母、数字、下划线、连字符
      let wechat = '';
      const wechatPattern = /[a-zA-Z]+[a-zA-Z0-9_-]{5,19}|[a-zA-Z0-9_-]*[a-zA-Z]+[0-9]+[a-zA-Z0-9_-]*|[a-zA-Z0-9_-]*[0-9]+[a-zA-Z]+[a-zA-Z0-9_-]*/g;
      const wechatMatches = text.match(wechatPattern);
      if (wechatMatches) {
        // 过滤掉手机号和纯数字
        for (const match of wechatMatches) {
          if (match.length >= 6 && 
              match.length <= 20 && 
              !/^1[3-9]\d{9}$/.test(match) && 
              !/^\d+$/.test(match) &&
              /[a-zA-Z]/.test(match) &&
              /\d/.test(match)) {
            wechat = match;
            break;
          }
        }
      }
      
      // 3. 去除开头的序号（如：1、1，1. 等）
      // 只有当开头不是手机号时才去除序号，限制为1-3位数字
      if (!text.match(/^1[3-9]\d{9}/)) {
        text = text.replace(/^\d{1,3}[，,、.\s]+/, '');
      }
      
      // 4. 按逗号、顿号或句号分割信息
      const parts = text.split(/[，,、。.]+/).map(p => p.trim()).filter(p => p && p.length > 0);
      
      // 5. 智能提取姓名：找2-4个连续中文字符，且不包含数字、不是电话号码、不是常见描述词
      let name = '';
      const excludeWords = ['男', '女', '岁', '周', '月', '日', '点', '分', '早', '晚', '上午', '下午', '时间', '有空', '方便'];
      for (const part of parts) {
        // 匹配2-4个中文字符
        const nameMatch = part.match(/^([一-龥]{2,4})$/);
        if (nameMatch && 
            !excludeWords.includes(nameMatch[1]) && 
            !/\d/.test(nameMatch[1]) && 
            !/1[3-9]\d{9}/.test(part)) {
          name = nameMatch[1];
          break;
        }
      }
      
      // 6. 如果没找到独立的姓名，尝试从复合文本中提取
      if (!name) {
        for (const part of parts) {
          // 匹配开头的2-4个中文字符（如"安安，5岁"中的"安安"）
          const nameMatch = part.match(/^([一-龥]{2,4})[，,\s]/);
          if (nameMatch && !excludeWords.includes(nameMatch[1])) {
            name = nameMatch[1];
            break;
          }
        }
      }
      
      // 7. 组合详细信息（保留所有信息，但去除已识别的电话和微信）
      let details = text;
      if (phoneMatch) {
        details = details.replace(phoneMatch[0], ''); // 去除电话
      }
      if (wechat) {
        details = details.replace(wechat, ''); // 去除微信号
      }
      details = details
        .replace(/^[，,、.。\s]+/, '') // 去除开头的标点和空格
        .replace(/[，,、.。\s]+$/, '') // 去除结尾的标点和空格
        .trim();
      
      // 8. 清理details中多余的逗号和空格
      details = details
        .replace(/[，,、]+/g, '，')
        .replace(/\s+/g, ' ')
        .replace(/^，+/, '')
        .replace(/，+$/, '')
        .trim();
      
      // 填充表单（优先使用手机号，没有手机号则使用微信号）
      const contactInfo = phone || wechat;
      form.setFieldsValue({
        childName: name,
        parentPhone: contactInfo,
        notes: details
      });
      
      if (name || contactInfo) {
        message.success('解析成功！请检查并完善信息');
      } else {
        message.warning('未能识别姓名或联系方式，请手动填写');
      }
      
      setShowSmartParse(false);
      setParseText('');
    } catch (error) {
      console.error('解析失败:', error);
      message.error('解析失败，请检查输入格式');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const customerData = {
        childName: values.childName,
        parentPhone: values.parentPhone,
        status: editingCustomer ? editingCustomer.status : 'NEW',
        notes: values.notes,
        source: values.source || null,
        // 自动带入当前用户机构ID
        organizationId: user?.organizationId,
      };

      let response;
      if (editingCustomer) {
        response = await updateCustomer(editingCustomer.id, customerData);
      } else {
        response = await createCustomer(customerData);
      }

      if (response && response.success) {
        message.success(editingCustomer ? '更新成功' : '创建成功');
        setModalVisible(false);
        
        if (!editingCustomer) {
          // 新建客户：重置列表并重新获取数据
          setCustomers([]);
          setCurrentPage(0);
          setHasMore(true);
          await fetchCustomers(0, true);
        } else {
          // 更新客户：局部刷新
          setCustomers(prevCustomers => 
            prevCustomers.map(c => c.id === response.data.id ? response.data : c)
          );
        }
      } else {
        message.error(response?.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEW': 'blue',
      'CONTACTED': 'orange',
      'SCHEDULED': 'purple',
      'PENDING_CONFIRM': 'volcano',
      'VISITED': 'green',
      'RE_EXPERIENCE': 'cyan',
      'PENDING_SOLD': 'lime',
      'SOLD': 'success',
      'CLOSED': 'default'
    };
    return colors[status] || 'default';
  };

  const fetchLatestTodoForCustomer = async (customerObj) => {
    try {
      if (!customerObj) return;
      setTodoInfoLoadingId(customerObj.id);
      const resp = await getTodos();
      const list = (resp && resp.success ? (resp.data || []) : [])
        .filter(t => {
          if (t.customerId != null) {
            return String(t.customerId) === String(customerObj.id);
          }
          const nameMatch = t.customerName === customerObj.childName;
          const phoneMatch = customerObj.parentPhone ? (t.customerPhone === customerObj.parentPhone) : true;
          return nameMatch && phoneMatch;
        });
      if (list.length > 0) {
        list.sort((a, b) => {
          const aKey = `${a.reminderDate || a.createdAt || ''} ${a.reminderTime || ''}`;
          const bKey = `${b.reminderDate || b.createdAt || ''} ${b.reminderTime || ''}`;
          return bKey.localeCompare(aKey);
        });
        setLatestTodoByCustomer(prev => ({ ...prev, [customerObj.id]: list[0] }));
      } else {
        setLatestTodoByCustomer(prev => ({ ...prev, [customerObj.id]: null }));
      }
    } catch (e) {
      console.error('获取客户待办信息失败:', e);
    } finally {
      setTodoInfoLoadingId(null);
    }
  };

  const fetchTrialScheduleForCustomer = async (customerObj) => {
    try {
      if (!customerObj || !customerObj.childName) return;
      setLoadingTrialSchedule(true);
      const resp = await getTrialSchedule(customerObj.childName);
      if (resp && resp.success && resp.data) {
        setTrialScheduleCache(prev => ({ ...prev, [customerObj.id]: resp.data }));
      } else {
        setTrialScheduleCache(prev => ({ ...prev, [customerObj.id]: null }));
      }
    } catch (e) {
      console.error('获取体验课程信息失败:', e);
      setTrialScheduleCache(prev => ({ ...prev, [customerObj.id]: null }));
    } finally {
      setLoadingTrialSchedule(false);
    }
  };

  const columns = [
    {
      title: '孩子姓名',
      dataIndex: 'childName',
      key: 'childName',
      width: 100,
      render: (name, record) => (
        <Button 
          type="link" 
          onClick={() => handleEdit(record)}
          style={{ padding: 0, height: 'auto' }}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '性别/年龄',
      key: 'genderAge',
      width: 90,
      render: (_, record) => {
        const gender = record.childGender === 'MALE' ? '男' : record.childGender === 'FEMALE' ? '女' : '';
        const age = record.childAge ? `${record.childAge}岁` : '';
        return gender || age ? `${gender}${age ? '/' + age : ''}` : '-';
      },
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 130,
      render: (_, record) => (
        <div>
          {record.parentPhone && (
            <div>
              <PhoneOutlined /> {record.parentPhone}
            </div>
          )}
          {record.wechat && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              微信: {record.wechat}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '家长',
      dataIndex: 'parentRelation',
      key: 'parentRelation',
      width: 60,
      render: (relation) => {
        if (relation === 'MOTHER') return '妈妈';
        if (relation === 'FATHER') return '爸爸';
        if (relation === 'OTHER') return '其他';
        return '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '分配销售',
      dataIndex: 'assignedSalesName',
      key: 'assignedSalesName',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个客户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const getStatusText = (status) => {
    const statusMap = {
      'NEW': '新建',
      'CONTACTED': '已联系',
      'SCHEDULED': '待体验',
      'PENDING_CONFIRM': '待确认',
      'VISITED': '已体验',
      'RE_EXPERIENCE': '待再体验',
      'PENDING_SOLD': '待成交',
      'SOLD': '已成交',
      'CLOSED': '已结束'
    };
    return statusMap[status] || status;
  };

  // 获取有数据的日期集合（用于日历禁用）
  const getAvailableDates = () => {
    const dateSet = new Set();
    let filtered = customers;

    // 应用销售人员过滤
    if (salesFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.createdBy === parseInt(salesFilter) || 
        customer.assignedSalesId === parseInt(salesFilter)
      );
    }

    // 应用状态过滤
    if (activeTab !== 'all') {
      filtered = filtered.filter(customer => customer.status === activeTab);
    }

    // 按姓名或电话搜索
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(customer => {
        const childName = (customer.childName || '').toLowerCase();
        const parentPhone = (customer.parentPhone || '').toLowerCase();
        return childName.includes(keyword) || parentPhone.includes(keyword);
      });
    }

    filtered.forEach(customer => {
      if (customer.createdAt) {
        const dateStr = dayjs(customer.createdAt).format('YYYY-MM-DD');
        dateSet.add(dateStr);
      }
    });

    return dateSet;
  };

  // 禁用没有数据的日期
  const disabledDate = (current) => {
    if (!current) return false;
    const availableDates = getAvailableDates();
    const dateStr = current.format('YYYY-MM-DD');
    return !availableDates.has(dateStr);
  };


  // 计算每个状态的客户数量
  const getStatusCount = (status) => {
    let filtered = customers;

    // 按销售人员过滤
    if (salesFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.createdBy === parseInt(salesFilter) || 
        customer.assignedSalesId === parseInt(salesFilter)
      );
    }

    // 按日期过滤
    if (selectedFilterDate) {
      const filterDateStr = dayjs(selectedFilterDate).format('YYYY-MM-DD');
      filtered = filtered.filter(customer => {
        const customerDateStr = dayjs(customer.createdAt).format('YYYY-MM-DD');
        return customerDateStr === filterDateStr;
      });
    }

    // 按姓名或电话搜索
    if (searchKeyword && searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter(customer => {
        const childName = (customer.childName || '').toLowerCase();
        const parentPhone = (customer.parentPhone || '').toLowerCase();
        return childName.includes(keyword) || parentPhone.includes(keyword);
      });
    }

    // 按状态过滤
    if (status !== 'all') {
      filtered = filtered.filter(customer => customer.status === status);
    }

    return filtered.length;
  };

  // 按日期分组客户
  const groupCustomersByDate = (customers) => {
    const groups = {};

    customers.forEach(customer => {
      const dateKey = dayjs(customer.createdAt).format('YYYY-MM-DD');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(customer);
    });

    // 按日期倒序排序
    const sortedGroups = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {});

    return sortedGroups;
  };

  // 格式化日期标题
  const formatDateTitle = (dateStr) => {
    const date = dayjs(dateStr);
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.day()];
    return `${dateStr} 星期${weekday}`;
  };

  // 按日期分组显示的客户
  const groupedCustomers = groupCustomersByDate(customers);
  const allDateKeys = Object.keys(groupedCustomers);

  // 加载更多数据
  const loadMoreData = () => {
    if (hasMore && !loadingMore) {
      fetchCustomers();
    }
  };

  const renderCustomerCard = (customer, key) => (
    <Col key={key} xs={24} sm={12} md={12} lg={12} xl={12}>
      <Card
        id={`customer-card-${customer.id}`}
        style={{ height: '100%', transition: 'background-color 0.5s ease' }}
        styles={{ body: { padding: '12px' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {customer.childName}
              </span>
              {customerTodoStatus[customer.id] && (
                <BellOutlined 
                  style={{ 
                    marginLeft: '8px', 
                    color: '#faad14',
                    fontSize: '14px',
                    cursor: 'pointer',
                    animation: 'pulse 2s infinite'
                  }} 
                  title="查看提醒"
                  onClick={(e) => {
                    handleViewTodoModal(customer, e);
                  }}
                />
              )}
              {customer.parentPhone && (
                <span style={{ fontSize: '13px', marginLeft: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <a 
                    href={`tel:${customer.parentPhone}`}
                    style={{ 
                      color: '#1890ff', 
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {customer.parentPhone}
                  </a>
                  <CopyOutlined 
                    style={{ cursor: 'pointer', fontSize: '12px', color: '#999' }} 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(customer.parentPhone).then(() => {
                        message.success('电话号码已复制');
                      }).catch(() => {
                        message.error('复制失败');
                      });
                    }}
                  />
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {customer.source && (
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {customer.source}
                </span>
              )}
              {(customer.status === 'SCHEDULED' || customer.status === 'RE_EXPERIENCE') ? (
                <Popover
                  content={
                    loadingTrialSchedule && !trialScheduleCache[customer.id] ? (
                      <Spin size="small" />
                    ) : trialScheduleCache[customer.id] && trialScheduleCache[customer.id].scheduleDate ? (
                      <div style={{ fontSize: '13px', color: '#333' }}>
                        {(() => {
                          const scheduleDate = dayjs(trialScheduleCache[customer.id].scheduleDate);
                          const weekdayMap = ['日', '一', '二', '三', '四', '五', '六'];
                          const weekday = weekdayMap[scheduleDate.day()];
                          const dateStr = scheduleDate.format('M.DD');
                          return `约周${weekday}，${dateStr}`;
                        })()}
                      </div>
                    ) : (
                      <div style={{ color: '#999', fontSize: '13px' }}>
                        暂无体验课安排
                      </div>
                    )
                  }
                  trigger="click"
                  onOpenChange={(visible) => {
                    if (visible && !trialScheduleCache[customer.id]) {
                      fetchTrialScheduleForCustomer(customer);
                    }
                  }}
                >
                  <Tag 
                    color={getStatusColor(customer.status)}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getStatusText(customer.status)}
                  </Tag>
                </Popover>
              ) : (
                <Tag color={getStatusColor(customer.status)}>
                  {getStatusText(customer.status)}
                </Tag>
              )}
            </div>
          </div>
          
          {customer.notes && (
            <div style={{ 
              color: '#000', 
              fontSize: '13px', 
              marginBottom: 4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {customer.notes}
            </div>
          )}

          {(() => {
            // 过滤掉初始的"新建"记录（toStatus是NEW且fromStatus为空或为NEW的记录）
            const filteredHistories = customerHistories[customer.id]?.filter(h => 
              !(h.toStatus === 'NEW' && (!h.fromStatus || h.fromStatus === 'NEW'))
            ) || [];
            
            if (filteredHistories.length === 0) return null;
            
            return (
              <div style={{ 
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px dashed #e8e8e8'
              }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  color: '#666', 
                  fontSize: '12px',
                  marginBottom: 4
                }}>
                  <span>最近流转：</span>
                  {filteredHistories.length > 1 && (
                    <span 
                      style={{ 
                        color: '#1890ff', 
                        fontSize: '11px', 
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedHistories(prev => ({
                          ...prev,
                          [customer.id]: !prev[customer.id]
                        }));
                      }}
                    >
                      {expandedHistories[customer.id] ? '收起' : `展开全部(${filteredHistories.length})`}
                    </span>
                  )}
                </div>
                
                {/* 显示历史记录 */}
                {filteredHistories.map((history, index) => {
                  // 只显示第一条，或者当展开时显示所有
                  if (index > 0 && !expandedHistories[customer.id]) {
                    return null;
                  }
                  
                  const isEditing = editingHistoryId === history.id;
                  
                  return (
                    <div 
                      key={history.id}
                      style={{ 
                        marginBottom: index < filteredHistories.length - 1 ? 12 : 0,
                        paddingBottom: index < filteredHistories.length - 1 ? 12 : 0,
                        ...(isEditing ? {
                          padding: '8px',
                          backgroundColor: '#f0f5ff',
                          borderRadius: '4px',
                          borderTop: '1px solid #d9d9d9',
                          borderRight: '1px solid #d9d9d9',
                          borderBottom: '1px solid #d9d9d9',
                          borderLeft: '1px solid #d9d9d9'
                        } : {
                          padding: '0',
                          backgroundColor: 'transparent',
                          borderRadius: '0',
                          borderBottom: index < filteredHistories.length - 1 && expandedHistories[customer.id] ? '1px dashed #f0f0f0' : 'none'
                        })
                      }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {history.fromStatusText && history.fromStatusText !== '无' && (
                            <>
                              <Tag 
                                color={getStatusColor(history.fromStatus)}
                                style={{ 
                                  margin: 0, 
                                  fontSize: '11px', 
                                  padding: '0 4px', 
                                  lineHeight: '18px',
                                  minWidth: '48px',
                                  textAlign: 'center'
                                }}
                              >
                                {history.fromStatusText}
                              </Tag>
                              <span style={{ color: '#999', fontSize: '11px' }}>→</span>
                            </>
                          )}
                          <Tag 
                            color={getStatusColor(history.toStatus)}
                            style={{ 
                              margin: 0, 
                              fontSize: '11px', 
                              padding: '0 4px', 
                              lineHeight: '18px',
                              minWidth: '48px',
                              textAlign: 'center'
                            }}
                          >
                            {history.toStatusText}
                          </Tag>
                        </div>
                      </div>
                      {isEditing ? (
                        <div style={{ marginTop: 8 }}>
                          <TextArea
                            value={editingHistoryNotes}
                            onChange={(e) => setEditingHistoryNotes(e.target.value)}
                            placeholder="请输入备注信息"
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            style={{ marginBottom: 8 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Space>
                            <Button
                              type="primary"
                              size="small"
                              icon={<SaveOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEditHistory(customer.id, history.id);
                              }}
                            >
                              保存
                            </Button>
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEditHistory();
                              }}
                            >
                              取消
                            </Button>
                          </Space>
                        </div>
                      ) : (
                        <>
                          {history.notes && (
                            <div style={{ 
                              color: '#999', 
                              fontSize: '12px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: '1.6',
                              marginTop: 2
                            }}>
                              {history.notes}
                            </div>
                          )}
                          
                          {/* 录入人和时间信息 + 编辑删除按钮 */}
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: history.notes ? '6px' : '2px'
                          }}>
                            <div style={{ 
                              color: '#bbb', 
                              fontSize: '11px'
                            }}>
                              {history.createdByName && `${history.createdByName} `}
                              {dayjs(history.createdAt).format('YYYY-MM-DD HH:mm')}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <EditOutlined 
                                style={{ fontSize: '12px', color: '#1890ff', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditHistory(history);
                                }}
                              />
                              <Popconfirm
                                title="确定要删除这条历史记录吗？"
                                onConfirm={(e) => {
                                  e?.stopPropagation();
                                  handleDeleteHistory(customer.id, history.id);
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
                            </div>
                          </div>
                          
                          {/* 如果是待体验状态且有体验时间，显示体验时间信息 */}
                          {(history.toStatus === 'SCHEDULED' || history.toStatus === 'RE_EXPERIENCE') && 
                           history.trialScheduleDate && history.trialStartTime && history.trialEndTime && (
                            <div style={{ 
                              marginTop: 8,
                              padding: '8px',
                              backgroundColor: history.trialCancelled ? '#f5f5f5' : (history.trialCompleted ? '#f6ffed' : '#f0f5ff'),
                              borderRadius: '4px',
                              borderTop: history.trialCancelled ? '1px solid #d9d9d9' : (history.trialCompleted ? '1px solid #95de64' : '1px solid #91caff'),
                              borderRight: history.trialCancelled ? '1px solid #d9d9d9' : (history.trialCompleted ? '1px solid #95de64' : '1px solid #91caff'),
                              borderBottom: history.trialCancelled ? '1px solid #d9d9d9' : (history.trialCompleted ? '1px solid #95de64' : '1px solid #91caff'),
                              borderLeft: history.trialCancelled ? '1px solid #d9d9d9' : (history.trialCompleted ? '1px solid #95de64' : '1px solid #91caff'),
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div style={{ flex: 1 }}>
                                {editingTrialHistoryId === history.id ? (
                                  <div style={{ marginBottom: 4 }}>
                                    <div style={{ fontSize: '11px', color: '#000', marginBottom: 4 }}>
                                      <CalendarOutlined style={{ marginRight: 4 }} />
                                      时间：
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: 8 }}>
                                      <DatePicker
                                        value={editingDate}
                                        onChange={setEditingDate}
                                        format="YYYY-MM-DD"
                                        style={{ flex: 1, fontSize: '11px' }}
                                        size="small"
                                        inputReadOnly
                                      />
                                      <TimePicker.RangePicker
                                        value={editingTimeRange}
                                        onChange={(times) => {
                                          console.log('Time changed:', times);
                                          setEditingTimeRange(times);
                                        }}
                                        onSelect={(times) => {
                                          console.log('Time selected:', times);
                                          setEditingTimeRange(times);
                                        }}
                                        format="HH:mm"
                                        style={{ flex: 1, fontSize: '11px' }}
                                        size="small"
                                        minuteStep={30}
                                        showNow={false}
                                        inputReadOnly
                                        needConfirm={true}
                                        disabledMinutes={() => {
                                          const allMinutes = Array.from({ length: 60 }, (_, i) => i);
                                          return allMinutes.filter(m => m !== 0 && m !== 30);
                                        }}
                                        hideDisabledOptions={false}
                                        popupClassName="show-all-minutes-picker"
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      <Button 
                                        size="small" 
                                        icon={<SaveOutlined />}
                                        type="primary"
                                        loading={editingLoading}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveEditTrial(customer.id, history);
                                        }}
                                      >
                                        保存
                                      </Button>
                                      <Button 
                                        size="small" 
                                        icon={<CloseOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCancelEditTrial();
                                        }}
                                        disabled={editingLoading}
                                      >
                                        取消
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: '#000',
                                    marginBottom: 4
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <CalendarOutlined style={{ marginRight: 4 }} />
                                      时间：
                                      <span style={{ 
                                        fontSize: '11px', 
                                        color: '#666',
                                        textDecoration: history.trialCancelled ? 'line-through' : 'none',
                                        marginLeft: '4px'
                                      }}>
                                        {dayjs(history.trialScheduleDate).format('YYYY-MM-DD')} {' '}
                                        {dayjs(history.trialStartTime, 'HH:mm:ss').format('HH:mm')}-
                                        {dayjs(history.trialEndTime, 'HH:mm:ss').format('HH:mm')}
                                      </span>
                                      {!history.trialCancelled && !history.trialCompleted && (
                                        <EditOutlined
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartEditTrial(history);
                                          }}
                                          style={{ 
                                            color: '#1890ff', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            marginLeft: '4px'
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )}
                                {history.trialCoachName && (
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: '#666',
                                    marginTop: 4
                                  }}>
                                    <UserOutlined style={{ marginRight: 4 }} />
                                    教练：{history.trialCoachName}
                                  </div>
                                )}
                              </div>
                              {editingTrialHistoryId === history.id ? null : (
                                history.trialCancelled ? (
                                  <Tag color="default" size="small" style={{ marginLeft: 8 }}>已取消</Tag>
                                ) : history.trialCompleted ? (
                                  <Tag color="success" size="small" style={{ marginLeft: 8 }}>已完成</Tag>
                                ) : (
                                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                                    <Popconfirm
                                      title="确定取消体验课程？"
                                      description="取消后将标记为已取消"
                                      onConfirm={(e) => {
                                        e?.stopPropagation();
                                        handleCancelTrialSchedule(customer.id, history.id);
                                      }}
                                      okText="确定"
                                      cancelText="取消"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button 
                                        type="text" 
                                        danger
                                        size="small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        取消
                                      </Button>
                                    </Popconfirm>
                                    <Popconfirm
                                      title="确定标记为已完成？"
                                      onConfirm={(e) => {
                                        e?.stopPropagation();
                                        handleCompleteTrialSchedule(customer.id, history.id);
                                      }}
                                      okText="确定"
                                      cancelText="取消"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button 
                                        type="primary"
                                        size="small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                      完成
                                    </Button>
                                    </Popconfirm>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          {/* 录入人和时间信息 */}
          <div style={{ display: 'flex', gap: '8px', color: '#999', fontSize: '12px', alignItems: 'center' }}>
            {customer.createdByName && (
              <span>{customer.createdByName}</span>
            )}
            {customer.createdAt && (
              <span>{dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm')}</span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <Button 
              type="text"
              icon={<HistoryOutlined />}
              title="状态流转记录"
              onClick={(e) => handleOpenHistory(customer, e)}
              size="small"
            />
            {customerTodoStatus[customer.id] ? (
              <Button 
                type="text"
                icon={<BellOutlined />}
                title="查看提醒"
                onClick={(e) => {
                  handleViewTodoModal(customer, e);
                }}
                size="small"
                style={{ 
                  color: '#faad14',
                  cursor: 'pointer'
                }}
              />
            ) : (
              <Button 
                type="text"
                icon={<BellOutlined />}
                title="设置待办提醒"
                onClick={(e) => {
                  handleOpenTodoModal(customer, e);
                }}
                size="small"
                style={{ 
                  color: '#faad14',
                  cursor: 'pointer'
                }}
              />
            )}
            <Button 
              type="text"
              icon={<CopyOutlined />}
              title="复制客户信息"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCustomerInfo(customer);
              }}
              size="small"
            />
            <Button 
              type="text"
              icon={<UserSwitchOutlined />}
              title={customer.assignedSalesId && customer.assignedSalesId !== user?.id 
                ? `已分配给：${customer.assignedSalesName || '其他人'}（点击重新分配）` 
                : "分配客户"}
              onClick={(e) => handleOpenAssignModal(customer, e)}
              size="small"
              style={{ 
                color: customer.assignedSalesId && customer.assignedSalesId !== user?.id ? '#faad14' : '#52c41a',
                cursor: 'pointer'
              }}
            />
            <Button 
              type="text"
              icon={<EditOutlined />}
              title="编辑"
              onClick={() => handleEdit(customer)}
              size="small"
            />
            <Popconfirm
              title="确定要删除这个客户吗？"
              onConfirm={() => handleDelete(customer.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="text"
                danger
                icon={<DeleteOutlined />}
                title="删除"
                onClick={(e) => e.stopPropagation()}
                size="small"
              />
            </Popconfirm>
          </div>
        </div>
      </Card>
    </Col>
  );

  return (
    <div style={{ padding: '2px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Card styles={{ body: { padding: '8px', flex: 1, overflow: 'visible' } }}>
          {/* 过滤器 */}
          <div className="customer-filter-area" style={{ marginBottom: 12 }}>
            <Row gutter={8}>
            <Col span={12} style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large" style={{ width: '100%' }}>
                新建客户
              </Button>
            </Col>
            <Col span={12} style={{ marginBottom: 12 }}>
              <Button icon={<UnorderedListOutlined />} onClick={onShowTrialsList} size="large" style={{ width: '100%' }}>
                体验列表
              </Button>
            </Col>
            
            {(isAdmin || isManager || isSales) && (
              <Col span={12} style={{ marginBottom: 12 }}>
                <Select
                  value={salesFilter}
                  onChange={handleSalesFilterChange}
                  style={{ width: '100%' }}
                  placeholder={isSales ? (user?.nickname || user?.username || "当前用户") : "全部销售"}
                  size="large"
                  disabled={isSales}
                >
                  {(isAdmin || isManager) ? (
                    <>
                      <Option value="all">全部销售</Option>
                      {salesList.map(sales => (
                        <Option key={sales.id} value={sales.id.toString()}>
                          {sales.nickname || sales.username}
                        </Option>
                      ))}
                    </>
                  ) : (
                    <Option value={user?.id?.toString()}>{user?.nickname || user?.username}</Option>
                  )}
                </Select>
              </Col>
            )}
            
            <Col span={(isAdmin || isManager || isSales) ? 12 : 24} style={{ marginBottom: 12 }}>
              <Select
                value={activeTab}
                onChange={handleActiveTabChange}
                style={{ width: '100%' }}
                placeholder="全部状态"
                size="large"
                optionLabelProp="label"
              >
                <Option value="all" label="全部状态">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>全部状态</span>
                    <span style={{ color: '#1890ff', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('all')}</span>
                  </div>
                </Option>
                <Option value="NEW" label="新建">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>新建</span>
                    <span style={{ color: '#52c41a', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('NEW')}</span>
                  </div>
                </Option>
                <Option value="CONTACTED" label="已联系">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已联系</span>
                    <span style={{ color: '#13c2c2', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('CONTACTED')}</span>
                  </div>
                </Option>
                <Option value="PENDING_CONFIRM" label="待确认">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待确认</span>
                    <span style={{ color: '#722ed1', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('PENDING_CONFIRM')}</span>
                  </div>
                </Option>
                <Option value="SCHEDULED" label="待体验">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待体验</span>
                    <span style={{ color: '#fa8c16', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('SCHEDULED')}</span>
                  </div>
                </Option>
                <Option value="VISITED" label="已体验">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已体验</span>
                    <span style={{ color: '#eb2f96', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('VISITED')}</span>
                  </div>
                </Option>
                <Option value="RE_EXPERIENCE" label="待再体验">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待再体验</span>
                    <span style={{ color: '#faad14', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('RE_EXPERIENCE')}</span>
                  </div>
                </Option>
                <Option value="PENDING_SOLD" label="待成交">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待成交</span>
                    <span style={{ color: '#f5222d', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('PENDING_SOLD')}</span>
                  </div>
                </Option>
                <Option value="SOLD" label="已成交">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已成交</span>
                    <span style={{ color: '#52c41a', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('SOLD')}</span>
                  </div>
                </Option>
                <Option value="CLOSED" label="已结束">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已结束</span>
                    <span style={{ color: '#8c8c8c', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('CLOSED')}</span>
                  </div>
                </Option>
              </Select>
            </Col>

            <Col span={12} style={{ marginBottom: 12, paddingRight: 6 }}>
              <Input
                placeholder="搜索姓名或电话"
                value={searchInputValue}
                onChange={handleSearchInputChange}
                allowClear
                size="large"
                prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Col>

            <Col span={12} style={{ marginBottom: 12, paddingLeft: 6 }}>
              <DatePicker
                value={selectedFilterDate}
                onChange={(date) => {
                  setSelectedFilterDate(date);
                }}
                placeholder="选择日期过滤"
                style={{ width: '100%' }}
                size="large"
                allowClear
                format="YYYY-MM-DD"
                disabledDate={disabledDate}
              />
            </Col>
            </Row>
          </div>

        {/* 卡片列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : customers.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <p>暂无客户数据</p>
          </div>
        ) : (
          <div 
            className="customer-card-list" 
            style={{ overflowY: 'auto', overflowX: 'hidden', width: '100%', maxHeight: 'calc(100vh - 240px)' }}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              // 当滚动到底部附近100px时，加载更多
              if (scrollHeight - scrollTop - clientHeight < 100) {
                loadMoreData();
              }
            }}
          >
            {allDateKeys.map((dateKey) => {
              const customers = groupedCustomers[dateKey];
              return (
                <div key={dateKey} style={{ marginBottom: 24 }}>
                  {/* 日期标题栏 */}
                  <div style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(67, 206, 162, 0.25)',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: '500',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CalendarOutlined />
                      {formatDateTitle(dateKey)}
                    </div>
                    <span style={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '13px',
                      fontWeight: '400'
                    }}>
                      共 {customers.length} 条数据
                    </span>
                  </div>
                  
                  {/* 客户卡片列表 */}
                  <Row gutter={[4, 8]} style={{ margin: 0, width: '100%' }}>
                    {customers.map(customer => 
                      renderCustomerCard(customer, `${dateKey}-${customer.id}`)
                    )}
                  </Row>
                </div>
              );
            })}
            
            {/* 加载更多提示 */}
            {loadingMore && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                <Spin size="small" /> 加载中...
              </div>
            )}
            
            {/* 数据加载状态提示 */}
            {!loadingMore && customers.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '12px' }}>
                {hasMore ? `已加载 ${customers.length} 条数据，向下滚动加载更多` : `已加载全部 ${customers.length} 条数据`}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 客户表单模态框 */}
      <Modal
        title={editingCustomer ? '编辑客户' : '新建客户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setShowSmartParse(false);
          setParseText('');
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* 智能解析区域 */}
          {!editingCustomer && (
            <div style={{ marginBottom: 16 }}>
              <Button
                type="dashed"
                icon={<CopyOutlined />}
                onClick={() => setShowSmartParse(!showSmartParse)}
                style={{ 
                  width: '100%',
                  borderColor: showSmartParse ? '#1890ff' : undefined,
                  color: showSmartParse ? '#1890ff' : undefined
                }}
              >
                {showSmartParse ? '收起智能解析' : '智能解析（快速录入）'}
              </Button>
              
              {showSmartParse && (
                <div style={{ 
                  marginTop: 12, 
                  padding: '12px',
                  backgroundColor: '#e6f7ff',
                  borderRadius: '4px',
                  border: '1px dashed #1890ff'
                }}>
                  <div style={{ marginBottom: 8, fontSize: '13px', color: '#1890ff', fontWeight: 500 }}>
                    粘贴客户信息（支持格式：姓名、电话、详细信息）
                  </div>
                  <TextArea
                    value={parseText}
                    onChange={(e) => setParseText(e.target.value)}
                    placeholder="例如：小明，男，7岁，13800138000，下周末有时间"
                    rows={3}
                    maxLength={500}
                  />
                  <div style={{ marginTop: 8, display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Button 
                      size="small"
                      onClick={() => {
                        setShowSmartParse(false);
                        setParseText('');
                      }}
                    >
                      取消
                    </Button>
                    <Button 
                      size="small"
                      type="primary"
                      loading={parsing}
                      onClick={handleSmartParse}
                    >
                      解析并填充
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="childName"
                label="孩子姓名"
                rules={[{ required: true, message: '请输入孩子姓名' }]}
              >
                <Input placeholder="请输入孩子姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentPhone"
                label="家长电话/微信"
                rules={[
                  { required: true, message: '请输入家长电话或微信' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || value.trim() === '') {
                        return Promise.reject(new Error('请输入家长电话或微信'));
                      }
                      // 如果看起来像手机号（全是数字且长度为11），则验证手机号格式
                      if (/^\d+$/.test(value) && value.length === 11) {
                        if (!/^1[3-9]\d{9}$/.test(value)) {
                          return Promise.reject(new Error('请输入正确的手机号码'));
                        }
                      }
                      // 其他情况视为微信号，通过验证
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input placeholder="请输入电话或微信号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="source"
            label="地点"
          >
            <Input placeholder="请输入地点" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="详情"
            rules={[{ required: true, message: '请输入详情' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="请输入详细信息，如：什么时候有时间、家长关系（爸爸/妈妈）、性别、年龄、微信号等" 
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCustomer ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 状态流转记录模态框 */}
      <CustomerStatusHistoryModal
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        customer={selectedCustomer}
        onSuccess={handleHistorySuccess}
        onTodoCreated={onTodoCreated}
        hideHistory={true}
      />

      {/* 待办提醒模态框 */}
      <Modal
        title={`${editingTodoId ? '编辑' : '设置'}待办提醒 - ${todoCustomer?.childName || ''}`}
        open={todoModalVisible}
        onCancel={() => {
          setTodoModalVisible(false);
          setTodoCustomer(null);
          setTodoContent('');
          setTodoReminderDate(null);
          setTodoReminderTime(null);
          setEditingTodoId(null);
        }}
        onOk={handleCreateTodo}
        okText={editingTodoId ? '保存' : '创建待办'}
        cancelText="取消"
        width={500}
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: '500' }}>
              待办内容
            </div>
            <TextArea
              value={todoContent}
              onChange={(e) => setTodoContent(e.target.value)}
              placeholder="请输入待办内容，如：电话回访、预约上门等"
              rows={3}
              maxLength={200}
              showCount
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: '500' }}>
              提醒日期和时间
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <DatePicker
                value={todoReminderDate}
                onChange={setTodoReminderDate}
                style={{ flex: 1 }}
                placeholder="请选择提醒日期"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                format="YYYY-MM-DD"
              />
              <TimePicker
                value={todoReminderTime}
                onChange={(time) => {
                  console.log('Reminder time changed:', time);
                  setTodoReminderTime(time);
                }}
                onSelect={(time) => {
                  console.log('Reminder time selected:', time);
                  setTodoReminderTime(time);
                }}
                style={{ flex: 1 }}
                placeholder="请选择提醒时间"
                format="HH:mm"
                minuteStep={10}
                disabledTime={() => ({
                  disabledHours: () => {
                    // 只允许10-20点
                    return [...Array(10).keys(), ...Array(4).keys().map(i => i + 21)];
                  }
                })}
                hideDisabledOptions={false}
                showNow={false}
                needConfirm={true}
                popupClassName="show-all-minutes-picker"
              />
            </div>
          </div>

          {todoCustomer && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#666'
            }}>
              <div><strong>客户信息：</strong></div>
              <div>姓名：{todoCustomer.childName}</div>
              {todoCustomer.parentPhone && <div>电话：{todoCustomer.parentPhone}</div>}
              {todoCustomer.source && <div>来源：{todoCustomer.source}</div>}
            </div>
          )}
        </div>
      </Modal>

      {/* 查看待办提醒模态框 */}
      <Modal
        open={viewTodoModalVisible}
        onCancel={() => {
          setViewTodoModalVisible(false);
          setViewTodoCustomer(null);
          setShowCancelConfirm(false);
        }}
        footer={null}
        width={360}
        closable={true}
        centered
      >
        {viewTodoCustomer && latestTodoByCustomer[viewTodoCustomer.id] && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ 
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: '14px', color: '#333', marginBottom: 8 }}>
                <ClockCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {latestTodoByCustomer[viewTodoCustomer.id].reminderDate 
                  ? dayjs(latestTodoByCustomer[viewTodoCustomer.id].reminderDate).format('YYYY-MM-DD') 
                  : ''} {latestTodoByCustomer[viewTodoCustomer.id].reminderTime || ''}
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.6', marginBottom: 16 }}>
              {latestTodoByCustomer[viewTodoCustomer.id].content}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              justifyContent: 'center',
              paddingTop: 8, 
              borderTop: '1px solid #f0f0f0' 
            }}>
              {/* 权限判断：客户已分配则只有被分配人可编辑，未分配则只有创建者可编辑 */}
              {(() => {
                const canEdit = viewTodoCustomer.assignedSalesId 
                  ? viewTodoCustomer.assignedSalesId === user?.id  // 客户已分配：只有被分配人可编辑
                  : latestTodoByCustomer[viewTodoCustomer.id].createdBy === user?.id;  // 客户未分配：只有创建者可编辑
                return canEdit && (
                  <>
                    <Button 
                      type="primary" 
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleSwitchToEditTodo(viewTodoCustomer)}
                    >
                      编辑提醒
                    </Button>
                    <Button 
                      danger 
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={showCancelConfirm}
                    >
                      取消提醒
                    </Button>
                  </>
                );
              })()}
            </div>
            
            {showCancelConfirm && (
              <div style={{ 
                marginTop: 12,
                padding: '12px',
                backgroundColor: '#fff7e6',
                borderRadius: '4px',
                border: '1px solid #ffc069'
              }}>
                <div style={{ 
                  marginBottom: 12, 
                  fontSize: '14px', 
                  color: '#d46b08',
                  textAlign: 'center'
                }}>
                  确认取消提醒？取消后将删除此待办提醒
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Button 
                    size="small"
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    取消
                  </Button>
                  <Button 
                    type="primary"
                    danger
                    size="small"
                    onClick={() => {
                      handleCancelReminder(viewTodoCustomer);
                      setShowCancelConfirm(false);
                    }}
                  >
                    确认
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 分配客户模态框 */}
      <AssignCustomerModal
        visible={assignModalVisible}
        customer={assigningCustomer}
        onCancel={() => {
          setAssignModalVisible(false);
          setAssigningCustomer(null);
        }}
        onSuccess={handleAssignCustomer}
      />
    </div>
  );
};

export default React.forwardRef(CustomerManagement);
