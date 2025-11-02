import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Timeline, Spin, message, Button, Space, Tag, DatePicker, TimePicker, Popconfirm } from 'antd';
import { ClockCircleOutlined, BellOutlined, EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, CalendarOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { changeCustomerStatus, getCustomerStatusHistory, updateCustomerStatusHistory, deleteCustomerStatusHistory, cancelTrialSchedule } from '../services/customerStatusHistory';
import { createTodo, getLatestTodoByCustomer, updateTodo, updateTodoReminderTime } from '../services/todo';
import { getApiBaseUrl } from '../config/api';
import { getCurrentUserPermissions } from '../services/rolePermission';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const CustomerStatusHistoryModal = ({ visible, onCancel, customer, onSuccess, onTodoCreated, onTodoUpdated }) => {
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
  const [isEditingReminder, setIsEditingReminder] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState(null);
  const [tempReminderTime, setTempReminderTime] = useState(null);
  const [reminderContent, setReminderContent] = useState('');
  const [tempReminderContent, setTempReminderContent] = useState('');
  
  // 待体验相关状态
  const [showExperienceSchedule, setShowExperienceSchedule] = useState(false);
  const [experienceDate, setExperienceDate] = useState(null);
  const [experienceTimeRange, setExperienceTimeRange] = useState(null);
  const [availableCoaches, setAvailableCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [trialStudentName, setTrialStudentName] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerClickCount, setTimePickerClickCount] = useState(0);
  
  // 原始体验安排信息（用于回显）
  const [originalTrialSchedule, setOriginalTrialSchedule] = useState(null);
  const [scheduleModified, setScheduleModified] = useState(false);
  
  // 权限相关状态
  const [hasSchedulePermission, setHasSchedulePermission] = useState(false);

  // 获取用户权限
  useEffect(() => {
    const fetchUserPermissions = async () => {
      try {
        const response = await getCurrentUserPermissions();
        if (response && response.success && response.data) {
          const permissions = response.data;
          // 检查是否有"我的课表"权限
          const hasMySchedule = permissions.menuPermissions?.mySchedule === true;
          setHasSchedulePermission(hasMySchedule);
          console.log('[CustomerStatusHistoryModal] 用户是否有课表权限:', hasMySchedule);
        }
      } catch (error) {
        console.error('[CustomerStatusHistoryModal] 获取用户权限失败:', error);
        setHasSchedulePermission(false);
      }
    };
    
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue({
        toStatus: customer.status
      });
      fetchHistory();
      fetchExistingTodo();
      setEditingHistoryId(null);
      setEditingNotes('');
      
      // 初始化体验人员名字为客户的孩子名字
      setTrialStudentName(customer.childName || '');
      
      // 如果当前状态是"待体验"或"待再体验"，回显上次的体验时间
      if (customer.status === 'SCHEDULED' || customer.status === 'RE_EXPERIENCE') {
        fetchTrialScheduleFromHistory();
      } else {
        // 重置体验安排状态
        setShowExperienceSchedule(false);
        setExperienceDate(null);
        setExperienceTimeRange(null);
        setAvailableCoaches([]);
        setSelectedCoach(null);
      }
    } else if (!visible) {
      // 关闭模态框时重置状态
      setShowExperienceSchedule(false);
      setExperienceDate(null);
      setExperienceTimeRange(null);
      setAvailableCoaches([]);
      setSelectedCoach(null);
      setIsEditingReminder(false);
      setTempReminderDate(null);
      setTempReminderTime(null);
      setTempReminderContent('');
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
        setReminderContent(todo.content || '');
      } else {
        // 没有现有的待办，重置
        setExistingTodoId(null);
        setShowTodoReminder(false);
        setReminderDate(null);
        setReminderTime(null);
        setReminderContent('');
      }
    } catch (error) {
      console.error('获取待办信息失败:', error);
      // 失败时也重置
      setExistingTodoId(null);
      setShowTodoReminder(false);
      setReminderDate(null);
      setReminderTime(null);
      setReminderContent('');
    }
  };

  // 从历史记录中获取体验时间信息
  const fetchTrialScheduleFromHistory = async () => {
    if (!customer) return;
    
    // 如果客户当前状态是待体验或待再体验，始终显示体验安排区域
    setShowExperienceSchedule(true);
    
    try {
      const response = await getCustomerStatusHistory(customer.id);
      if (response && response.success && response.data) {
        const historyList = response.data || [];
        // 查找最近一条包含体验时间的记录
        const trialHistory = historyList.find(h => 
          (h.toStatus === 'SCHEDULED' || h.toStatus === 'RE_EXPERIENCE') && 
          h.trialScheduleDate && h.trialStartTime && h.trialEndTime
        );
        
        if (trialHistory) {
          // 回显体验安排信息
          const originalDate = dayjs(trialHistory.trialScheduleDate);
          const originalTimeRange = [
            dayjs(trialHistory.trialStartTime, 'HH:mm:ss'),
            dayjs(trialHistory.trialEndTime, 'HH:mm:ss')
          ];
          
          setExperienceDate(originalDate);
          setExperienceTimeRange(originalTimeRange);
          
          // 保存原始体验安排信息（包括教练ID和教练名称）
          setOriginalTrialSchedule({
            date: originalDate,
            timeRange: originalTimeRange,
            coachId: trialHistory.trialCoachId,
            coachName: trialHistory.trialCoachName
          });
          
          // 如果有教练信息，也回显
          if (trialHistory.trialCoachId) {
            setSelectedCoach(trialHistory.trialCoachId);
          }
          
          // 标记为未修改
          setScheduleModified(false);
          
          // 回显备注
          if (trialHistory.notes) {
            form.setFieldsValue({
              notes: trialHistory.notes
            });
          }
        } else {
          // 没有找到体验时间记录，显示空的输入框
          setExperienceDate(null);
          setExperienceTimeRange(null);
          setAvailableCoaches([]);
          setSelectedCoach(null);
          setOriginalTrialSchedule(null);
          setScheduleModified(false);
        }
      } else {
        // API调用失败，也显示空的输入框
        setExperienceDate(null);
        setExperienceTimeRange(null);
        setAvailableCoaches([]);
        setSelectedCoach(null);
        setOriginalTrialSchedule(null);
        setScheduleModified(false);
      }
    } catch (error) {
      console.error('获取体验时间信息失败:', error);
      // 即使出错，也显示空的输入框
      setExperienceDate(null);
      setExperienceTimeRange(null);
      setAvailableCoaches([]);
      setSelectedCoach(null);
      setOriginalTrialSchedule(null);
      setScheduleModified(false);
    }
  };

  const fetchHistory = async () => {
    if (!customer) return;
    
    setFetchingHistory(true);
    try {
      const response = await getCustomerStatusHistory(customer.id);
      if (response && response.success) {
        const historiesData = response.data || [];
        // 创建一个新的数组引用，确保触发重新渲染
        setHistories([...historiesData]);
        console.log('历史记录已更新:', historiesData.map(h => ({ 
          id: h.id, 
          trialCancelled: h.trialCancelled,
          trialScheduleDate: h.trialScheduleDate 
        })));
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

  // 取消体验课程
  const handleCancelTrialSchedule = async (history) => {
    if (!customer) {
      message.error('客户信息不存在');
      return;
    }

    try {
      message.loading({ content: '正在取消体验课程...', key: 'cancelTrial' });
      
      // 调用新的取消体验API（不需要传学员名字，直接从历史记录读取课表ID）
      const response = await cancelTrialSchedule(
        customer.id, 
        history.id
      );
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已取消', key: 'cancelTrial' });
        
        // 立即更新本地状态，将对应的历史记录标记为已取消
        setHistories(prevHistories => 
          prevHistories.map(h => 
            h.id === history.id 
              ? { ...h, trialCancelled: true } 
              : h
          )
        );
        
        // 刷新历史记录以获取最新数据
        await fetchHistory();
        
        console.log('取消成功，历史记录已刷新');
        
        // 通知父组件刷新
        if (onSuccess) {
          onSuccess(customer.status, history.notes);
        }
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
    }
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

    // 如果是待体验或待再体验状态，验证必填项
    if (values.toStatus === 'SCHEDULED' || values.toStatus === 'RE_EXPERIENCE') {
      if (!trialStudentName || !trialStudentName.trim()) {
        message.warning('请输入体验人员姓名');
        return;
      }
      if (!experienceDate || !experienceTimeRange || experienceTimeRange.length !== 2) {
        message.warning('请选择体验日期和时间');
        return;
      }
      
      // 如果有课表权限且时间被修改了，则需要选择教练
      // 如果有原始安排且未修改，则使用原始教练
      if (hasSchedulePermission && scheduleModified && !selectedCoach) {
        message.warning('请选择体验教练');
        return;
      }
    }

    setLoading(true);
    try {
      // 所有状态变更都创建新的历史记录
      const statusChangeData = {
        toStatus: values.toStatus,
        notes: values.notes
      };
      
      // 如果是待体验或待再体验状态且设置了体验时间，一并保存
      if ((values.toStatus === 'SCHEDULED' || values.toStatus === 'RE_EXPERIENCE') && experienceDate && experienceTimeRange && experienceTimeRange.length === 2) {
        statusChangeData.trialScheduleDate = experienceDate.format('YYYY-MM-DD');
        statusChangeData.trialStartTime = experienceTimeRange[0].format('HH:mm:ss');
        statusChangeData.trialEndTime = experienceTimeRange[1].format('HH:mm:ss');
        // 只有有课表权限时才保存教练ID
        // 如果有原始安排且未修改，使用原始教练；否则使用选择的教练
        if (hasSchedulePermission) {
          if (!scheduleModified && originalTrialSchedule?.coachId) {
            statusChangeData.trialCoachId = originalTrialSchedule.coachId;
          } else {
            statusChangeData.trialCoachId = selectedCoach || null;
          }
        } else {
          statusChangeData.trialCoachId = null;
        }
        // 保存体验人员姓名
        statusChangeData.trialStudentName = trialStudentName.trim();
      }
      
      const response = await changeCustomerStatus(customer.id, statusChangeData);

      if (response && response.success) {
        message.success('状态变更成功');
        
        // 确定要使用的教练ID
        let coachIdToUse = null;
        if (hasSchedulePermission) {
          if (!scheduleModified && originalTrialSchedule?.coachId) {
            coachIdToUse = originalTrialSchedule.coachId;
          } else {
            coachIdToUse = selectedCoach;
          }
        }
        
        // 只有当用户有课表权限且有教练ID时，才创建体验课程
        if (hasSchedulePermission && 
            (values.toStatus === 'SCHEDULED' || values.toStatus === 'RE_EXPERIENCE') && 
            experienceDate && experienceTimeRange && coachIdToUse) {
          try {
            const scheduleResponse = await fetch(`${getApiBaseUrl()}/schedules/trial`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                coachId: coachIdToUse,
                studentName: trialStudentName.trim(),
                scheduleDate: experienceDate.format('YYYY-MM-DD'),
                startTime: experienceTimeRange[0].format('HH:mm'),
                endTime: experienceTimeRange[1].format('HH:mm'),
                isTrial: true,
                isHalfHour: true,
                customerPhone: customer.parentPhone,
                customerId: customer.id
              })
            });
            
            const scheduleData = await scheduleResponse.json();
            if (scheduleData.success) {
              message.success('体验课已添加到课表');
            } else {
              message.error(scheduleData.message || '添加体验课失败');
            }
          } catch (error) {
            console.error('添加体验课失败:', error);
            message.error('添加体验课失败');
          }
        }
        
        // 如果设置了待办提醒，创建或更新待办
        if (showTodoReminder && reminderDate && reminderTime) {
          try {
            const todoData = {
              customerId: customer.id,
              customerName: customer.childName,
              content: reminderContent || `跟进客户 ${customer.childName} - ${values.notes || '状态变更提醒'}`,
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
        setReminderContent('');
        setShowExperienceSchedule(false);
        setExperienceDate(null);
        setExperienceTimeRange(null);
        setAvailableCoaches([]);
        setSelectedCoach(null);
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

  const handleStatusChange = async (selectedStatus) => {
    // 如果选择的状态和当前状态相同，回显最近一条历史记录的备注
    if (selectedStatus === customer?.status && histories.length > 0) {
      const latestHistory = histories[0];
      form.setFieldsValue({
        notes: latestHistory.notes || ''
      });
    }
    
    // 如果选择"待体验"或"待再体验"状态，显示体验安排选项
    if (selectedStatus === 'SCHEDULED' || selectedStatus === 'RE_EXPERIENCE') {
      setShowExperienceSchedule(true);
      
      // 如果选择的状态和当前客户状态相同，回显原有的体验安排
      if (selectedStatus === customer?.status) {
        // 保持原有的回显逻辑
        // fetchTrialScheduleFromHistory 会被 useEffect 自动调用
      } else {
        // 如果是切换到新的体验状态，清空原始安排信息
        setOriginalTrialSchedule(null);
        setScheduleModified(false);
        setExperienceDate(null);
        setExperienceTimeRange(null);
        setAvailableCoaches([]);
        setSelectedCoach(null);
      }
    } else {
      setShowExperienceSchedule(false);
      setExperienceDate(null);
      setExperienceTimeRange(null);
      setAvailableCoaches([]);
      setSelectedCoach(null);
      setOriginalTrialSchedule(null);
      setScheduleModified(false);
    }
  };
  
  // 查询有空的教练
  const fetchAvailableCoaches = async (dateValue, timeRange) => {
    // 如果没有传参数，使用当前状态
    const dateToUse = dateValue || experienceDate;
    const timeRangeToUse = timeRange || experienceTimeRange;
    
    if (!dateToUse || !timeRangeToUse || timeRangeToUse.length !== 2 || !timeRangeToUse[0] || !timeRangeToUse[1]) {
      return;
    }
    
    setLoadingCoaches(true);
    try {
      const dateStr = dateToUse.format('YYYY-MM-DD');
      const startTime = timeRangeToUse[0].format('HH:mm');
      const endTime = timeRangeToUse[1].format('HH:mm');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/schedules/available-coaches?date=${dateStr}&startTime=${startTime}&endTime=${endTime}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setAvailableCoaches(data.data || []);
      } else {
        message.error(data.message || '查询失败');
        setAvailableCoaches([]);
      }
    } catch (error) {
      console.error('查询有空教练失败:', error);
      message.error('查询失败');
      setAvailableCoaches([]);
    } finally {
      setLoadingCoaches(false);
    }
  };
  
  // 检查日期和时间是否被修改
  const checkScheduleModified = (date, timeRange) => {
    if (!originalTrialSchedule) {
      // 没有原始安排，属于新建
      return false;
    }
    
    // 检查日期是否变化
    const dateChanged = !date || !originalTrialSchedule.date || 
                       date.format('YYYY-MM-DD') !== originalTrialSchedule.date.format('YYYY-MM-DD');
    
    // 检查时间是否变化
    const timeChanged = !timeRange || timeRange.length !== 2 || 
                       !originalTrialSchedule.timeRange || originalTrialSchedule.timeRange.length !== 2 ||
                       timeRange[0]?.format('HH:mm') !== originalTrialSchedule.timeRange[0]?.format('HH:mm') ||
                       timeRange[1]?.format('HH:mm') !== originalTrialSchedule.timeRange[1]?.format('HH:mm');
    
    return dateChanged || timeChanged;
  };
  
  // 处理日期变更
  const handleDateChange = (date) => {
    setExperienceDate(date);
    
    // 检查是否修改了日期
    const isModified = checkScheduleModified(date, experienceTimeRange);
    setScheduleModified(isModified);
    
    // 如果修改了日期或时间，清空教练选择
    if (isModified) {
      setAvailableCoaches([]);
      setSelectedCoach(null);
    }
  };
  
  // 处理时间变更
  const handleTimeChange = (times) => {
    setExperienceTimeRange(times);
    
    // 检查是否修改了时间
    const isModified = checkScheduleModified(experienceDate, times);
    setScheduleModified(isModified);
    
    // 如果修改了，并且时间完整，则查询可用教练
    if (isModified && hasSchedulePermission && times && times.length === 2 && times[0] && times[1] && experienceDate) {
      fetchAvailableCoaches(experienceDate, times);
    } else if (isModified) {
      // 如果修改了但时间不完整，清空教练列表
      setAvailableCoaches([]);
      setSelectedCoach(null);
    }
  };
  
  // 当日期改变时，清空教练列表（需要重新选择时间后再查询）
  useEffect(() => {
    if (!experienceDate) {
      setAvailableCoaches([]);
      setSelectedCoach(null);
    }
  }, [experienceDate]);

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

  // 获取所有状态选项
  const getAllStatusOptions = () => {
    const allOptions = [
      { value: 'NEW', label: '新建', disabled: false },
      { value: 'CONTACTED', label: '已联系', disabled: false },
      { value: 'PENDING_CONFIRM', label: '待确认', disabled: false },
      { value: 'SCHEDULED', label: '待体验', disabled: false },
      { value: 'VISITED', label: '已体验', disabled: false },
      { value: 'RE_EXPERIENCE', label: '待再体验', disabled: false },
      { value: 'PENDING_SOLD', label: '待成交', disabled: false },
      { value: 'SOLD', label: '已成交', disabled: false },
      { value: 'CLOSED', label: '已结束', disabled: false }
    ];

    return allOptions;
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

          {/* 待体验/待再体验安排 */}
          {showExperienceSchedule && (
            <div style={{ 
              marginBottom: 24, 
              padding: '16px',
              backgroundColor: '#f0f5ff',
              borderRadius: '4px',
              border: '1px solid #91caff'
            }}>
              <div style={{ marginBottom: 12, fontSize: '15px', fontWeight: '500', color: '#1890ff' }}>
                {form.getFieldValue('toStatus') === 'RE_EXPERIENCE' ? '再体验课安排' : '体验课安排'}
              </div>
              
              {/* 体验人员输入框 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 4, color: 'rgba(0, 0, 0, 0.85)' }}>
                  <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
                  体验人员
                </div>
                <Input 
                  value={trialStudentName}
                  onChange={(e) => setTrialStudentName(e.target.value)}
                  placeholder="请输入体验人员姓名"
                  style={{ width: '100%' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 4, color: 'rgba(0, 0, 0, 0.85)' }}>
                    <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
                    体验日期
                  </div>
                  <DatePicker 
                    value={experienceDate}
                    onChange={handleDateChange}
                    format="YYYY-MM-DD"
                    style={{ width: '100%' }}
                    placeholder="选择体验日期"
                    disabledDate={(current) => {
                      // 不能选择过去的日期
                      return current && current < dayjs().startOf('day');
                    }}
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 4, color: 'rgba(0, 0, 0, 0.85)' }}>
                    <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
                    体验时间
                  </div>
                  <TimePicker.RangePicker
                    value={experienceTimeRange}
                    open={timePickerOpen}
                    onOpenChange={(open) => {
                      setTimePickerOpen(open);
                      // 打开时重置计数器
                      if (open) {
                        setTimePickerClickCount(0);
                      }
                    }}
                    onCalendarChange={(times) => {
                      // 立即更新时间，无论是选第一个还是第二个
                      setExperienceTimeRange(times);
                      
                      // 增加点击计数
                      const newCount = timePickerClickCount + 1;
                      setTimePickerClickCount(newCount);
                      
                      // 检查是否已经选择了完整的时间（小时和分钟都有）
                      // 如果times[0]存在且包含完整的小时和分钟信息，就关闭
                      if (times && times.length >= 1 && times[0]) {
                        const firstTime = times[0];
                        // 检查时间对象是否有效且包含小时和分钟
                        if (firstTime && firstTime.isValid && firstTime.isValid()) {
                          const hasHour = firstTime.hour() !== undefined;
                          const hasMinute = firstTime.minute() !== undefined;
                          
                          // 如果已经点击了2次，或者时间已经完整（有小时和分钟），就关闭
                          if (newCount >= 2 || (hasHour && hasMinute)) {
                            setTimePickerOpen(false); // 关闭面板
                            setTimePickerClickCount(0); // 重置计数器
                          }
                        }
                      }
                    }}
                    onChange={handleTimeChange}
                    format="HH:mm"
                    style={{ width: '100%' }}
                    placeholder={['开始时间', '结束时间']}
                    minuteStep={30}
                    showNow={false}
                    inputReadOnly
                    use12Hours={false}
                    popupClassName="no-confirm-timepicker"
                    changeOnBlur={false}
                    disabledTime={() => ({
                      disabledHours: () => {
                        // 禁用10点之前和20点之后的小时（保留10-20点）
                        return [...Array(10).keys(), ...Array(4).keys().map(i => i + 21)];
                      }
                    })}
                    hideDisabledOptions={false}
                    showTime={{
                      hideDisabledOptions: false,
                      minuteStep: 30
                    }}
                  />
                </div>
              </div>
              
              {/* 只有有课表权限的用户才能看到和选择教练 */}
              {hasSchedulePermission && (
                <>
                  {/* 如果有原始安排且未修改，显示回显的教练信息（不可编辑） */}
                  {originalTrialSchedule && !scheduleModified && originalTrialSchedule.coachName ? (
                    <div>
                      <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.85)' }}>
                        体验教练
                      </div>
                      <div style={{ 
                        padding: '10px 12px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9',
                        color: 'rgba(0, 0, 0, 0.85)'
                      }}>
                        {originalTrialSchedule.coachName}
                      </div>
                      <div style={{ 
                        marginTop: 4,
                        fontSize: '12px',
                        color: '#999'
                      }}>
                        如需更换教练，请修改体验日期或时间
                      </div>
                    </div>
                  ) : loadingCoaches ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spin tip="正在查询有空的教练..." />
                    </div>
                  ) : availableCoaches.length > 0 ? (
                    <div>
                      <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.85)' }}>
                        <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
                        选择教练
                      </div>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '8px'
                      }}>
                        {availableCoaches.map(coach => (
                          <div
                            key={coach.id}
                            onClick={() => setSelectedCoach(coach.id === selectedCoach ? null : coach.id)}
                            style={{
                              padding: '10px 12px',
                              border: coach.id === selectedCoach ? '2px solid #1890ff' : '1px solid #d9d9d9',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              backgroundColor: coach.id === selectedCoach ? '#e6f7ff' : '#ffffff',
                              color: coach.id === selectedCoach ? '#1890ff' : 'rgba(0, 0, 0, 0.85)',
                              fontWeight: coach.id === selectedCoach ? '500' : 'normal',
                              transition: 'all 0.3s',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (coach.id !== selectedCoach) {
                                e.currentTarget.style.borderColor = '#40a9ff';
                                e.currentTarget.style.backgroundColor = '#f0f9ff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (coach.id !== selectedCoach) {
                                e.currentTarget.style.borderColor = '#d9d9d9';
                                e.currentTarget.style.backgroundColor = '#ffffff';
                              }
                            }}
                          >
                            {coach.nickname || coach.username}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (experienceDate && experienceTimeRange && experienceTimeRange.length === 2 && scheduleModified) ? (
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#fff2e8', 
                      borderRadius: '4px',
                      color: '#d46b08',
                      border: '1px solid #ffd591'
                    }}>
                      该时间段暂无可用教练
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

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
                paddingBottom: '16px',
                backgroundColor: existingTodoId && !isEditingReminder ? '#f5f5f5' : '#e6f7ff',
                borderRadius: '4px',
                border: existingTodoId && !isEditingReminder ? '1px solid #d9d9d9' : '1px dashed #1890ff',
                overflow: 'hidden'
              }}>
                {existingTodoId && !isEditingReminder ? (
                  // 已有提醒且未编辑状态：显示只读信息 + 编辑按钮
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: '14px', color: '#333' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        提醒时间：{reminderDate?.format('YYYY-MM-DD')} {reminderTime?.format('HH:mm')}
                      </div>
                      <Button 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={() => {
                          setIsEditingReminder(true);
                          setTempReminderDate(reminderDate);
                          setTempReminderTime(reminderTime);
                          setTempReminderContent(reminderContent);
                        }}
                      >
                        编辑
                      </Button>
                    </div>
                    {reminderContent && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#666',
                        padding: '8px',
                        backgroundColor: '#fafafa',
                        borderRadius: '4px',
                        border: '1px solid #e8e8e8'
                      }}>
                        {reminderContent}
                      </div>
                    )}
                  </>
                ) : (
                  // 新建提醒 或 编辑模式：显示日期时间选择器
                  <>
                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#1890ff', fontWeight: 500 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {isEditingReminder ? '编辑提醒时间：' : '提醒时间：'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: 12 }}>
                      <DatePicker
                        value={isEditingReminder ? tempReminderDate : reminderDate}
                        onChange={isEditingReminder ? setTempReminderDate : setReminderDate}
                        style={{ flex: 1 }}
                        placeholder="请选择日期"
                        format="YYYY-MM-DD"
                      />
                      <TimePicker
                        value={isEditingReminder ? tempReminderTime : reminderTime}
                        onChange={isEditingReminder ? setTempReminderTime : setReminderTime}
                        style={{ flex: 1 }}
                        placeholder="请选择时间"
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
                    <div style={{ marginBottom: isEditingReminder ? 8 : 0 }}>
                      <div style={{ marginBottom: 8, fontSize: '13px', color: '#1890ff', fontWeight: 500 }}>
                        提醒内容：
                      </div>
                      <TextArea
                        value={isEditingReminder ? tempReminderContent : reminderContent}
                        onChange={(e) => isEditingReminder ? setTempReminderContent(e.target.value) : setReminderContent(e.target.value)}
                        placeholder="输入状态变更的相关信息，如联系系统、预约时间等"
                        rows={3}
                        maxLength={500}
                        showCount
                      />
                    </div>
                    {isEditingReminder && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button 
                          size="small" 
                          icon={<CloseOutlined />}
                          onClick={() => {
                            setIsEditingReminder(false);
                            setTempReminderDate(null);
                            setTempReminderTime(null);
                            setTempReminderContent('');
                          }}
                        >
                          取消
                        </Button>
                        <Button 
                          size="small" 
                          type="primary"
                          icon={<SaveOutlined />}
                          onClick={async () => {
                            if (!tempReminderDate || !tempReminderTime) {
                              message.warning('请选择提醒日期和时间');
                              return;
                            }
                            
                            try {
                              const reminderDateTime = `${tempReminderDate.format('YYYY-MM-DD')} ${tempReminderTime.format('HH:mm:ss')}`;
                              await updateTodoReminderTime(existingTodoId, reminderDateTime);
                              
                              // 更新本地状态
                              setReminderDate(tempReminderDate);
                              setReminderTime(tempReminderTime);
                              setReminderContent(tempReminderContent);
                              setIsEditingReminder(false);
                              
                              message.success('提醒信息已更新');
                              
                              // 通知父组件刷新待办列表中的提醒时间
                              if (onTodoUpdated) {
                                onTodoUpdated({
                                  todoId: existingTodoId,
                                  reminderDate: tempReminderDate.format('YYYY-MM-DD'),
                                  reminderTime: tempReminderTime.format('HH:mm:ss')
                                });
                              }
                            } catch (error) {
                              console.error('更新提醒时间失败:', error);
                              message.error('更新提醒时间失败');
                            }
                          }}
                        >
                          确认
                        </Button>
                      </div>
                    )}
                  </>
                )}
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
                  dot={<div style={{ display: 'flex', alignItems: 'center', height: '32px', paddingTop: '4px' }}><ClockCircleOutlined style={{ fontSize: '16px' }} /></div>}
                  style={{
                    paddingBottom: '16px'
                  }}
                >
                  <div
                    style={{
                      padding: '8px',
                      borderRadius: '4px',
                      backgroundColor: isEditing ? '#f0f5ff' : 'transparent',
                      transition: 'background-color 0.3s',
                      border: isEditing ? '1px solid #d9d9d9' : '1px solid transparent'
                    }}
                  >
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space>
                        {history.fromStatusText && history.fromStatusText !== '无' && (
                          <>
                            <Tag color={getStatusColor(history.fromStatus)}>
                              {history.fromStatusText}
                            </Tag>
                            <span>→</span>
                          </>
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
                        {/* 如果是待体验状态且有体验时间，显示体验安排信息 */}
                        {(history.toStatus === 'SCHEDULED' || history.toStatus === 'RE_EXPERIENCE') && 
                         history.trialScheduleDate && history.trialStartTime && history.trialEndTime && (
                          <div style={{ 
                            marginBottom: 8, 
                            padding: '8px',
                            backgroundColor: history.trialCancelled ? '#f5f5f5' : '#f0f5ff',
                            borderRadius: '4px',
                            border: history.trialCancelled ? '1px solid #d9d9d9' : '1px solid #91caff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', color: history.trialCancelled ? '#999' : '#1890ff', marginBottom: 4 }}>
                                <CalendarOutlined style={{ marginRight: 4 }} />
                                体验时间：
                                {history.trialCancelled && (
                                  <Tag color="default" style={{ marginLeft: 8 }}>已取消</Tag>
                                )}
                              </div>
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#666',
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
                                onConfirm={() => handleCancelTrialSchedule(history)}
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

