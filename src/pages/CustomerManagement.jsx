import React, { useState, useEffect } from 'react';
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
  ClockCircleOutlined
} from '@ant-design/icons';
import CustomerStatusHistoryModal from '../components/CustomerStatusHistoryModal';
import { 
  createCustomer, 
  getCustomers, 
  updateCustomer, 
  deleteCustomer, 
  getCustomersByStatus 
} from '../services/customer';
import { createTodo, checkCustomerHasTodo, getTodos, updateTodo, deleteTodo } from '../services/todo';
import { getTrialSchedule } from '../services/timetable';
import { getApiBaseUrl } from '../config/api';
import dayjs from 'dayjs';
import './CustomerManagement.css';

const { Option } = Select;
const { TextArea } = Input;

const CustomerManagement = ({ user, onTodoCreated }, ref) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
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
  const [displayedCount, setDisplayedCount] = useState(10); // 初始显示10条数据
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

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const isSales = user?.position?.toUpperCase() === 'SALES';

  useEffect(() => {
    fetchCustomers();
    if (isAdmin) {
      fetchSalesList();
    }
  }, []);

  useEffect(() => {
    checkAllCustomerTodos();
  }, [customers]);

  useEffect(() => {
    filterCustomers();
    // 筛选条件变化时，重置显示的数据条数
    setDisplayedCount(10);
  }, [customers, activeTab, salesFilter, selectedFilterDate, searchKeyword]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await getCustomers();
      if (response && response.success) {
        // 按创建时间倒序排列（最新的在前面）
        const sortedData = (response.data || []).sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        setCustomers(sortedData);
      } else {
        message.error('获取客户列表失败');
      }
    } catch (error) {
      console.error('获取客户列表失败:', error);
      message.error('获取客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const checkAllCustomerTodos = async () => {
    if (!customers || customers.length === 0) return;
    
    const todoStatus = {};
    // 批量获取所有待办，只需一次请求
    let allTodos = [];
    try {
      const todosResp = await getTodos();
      if (todosResp && todosResp.success) {
        allTodos = todosResp.data || [];
      }
    } catch (e) {
      console.error('获取待办列表失败:', e);
    }

    const latestMap = {};
    const byCustomerId = new Map();
    allTodos.forEach(t => {
      const key = t.customerId != null ? String(t.customerId) : null;
      if (key) {
        const arr = byCustomerId.get(key) || [];
        arr.push(t);
        byCustomerId.set(key, arr);
      }
    });

    // 直接从已获取的待办数据中判断，不再逐个调用接口
    for (const customer of customers) {
      // 匹配该客户最近一条待办（兼容缺失customerId的数据）
      let candidates = byCustomerId.get(String(customer.id)) || [];
      if (candidates.length === 0) {
        candidates = allTodos.filter(t => {
          const nameMatch = t.customerName === customer.childName;
          const phoneMatch = customer.parentPhone ? (t.customerPhone === customer.parentPhone) : false;
          return nameMatch || phoneMatch;
        });
      }
      
      // 根据是否有待办设置状态
      todoStatus[customer.id] = candidates.length > 0;
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const aKey = `${a.reminderDate || a.createdAt || ''} ${a.reminderTime || ''}`;
          const bKey = `${b.reminderDate || b.createdAt || ''} ${b.reminderTime || ''}`;
          return bKey.localeCompare(aKey);
        });
        latestMap[customer.id] = candidates[0];
      }
    }

    setCustomerTodoStatus(todoStatus);
    setLatestTodoByCustomer(latestMap);
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
        const sales = (data.data || []).filter(u => u.position === 'SALES' || u.role === 'ADMIN');
        setSalesList(sales);
      }
    } catch (error) {
      console.error('获取销售人员列表失败:', error);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // 按状态过滤
    if (activeTab !== 'all') {
      filtered = filtered.filter(customer => customer.status === activeTab);
    }

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

    setFilteredCustomers(filtered);
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
      
      // 同时更新 filteredCustomers 以确保筛选后的列表也更新
      setFilteredCustomers(prevFiltered => 
        prevFiltered.map(c => {
          if (c.id === selectedCustomer.id) {
            return {
              ...c,
              status: newStatus || c.status,
              statusText: newStatus ? getStatusText(newStatus) : c.statusText,
              lastStatusChangeNote: lastChangeNote !== undefined ? lastChangeNote : c.lastStatusChangeNote,
              lastStatusChangeTime: lastChangeNote !== undefined ? new Date().toISOString() : c.lastStatusChangeTime
            };
          }
          return c;
        })
      );
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
    if (customer.lastStatusChangeNote) {
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

  const handleResetFilters = () => {
    setSalesFilter('all');
    setActiveTab('all');
    setSelectedFilterDate(null);
    setCurrentDatePage(0);
    setDisplayedCount(10);
  };

  const handleSalesFilterChange = (value) => {
    setSalesFilter(value);
    setCurrentDatePage(0);
    setDisplayedCount(10);
  };

  const handleActiveTabChange = (value) => {
    setActiveTab(value);
    setCurrentDatePage(0);
    setDisplayedCount(10);
  };

  // 智能解析客户信息
  const handleSmartParse = () => {
    if (!parseText.trim()) {
      message.warning('请输入要解析的文本');
      return;
    }

    setParsing(true);
    
    try {
      // 解析逻辑：智能提取姓名、电话、年龄、性别等信息
      let text = parseText.trim();
      
      // 1. 提取手机号（11位数字）
      const phoneMatch = text.match(/1[3-9]\d{9}/);
      const phone = phoneMatch ? phoneMatch[0] : '';
      
      // 2. 去除开头的序号（如：1、1，1. 等）
      // 只有当开头不是手机号时才去除序号，限制为1-3位数字
      if (!text.match(/^1[3-9]\d{9}/)) {
        text = text.replace(/^\d{1,3}[，,、.\s]+/, '');
      }
      
      // 3. 按逗号、顿号或句号分割信息
      const parts = text.split(/[，,、。.]+/).map(p => p.trim()).filter(p => p && p.length > 0);
      
      // 4. 智能提取姓名：找2-4个连续中文字符，且不包含数字、不是电话号码、不是常见描述词
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
      
      // 5. 如果没找到独立的姓名，尝试从复合文本中提取
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
      
      // 6. 组合详细信息（保留所有信息）
      let details = text
        .replace(phoneMatch ? phoneMatch[0] : '', '') // 去除电话
        .replace(/^[，,、.。\s]+/, '') // 去除开头的标点和空格
        .replace(/[，,、.。\s]+$/, '') // 去除结尾的标点和空格
        .trim();
      
      // 7. 清理details中多余的逗号和空格
      details = details
        .replace(/[，,、]+/g, '，')
        .replace(/\s+/g, ' ')
        .replace(/^，+/, '')
        .replace(/，+$/, '')
        .trim();
      
      // 填充表单
      form.setFieldsValue({
        childName: name,
        parentPhone: phone,
        notes: details
      });
      
      if (name || phone) {
        message.success('解析成功！请检查并完善信息');
      } else {
        message.warning('未能识别姓名或电话，请手动填写');
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
        status: editingCustomer ? editingCustomer.status : 'NEW', // 新建时固定为NEW，编辑时保持原状态
        notes: values.notes,
        source: values.source || null
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
        
        // 创建成功后，清除过滤条件并重新获取数据
        if (!editingCustomer) {
          // 新建客户：切换到"全部"视图并重新获取数据
          setCurrentDatePage(0);
          await fetchCustomers();
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
      'PENDING_CONFIRM': 'yellow',
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

  // 获取要显示的客户数据（按条数切片）
  const displayedCustomers = filteredCustomers.slice(0, displayedCount);
  
  // 按日期分组显示的客户
  const groupedCustomers = groupCustomersByDate(displayedCustomers);
  const allDateKeys = Object.keys(groupedCustomers);

  // 加载更多数据
  const loadMoreData = () => {
    if (displayedCount < filteredCustomers.length) {
      setDisplayedCount(prev => Math.min(prev + 10, filteredCustomers.length));
    }
  };

  const renderCustomerCard = (customer) => (
    <Col key={customer.id} xs={24} sm={12} md={12} lg={12} xl={12}>
      <Card
        style={{ height: '100%' }}
        bodyStyle={{ padding: '12px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {customer.source && (
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {customer.source}
                </span>
              )}
              {(customer.status === 'SCHEDULED' || customer.status === 'RE_EXPERIENCE') ? (
                <Popover
                  content={
                    <div style={{ maxWidth: '300px' }}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: 8 }}>
                          {customer.status === 'RE_EXPERIENCE' ? '再体验课安排' : '体验课安排'}
                        </div>
                        {loadingTrialSchedule && !trialScheduleCache[customer.id] ? (
                          <Spin size="small" />
                        ) : trialScheduleCache[customer.id] ? (
                          <div style={{ fontSize: '13px', color: '#333' }}>
                            <div style={{ marginBottom: 6 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              <strong>日期：</strong>
                              {trialScheduleCache[customer.id].scheduleDate ? 
                                dayjs(trialScheduleCache[customer.id].scheduleDate).format('YYYY-MM-DD') : '-'}
                            </div>
                            <div style={{ marginBottom: 6 }}>
                              <ClockCircleOutlined style={{ marginRight: 4 }} />
                              <strong>时间：</strong>
                              {trialScheduleCache[customer.id].startTime && trialScheduleCache[customer.id].endTime ?
                                `${trialScheduleCache[customer.id].startTime} - ${trialScheduleCache[customer.id].endTime}` : '-'}
                            </div>
                            {trialScheduleCache[customer.id].coachName && (
                              <div style={{ marginBottom: 6 }}>
                                <strong>教练：</strong>
                                {trialScheduleCache[customer.id].coachName}
                              </div>
                            )}
                            {trialScheduleCache[customer.id].note && (
                              <div style={{ marginTop: 8, padding: '6px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
                                {trialScheduleCache[customer.id].note}
                              </div>
                            )}
                          </div>
                        ) : customer.lastStatusChangeNote ? (
                          <div style={{ fontSize: '13px', color: '#666', whiteSpace: 'pre-wrap' }}>
                            {customer.lastStatusChangeNote}
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#999' }}>
                            暂无体验时间信息
                          </div>
                        )}
                      </div>
                      <Button 
                        type="primary" 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHistory(customer, e);
                        }}
                      >
                        查看/编辑详情
                      </Button>
                    </div>
                  }
                  title={customer.status === 'RE_EXPERIENCE' ? '待再体验信息' : '待体验信息'}
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

          {customer.lastStatusChangeNote && (
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
                marginBottom: 2
              }}>
                <span>最近流转：</span>
                {customer.lastStatusChangeTime && (
                  <span style={{ color: '#bbb', fontSize: '11px' }}>
                    {dayjs(customer.lastStatusChangeTime).format('MM-DD HH:mm')}
                  </span>
                )}
              </div>
              <div style={{ 
                color: '#999', 
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.5'
              }}>
                {customer.lastStatusChangeNote}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: '8px', color: '#999', fontSize: '12px', flex: 1, alignItems: 'center' }}>
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
        <Card bodyStyle={{ padding: '8px', flex: 1, overflow: 'auto' }}>
          {/* 过滤器 */}
          <div className="customer-filter-area" style={{ marginBottom: 12 }}>
            <Row gutter={8}>
            <Col span={24} style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large" style={{ width: '100%' }}>
                新建客户
              </Button>
            </Col>
            
            {isAdmin && (
              <Col span={12} style={{ marginBottom: 12 }}>
                <Select
                  value={salesFilter}
                  onChange={handleSalesFilterChange}
                  style={{ width: '100%' }}
                  placeholder="全部销售"
                  size="large"
                >
                  <Option value="all">全部销售</Option>
                  {salesList.map(sales => (
                    <Option key={sales.id} value={sales.id.toString()}>
                      {sales.nickname || sales.username}
                    </Option>
                  ))}
                </Select>
              </Col>
            )}
            
            <Col span={isAdmin ? 12 : 24} style={{ marginBottom: 12 }}>
              <Select
                value={activeTab}
                onChange={handleActiveTabChange}
                style={{ width: '100%' }}
                placeholder="全部状态"
                size="large"
              >
                <Option value="all">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>全部状态</span>
                    <span style={{ color: '#1890ff', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('all')}</span>
                  </div>
                </Option>
                <Option value="NEW">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>新建</span>
                    <span style={{ color: '#52c41a', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('NEW')}</span>
                  </div>
                </Option>
                <Option value="CONTACTED">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已联系</span>
                    <span style={{ color: '#13c2c2', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('CONTACTED')}</span>
                  </div>
                </Option>
                <Option value="PENDING_CONFIRM">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待确认</span>
                    <span style={{ color: '#722ed1', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('PENDING_CONFIRM')}</span>
                  </div>
                </Option>
                <Option value="SCHEDULED">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待体验</span>
                    <span style={{ color: '#fa8c16', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('SCHEDULED')}</span>
                  </div>
                </Option>
                <Option value="VISITED">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已体验</span>
                    <span style={{ color: '#eb2f96', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('VISITED')}</span>
                  </div>
                </Option>
                <Option value="RE_EXPERIENCE">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待再体验</span>
                    <span style={{ color: '#faad14', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('RE_EXPERIENCE')}</span>
                  </div>
                </Option>
                <Option value="PENDING_SOLD">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>待成交</span>
                    <span style={{ color: '#f5222d', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('PENDING_SOLD')}</span>
                  </div>
                </Option>
                <Option value="SOLD">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已成交</span>
                    <span style={{ color: '#52c41a', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('SOLD')}</span>
                  </div>
                </Option>
                <Option value="CLOSED">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>已结束</span>
                    <span style={{ color: '#8c8c8c', fontWeight: 'bold', marginLeft: '8px' }}>{getStatusCount('CLOSED')}</span>
                  </div>
                </Option>
              </Select>
            </Col>

            <Col span={24} style={{ marginBottom: 12 }}>
              <DatePicker
                value={selectedFilterDate}
                onChange={(date) => {
                  setSelectedFilterDate(date);
                  setCurrentDatePage(0);
                  setDisplayedCount(10);
                }}
                placeholder="选择日期过滤"
                style={{ width: '100%' }}
                size="large"
                allowClear
                format="YYYY-MM-DD"
                disabledDate={disabledDate}
              />
            </Col>

            <Col span={24} style={{ marginBottom: 12 }}>
              <Input
                placeholder="搜索姓名或电话"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setCurrentDatePage(0);
                  setDisplayedCount(10);
                }}
                allowClear
                size="large"
                prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Col>
            </Row>
          </div>

        {/* 卡片列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <p>暂无客户数据</p>
          </div>
        ) : (
          <div 
            className="customer-card-list" 
            style={{ overflow: 'auto', width: '100%', maxHeight: 'calc(100vh - 400px)' }}
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
                    {customers.map(customer => renderCustomerCard(customer))}
                  </Row>
                </div>
              );
            })}
            
            {/* 加载更多提示 */}
            {displayedCount < filteredCustomers.length && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                <Spin size="small" /> 加载中...
              </div>
            )}
            
            {displayedCount >= filteredCustomers.length && filteredCustomers.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                已加载全部 {filteredCustomers.length} 条数据
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
                    placeholder="例如：东东，男，7岁，15810695923，下周末有时间"
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
                label="家长电话"
                rules={[{ required: true, message: '请输入家长电话' }]}
              >
                <Input placeholder="请输入家长电话" />
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
                onChange={setTodoReminderTime}
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
                showTime={{
                  hideDisabledOptions: true
                }}
                showNow={false}
                popupClassName="custom-time-picker"
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
    </div>
  );
};

export default React.forwardRef(CustomerManagement);
