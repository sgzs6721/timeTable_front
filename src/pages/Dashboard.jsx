import React, { useState, useEffect, useCallback } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Modal, Table, Divider, Tag, Popover, Input, Dropdown, Menu, Checkbox, DatePicker, Select, Tabs, Card, Statistic, Row, Col, Pagination } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, StarFilled, UpOutlined, DownOutlined, RetweetOutlined, InboxOutlined, DeleteOutlined, UserOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules, createSchedule, updateSchedule, deleteSchedule, updateTimetable, setActiveTimetable, archiveTimetableApi, getActiveSchedulesByDateMerged, copyTimetableToUser, getWeeksWithCountsApi, convertDateToWeeklyApi, convertWeeklyToDateApi, copyConvertDateToWeeklyApi, copyConvertWeeklyToDateApi, clearTimetableSchedules, getTodaySchedulesOnce, getTomorrowSchedulesOnce, getAllTimetables as getAllTimetablesSvc, getMyHoursPaged } from '../services/timetable';
import { getCoachesWithTimetables } from '../services/admin';
import { checkCurrentWeekInstance, generateCurrentWeekInstance, getCurrentWeekInstance, deleteInstanceSchedule, updateInstanceSchedule, createInstanceSchedule, getLeaveRecords, deleteLeaveRecordsBatch } from '../services/weeklyInstance';
import { getCoachesStatistics, getInstanceSchedulesByDate, getActiveWeeklySchedules, getActiveWeeklyTemplates, getAllTimetables as getAllTimetablesAdmin, getCoachLastMonthRecords } from '../services/admin';
import { getAllStudents } from '../services/weeklyInstance';
import dayjs from 'dayjs';
import EditScheduleModal from '../components/EditScheduleModal';
import StudentDetailModal from '../components/StudentDetailModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

// 我的学员组件 - 提取到Dashboard组件外部
const MyStudents = ({ onStudentClick, showAllCheckbox = true }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);

  const fetchStudents = React.useCallback(async (showAll = false) => {
    setLoading(true);
    try {
      const response = await getAllStudents(showAll);
      if (response && response.success) {
        setStudents(response.data || []);
      } else {
        message.error('获取学员列表失败');
      }
    } catch (error) {
      console.error('获取学员列表失败:', error);
      message.error('获取学员列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents(showAllStudents);
  }, [showAllStudents, fetchStudents]);

  const handleStudentClick = React.useCallback((studentName) => {
    onStudentClick(studentName);
  }, [onStudentClick]);

  const handleCheckboxChange = React.useCallback((e) => {
    setShowAllStudents(e.target.checked);
  }, []);

  // 生成学员头像颜色的函数
  const getStudentAvatarColor = (studentName) => {
    const colors = [
      '#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1',
      '#13c2c2', '#eb2f96', '#faad14', '#a0d911', '#2f54eb',
      '#f759ab', '#36cfc9', '#ff7875', '#ffa940', '#b37feb'
    ];
    // 使用学员名字的哈希值来确保相同名字总是得到相同颜色
    let hash = 0;
    for (let i = 0; i < studentName.length; i++) {
      hash = ((hash << 5) - hash + studentName.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            我的学员{students && students.length > 0 ? `（${students.length}）` : '（0）'}
          </span>
          {showAllCheckbox && (
            <Checkbox 
              checked={showAllStudents}
              onChange={handleCheckboxChange}
              style={{ marginLeft: '16px' }}
            >
              全部
            </Checkbox>
          )}
        </div>
      } 
      size="small"
    >
      <Spin spinning={loading}>
        {students.length === 0 ? (
          <Empty description="暂无学员" />
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px',
            padding: '16px 0'
          }}>
            {students.map((studentName, index) => (
              <div
                key={studentName}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 12px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                  backgroundColor: '#fafafa',
                  transition: 'all 0.3s ease',
                  ':hover': {
                    backgroundColor: '#f5f5f5',
                    borderColor: '#d9d9d9'
                  }
                }}
                onClick={() => handleStudentClick(studentName)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#d9d9d9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fafafa';
                  e.currentTarget.style.borderColor = '#f0f0f0';
                }}
              >
                <Avatar 
                  size={48}
                  style={{ 
                    backgroundColor: getStudentAvatarColor(studentName),
                    marginBottom: '8px',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  {studentName.charAt(0)}
                </Avatar>
                <span style={{ 
                  fontWeight: 500, 
                  fontSize: '14px',
                  textAlign: 'center',
                  wordBreak: 'break-all'
                }}>
                  {studentName}
                </span>
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};

// 新增的组件，用于添加新课程
const NewSchedulePopoverContent = ({ onAdd, onCancel, loading }) => {
  const [name, setName] = React.useState('');

  return (
    <div style={{ width: '180px', display: 'flex', flexDirection: 'column' }}>
      <Input
        size="small"
        placeholder="学生姓名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button size="small" onClick={onCancel} style={{ marginRight: 8 }} disabled={loading}>
          取消
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={() => onAdd(name)}
          disabled={!name.trim() || loading}
          loading={loading}
        >
          添加
        </Button>
      </div>
    </div>
  );
};

// 新增的组件，用于修改现有课程
const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onCancel, timetable, updateLoading, deleteLoading }) => {
  const [name, setName] = React.useState(schedule.studentName);
  const isNameChanged = name !== schedule.studentName;

  // 星期转换函数
  const convertDayOfWeekToChinese = (dayOfWeek) => {
    const dayMap = {
      'MONDAY': '星期一',
      'TUESDAY': '星期二', 
      'WEDNESDAY': '星期三',
      'THURSDAY': '星期四',
      'FRIDAY': '星期五',
      'SATURDAY': '星期六',
      'SUNDAY': '星期日'
    };
    return dayMap[dayOfWeek] || dayOfWeek;
  };

  return (
    <div style={{ width: '200px', display: 'flex', flexDirection: 'column' }}>
      {/* 关闭图标 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onCancel}
          style={{ padding: '0', minWidth: 'auto', height: 'auto' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', textAlign: 'left', gap: 4 }}>
        <strong>学生:</strong>
        <Input
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      {timetable.isWeekly ? (
        <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>星期:</strong> {convertDayOfWeekToChinese(schedule.dayOfWeek)}</p>
      ) : (
        <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>日期:</strong> {schedule.scheduleDate}</p>
      )}

      <p style={{ margin: '4px 0', textAlign: 'left' }}>
        <strong>时间:</strong> {schedule.startTime.substring(0,5)} - {schedule.endTime.substring(0,5)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <Button size="small" onClick={onCancel} disabled={updateLoading || deleteLoading}>取消</Button>
        <Button 
          type="primary" 
          danger 
          size="small" 
          onClick={onDelete}
          loading={deleteLoading}
          disabled={updateLoading}
        >
          删除
        </Button>
        <Button
          size="small"
          onClick={() => onUpdateName(name)}
          disabled={!isNameChanged || updateLoading || deleteLoading}
          loading={updateLoading}
          style={{
            backgroundColor: isNameChanged ? '#faad14' : undefined,
            borderColor: isNameChanged ? '#faad14' : undefined,
            color: isNameChanged ? 'white' : undefined
          }}
        >
          修改
        </Button>
      </div>
    </div>
  );
};

// 活动课表标识组件
const ActiveBadge = () => (
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    background: '#389e0d',
    borderTopLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '1px 1px 4px rgba(0,0,0,0.15)',
    zIndex: 1
  }}>
    <StarFilled style={{ color: 'white', fontSize: '10px' }} />
  </div>
);

const Dashboard = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timetables, setTimetables] = useState([]);
  const [archivedTimetables, setArchivedTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingScheduleCounts, setLoadingScheduleCounts] = useState(false);
  const [timetableScheduleCounts, setTimetableScheduleCounts] = useState({});
  const [todaysCoursesModalVisible, setTodaysCoursesModalVisible] = useState(false);
  
  // 管理员概览相关状态
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      return tabParam;
    }
    return user?.role?.toUpperCase() === 'ADMIN' ? 'overview' : 'timetables';
  });
  const [coachesStatistics, setCoachesStatistics] = useState(null);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [allTimetables, setAllTimetables] = useState([]);
  const [coachTimetableMap, setCoachTimetableMap] = useState({});
  const [todaysCoursesData, setTodaysCoursesData] = useState([]);
  const [modalMainTitle, setModalMainTitle] = useState('');
  const [modalSubTitle, setModalSubTitle] = useState('');
  const [todaysSchedulesForCopy, setTodaysSchedulesForCopy] = useState([]);
  const [tomorrowsCoursesData, setTomorrowsCoursesData] = useState([]);
  const [tomorrowsSchedulesForCopy, setTomorrowsSchedulesForCopy] = useState([]);
  
  // 学员详情模态框相关状态
  const [studentDetailVisible, setStudentDetailVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [modalSubTitleTomorrow, setModalSubTitleTomorrow] = useState('');
  // 管理员概览内 今日/明日/请假 tab 状态上移，避免子组件因重挂而重置
  const [adminDayTab, setAdminDayTab] = useState('today');
  const [studentColorMap, setStudentColorMap] = useState({});

  // 新增状态用于管理弹窗功能
  const [currentTimetable, setCurrentTimetable] = useState(null);
  const [allSchedulesData, setAllSchedulesData] = useState([]);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // 编辑课表名称相关状态
  const [editingTimetableId, setEditingTimetableId] = useState(null);
  const [editingTimetableName, setEditingTimetableName] = useState('');

  // 复制课表相关状态
  const [copyTimetableModalVisible, setCopyTimetableModalVisible] = useState(false);
  const [selectedTimetableForCopy, setSelectedTimetableForCopy] = useState(null);
  // 转换相关
  const [convertModal, setConvertModal] = useState({ visible: false, mode: null, timetable: null });
  const [weekOptions, setWeekOptions] = useState([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [dateRange, setDateRange] = useState([]);


  // 复制其他教练课程相关状态
  const [copyOtherCoachesToday, setCopyOtherCoachesToday] = useState(true);
  const [copyOtherCoachesTomorrow, setCopyOtherCoachesTomorrow] = useState(true);
  const [otherCoachesDataToday, setOtherCoachesDataToday] = useState([]);
  const [otherCoachesDataTomorrow, setOtherCoachesDataTomorrow] = useState([]);
  const [loadingOtherCoachesToday, setLoadingOtherCoachesToday] = useState(false);
  const [loadingOtherCoachesTomorrow, setLoadingOtherCoachesTomorrow] = useState(false);
  const [otherCoachesExpandedToday, setOtherCoachesExpandedToday] = useState(false);
  const [otherCoachesExpandedTomorrow, setOtherCoachesExpandedTomorrow] = useState(false);

  // 添加loading状态
  const [addLoading, setAddLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const navigate = useNavigate();

  // 清除缓存数据
  const clearCache = () => {
    sessionStorage.removeItem('dashboard_timetables');
    sessionStorage.removeItem('dashboard_schedule_counts');
    sessionStorage.removeItem('dashboard_cache_timestamp');
  };

  // 处理tab切换，同时更新URL参数
  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key });
  };

  // 获取所有课表信息并建立教练课表映射
  const fetchAllTimetablesInfo = useCallback(async () => {
    if (user?.role?.toUpperCase() !== 'ADMIN') return;
    
    try {
      const response = await getAllTimetablesAdmin(true); // 只获取活动课表
      if (response.success) {
        setAllTimetables(response.data);
        
        // 建立教练和课表ID的映射关系（后端已过滤，只返回活动课表）
        const coachMap = {};
        response.data.forEach(timetable => {
          const coachName = timetable.nickname || timetable.username;
          if (coachName) {
            coachMap[coachName] = timetable.id;
          }
        });
        setCoachTimetableMap(coachMap);
      }
    } catch (error) {
      console.error('获取课表信息失败:', error);
    }
  }, [user]);

  // 获取教练统计信息
  const fetchCoachesStatistics = useCallback(async () => {
    if (user?.role?.toUpperCase() !== 'ADMIN') return;
    
    setStatisticsLoading(true);
    try {
      const response = await getCoachesStatistics();
      if (response.success) {
        // 为每个教练添加唯一的 key
        const dataWithKeys = {
          ...response.data,
          coaches: response.data.coaches.map((coach, index) => ({
            ...coach,
            key: coach.id || `coach-${index}`
          }))
        };
        setCoachesStatistics(dataWithKeys);
      } else {
        message.error(response.message || '获取统计信息失败');
      }
    } catch (error) {
      console.error('获取教练统计信息失败:', error);
      message.error('获取统计信息失败，请稍后重试');
    } finally {
      setStatisticsLoading(false);
    }
  }, [user]);

  // 智能弹框定位函数
  const getSmartPlacement = useCallback((columnIndex) => {
    // Dashboard中的今明课程表格只有2列，比较简单
    // 根据屏幕宽度和列位置决定
    const screenWidth = window.innerWidth;

    if (screenWidth <= 768) {
      // 移动端，优先使用上下方向
      return 'top';
    }

    // 桌面端，根据列位置决定
    if (columnIndex === 0) {
      // 第一列，弹框显示在右侧
      return 'rightTop';
    } else {
      // 第二列，弹框显示在左侧
      return 'leftTop';
    }
  }, []);

  // 兼容移动端的复制函数
  const copyToClipboard = async (text) => {
    // 如果没有可复制的内容，直接弹出信息
    if (!text || text === '没有可复制的课程') {
      message.info(text || '没有可复制的课程');
      return;
    }

    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        message.success('已复制到剪贴板');
        return;
      }

      // 移动端兼容方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // 在移动端，需要先聚焦再选择
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);

      // 尝试复制
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        message.success('已复制到剪贴板');
      } else {
        throw new Error('复制失败');
      }
    } catch (error) {
      // 如果所有方法都失败，提示用户手动复制
      message.warning('复制失败，请长按选择文本手动复制');
      console.error('复制失败:', error);
    }
  };

  useEffect(() => {
    const fetchTimetables = async () => {
      // 检查是否有缓存的课表数据
      const cachedTimetables = sessionStorage.getItem('dashboard_timetables');
      const cachedScheduleCounts = sessionStorage.getItem('dashboard_schedule_counts');
      const cacheTimestamp = sessionStorage.getItem('dashboard_cache_timestamp');
      
      // 如果缓存存在且不超过5分钟，直接使用缓存数据
      if (cachedTimetables && cachedScheduleCounts && cacheTimestamp) {
        const now = Date.now();
        const cacheAge = now - parseInt(cacheTimestamp);
        if (cacheAge < 5 * 60 * 1000) { // 5分钟内
          try {
            const parsedTimetables = JSON.parse(cachedTimetables);
            const parsedScheduleCounts = JSON.parse(cachedScheduleCounts);
            
            const activeTimetables = parsedTimetables.filter(t => !t.isArchived);
            const archivedTimetables = parsedTimetables.filter(t => t.isArchived);
            
            setTimetables(activeTimetables);
            setArchivedTimetables(archivedTimetables);
            setTimetableScheduleCounts(parsedScheduleCounts);
            setLoading(false);
            return;
          } catch (error) {
            console.error('解析缓存数据失败:', error);
            // 清除损坏的缓存
            sessionStorage.removeItem('dashboard_timetables');
            sessionStorage.removeItem('dashboard_schedule_counts');
            sessionStorage.removeItem('dashboard_cache_timestamp');
          }
        }
      }
      
      try {
        // 添加超时保护
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('请求超时')), 10000)
        );
        const response = await Promise.race([getTimetables(), timeoutPromise]);
        const allTimetables = response.data;
        const activeTimetables = allTimetables.filter(t => !t.isArchived);
        const archivedTimetables = allTimetables.filter(t => t.isArchived);

        setTimetables(activeTimetables);
        setArchivedTimetables(archivedTimetables);

        // 先设置loading为false，让用户立即看到课表列表
        setLoading(false);
        
        // 异步获取每个课表的课程数量，不阻塞UI
        if (activeTimetables.length > 0) {
          setLoadingScheduleCounts(true);
        }
        const scheduleCounts = {};
        Promise.all(
          activeTimetables.map(async (timetable) => {
            try {
              const scheduleResponse = await getTimetableSchedules(timetable.id);
              if (scheduleResponse.success && scheduleResponse.data) {
                scheduleCounts[timetable.id] = scheduleResponse.data.length;
              } else {
                scheduleCounts[timetable.id] = 0;
              }
            } catch (error) {
              console.error(`获取课表 ${timetable.id} 的课程数量失败:`, error);
              scheduleCounts[timetable.id] = 0;
            }
          })
        ).then(() => {
          setTimetableScheduleCounts(scheduleCounts);
          setLoadingScheduleCounts(false);
          // 缓存数据
          sessionStorage.setItem('dashboard_timetables', JSON.stringify(allTimetables));
          sessionStorage.setItem('dashboard_schedule_counts', JSON.stringify(scheduleCounts));
          sessionStorage.setItem('dashboard_cache_timestamp', Date.now().toString());
        }).catch(() => {
          setLoadingScheduleCounts(false);
        });
      } catch (error) {
        message.error('获取课表列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetables();
    
    // 如果是管理员，获取教练统计信息和课表信息
    if (user?.role?.toUpperCase() === 'ADMIN') {
      fetchCoachesStatistics();
      fetchAllTimetablesInfo();
    }
  }, [user]); // 移除fetchCoachesStatistics依赖，避免无限循环

  // 设为活动课表
  const handleSetActiveTimetable = (id) => {
    Modal.confirm({
      title: '设为活动课表',
      content: '每个用户只能有一个活动课表，设为活动课表后，原有活动课表将被取消。确定要继续吗？',
      okText: '设为活动课表',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.loading({ content: '正在更新...', key: 'active' });
          const res = await setActiveTimetable(id);
          if (res.success) {
            // 更新本地状态：全部课表 isActive = false, 该课表 = true
            setTimetables(prev => prev.map(t => ({ ...t, isActive: t.id === id ? true : false })));
            clearCache(); // 清除缓存
            message.success({ content: '已设为活动课表', key: 'active' });
          } else {
            message.error({ content: res.message || '设置失败', key: 'active' });
          }
        } catch (error) {
          message.error({ content: '操作失败', key: 'active' });
        }
      },
    });
  };

  // 归档课表
  const handleArchiveTimetable = (id) => {
    Modal.confirm({
      title: '归档课表',
      content: '归档后该课表将从列表中隐藏，可在右上角头像菜单"归档课表"中查看和恢复。确定要归档吗？',
      okText: '归档',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await archiveTimetableApi(id);
          if (res.success) {
            // 重新获取课表列表以同步后端设置的新活动课表状态
            const response = await getTimetables();
            const allTimetables = response.data;
            const activeTimetables = allTimetables.filter(t => !t.isArchived);
            const archivedTimetables = allTimetables.filter(t => t.isArchived);
            
            setTimetables(activeTimetables);
            setArchivedTimetables(archivedTimetables);
            clearCache(); // 清除缓存
            
            // 更新课程数量
            const scheduleCounts = {};
            await Promise.all(
              activeTimetables.map(async (timetable) => {
                try {
                  const scheduleResponse = await getTimetableSchedules(timetable.id);
                  if (scheduleResponse.success && scheduleResponse.data) {
                    scheduleCounts[timetable.id] = scheduleResponse.data.length;
                  } else {
                    scheduleCounts[timetable.id] = 0;
                  }
                } catch (error) {
                  scheduleCounts[timetable.id] = 0;
                }
              })
            );
            setTimetableScheduleCounts(scheduleCounts);
            
            message.success('课表已归档');
          } else {
            message.error(res.message || '归档失败');
          }
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  // 清空课表
  const handleClearTimetable = (timetable) => {
    Modal.confirm({
      title: '确认清空课表',
      content: (
        <div>
          <div>{`确定要清空课表"${timetable.name}"的所有课程吗？此操作不可恢复。`}</div>
          {timetable.isWeekly === 1 && (
            <div style={{ marginTop: 12 }}>
              <Checkbox id="alsoClearCurrentWeekCheckbox">同时清空本周实例中的课程</Checkbox>
            </div>
          )}
        </div>
      ),
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const alsoClearCurrentWeek = timetable.isWeekly === 1 && document.getElementById('alsoClearCurrentWeekCheckbox')?.checked;
          const response = await clearTimetableSchedules(timetable.id, { alsoClearCurrentWeek });
          if (response.success) {
            message.success(`课表清空成功，共删除 ${response.data} 个课程`);
            
            // 更新课程数量
            setTimetableScheduleCounts(prev => ({
              ...prev,
              [timetable.id]: 0
            }));
          } else {
            message.error(response.message || '清空失败');
          }
        } catch (error) {
          message.error('清空失败');
        }
      },
    });
  };

  // 删除课表
  const handleDeleteTimetable = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个课表吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTimetable(id);
          message.success('课表删除成功');
          // 重新获取课表列表以同步后端设置的新活动课表状态
          const response = await getTimetables();
          const allTimetables = response.data;
          const activeTimetables = allTimetables.filter(t => !t.isArchived);
          const archivedTimetables = allTimetables.filter(t => t.isArchived);
          
          setTimetables(activeTimetables);
          setArchivedTimetables(archivedTimetables);
          clearCache(); // 清除缓存
          
          // 更新课程数量
          const scheduleCounts = {};
          await Promise.all(
            activeTimetables.map(async (timetable) => {
              try {
                const scheduleResponse = await getTimetableSchedules(timetable.id);
                if (scheduleResponse.success && scheduleResponse.data) {
                  scheduleCounts[timetable.id] = scheduleResponse.data.length;
                } else {
                  scheduleCounts[timetable.id] = 0;
                }
              } catch (error) {
                scheduleCounts[timetable.id] = 0;
              }
            })
          );
          setTimetableScheduleCounts(scheduleCounts);
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 操作菜单
  const getActionMenu = (item) => {
    const isOnlyOne = timetables.length === 1;
    const isActive = item.isActive;
    const setActiveDisabled = isOnlyOne || isActive;
    const hasSchedules = timetableScheduleCounts[item.id] > 0;

    return {
      items: [
        {
          key: 'active',
          label: '设为活动课表',
          icon: <StarFilled style={{ color: !setActiveDisabled ? '#52c41a' : '#bfbfbf' }} />,
          disabled: setActiveDisabled,
          onClick: () => handleSetActiveTimetable(item.id),
          style: { 
            color: !setActiveDisabled ? '#262626' : '#bfbfbf',
            fontWeight: '500'
          },
        },
        {
          key: 'copy',
          label: '复制课表',
          icon: <CopyOutlined style={{ color: hasSchedules ? '#52c41a' : '#bfbfbf' }} />,
          disabled: !hasSchedules,
          onClick: () => handleCopyTimetable(item),
          style: { 
            color: hasSchedules ? '#262626' : '#bfbfbf',
            fontWeight: '500'
          },
        },
        {
          key: 'convert',
          label: item.isWeekly ? '转为日期类课表' : '按某周转为周固定',
          icon: <RetweetOutlined style={{ color: hasSchedules ? '#fa8c16' : '#bfbfbf' }} />,
          disabled: !hasSchedules,
          onClick: async () => {
            if (item.isWeekly) {
              setConvertModal({ visible: true, mode: 'weeklyToDate', timetable: item });
            } else {
              try {
                const res = await getWeeksWithCountsApi(item.id);
                if (res.success) {
                  const options = res.data.filter(w=>w.count>0).map(w=>({ value: w.weekStart, label: `${w.weekStart} ~ ${w.weekEnd} (${w.count}节课)` }));
                  setWeekOptions(options);
                  setConvertModal({ visible: true, mode: 'dateToWeekly', timetable: item });
                } else { message.error(res.message || '获取周列表失败'); }
              } catch { message.error('获取周列表失败'); }
            }
          },
          style: { 
            color: hasSchedules ? '#262626' : '#bfbfbf',
            fontWeight: '500'
          },
        },
        {
          key: 'archive',
          label: '归档',
          icon: <InboxOutlined style={{ color: '#faad14' }} />,
          onClick: () => handleArchiveTimetable(item.id),
          style: { 
            color: '#262626',
            fontWeight: '500'
          },
        },
        {
          key: 'clear',
          label: '清空课表',
          icon: <DeleteOutlined style={{ color: hasSchedules ? '#ff7875' : '#bfbfbf' }} />,
          disabled: !hasSchedules,
          onClick: () => handleClearTimetable(item),
          style: { 
            color: hasSchedules ? '#262626' : '#bfbfbf',
            fontWeight: '500'
          },
        },
        {
          key: 'delete',
          label: '删除课表',
          icon: <CloseOutlined style={{ color: '#ff4d4f' }} />,
          danger: true,
          onClick: () => handleDeleteTimetable(item.id),
          style: { 
            color: '#262626',
            fontWeight: '500'
          },
        },
      ],
    };
  };

  // 更新单个课表的课程数量
  const updateTimetableScheduleCount = async (timetableId) => {
    try {
      const scheduleResponse = await getTimetableSchedules(timetableId);
      if (scheduleResponse.success && scheduleResponse.data) {
        setTimetableScheduleCounts(prev => ({
          ...prev,
          [timetableId]: scheduleResponse.data.length
        }));
      }
    } catch (error) {
      console.error(`更新课表 ${timetableId} 的课程数量失败:`, error);
    }
  };

  const handleCreateTimetable = () => {
    navigate('/create-timetable');
  };

  const handleViewTimetable = (id) => {
    navigate(`/view-timetable/${id}`);
  };

  const handleInputTimetable = (timetable) => {
    navigate(`/input-timetable/${timetable.id}`);
  };



  // 开始编辑课表名称
  const handleStartEditTimetableName = (timetableId, currentName) => {
    setEditingTimetableId(timetableId);
    setEditingTimetableName(currentName);
  };

  // 保存课表名称
  const handleSaveTimetableName = async (timetableId) => {
    if (!editingTimetableName.trim()) {
      message.warning('课表名称不能为空');
      return;
    }

    try {
      // 获取当前课表的完整信息
      const currentTimetable = timetables.find(t => t.id === timetableId);
      if (!currentTimetable) {
        message.error('找不到对应的课表');
        return;
      }

      // 构造完整的更新请求，保持其他字段不变，只修改name
      const updateData = {
        name: editingTimetableName.trim(),
        description: currentTimetable.description || '',
        type: currentTimetable.isWeekly ? 'WEEKLY' : 'DATE_RANGE',
        startDate: currentTimetable.startDate || null,
        endDate: currentTimetable.endDate || null
      };

      const response = await updateTimetable(timetableId, updateData);

      if (response.success) {
        message.success('课表名称修改成功');
        // 更新本地数据
        setTimetables(timetables.map(item =>
          item.id === timetableId
            ? { ...item, name: editingTimetableName.trim() }
            : item
        ));
        // 重置编辑状态
        setEditingTimetableId(null);
        setEditingTimetableName('');
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('修改失败，请检查网络连接');
    }
  };

  // 取消编辑课表名称
  const handleCancelEditTimetableName = () => {
    setEditingTimetableId(null);
    setEditingTimetableName('');
  };

  // 处理复制课表
  const handleCopyTimetable = (timetable) => {
    setSelectedTimetableForCopy(timetable);
    setEditingTimetableName(`${timetable.name} (复制)`);
    setCopyTimetableModalVisible(true);
  };

  // 确认复制课表
  const handleConfirmCopyTimetable = async () => {
    if (!editingTimetableName.trim()) {
      message.warning('请输入新课表名称');
      return;
    }

    if (!selectedTimetableForCopy) {
      message.error('请选择要复制的课表');
      return;
    }

    try {
      message.loading({ content: '正在复制课表...', key: 'copy' });
      
      // 调用后端复制接口，目标用户是当前用户
      const result = await copyTimetableToUser(
        selectedTimetableForCopy.id,
        user.id,
        editingTimetableName.trim()
      );

      if (result.success) {
        message.success({ content: '课表复制成功', key: 'copy' });
        
        // 重新获取课表列表
        const timetablesResponse = await getTimetables();
        if (timetablesResponse.success) {
          const allTimetables = timetablesResponse.data;
          const activeTimetables = allTimetables.filter(t => !t.isArchived);
          setTimetables(activeTimetables);

          // 更新课程数量
          const scheduleCounts = {};
          await Promise.all(
            activeTimetables.map(async (timetable) => {
              try {
                const scheduleResponse = await getTimetableSchedules(timetable.id);
                if (scheduleResponse.success && scheduleResponse.data) {
                  scheduleCounts[timetable.id] = scheduleResponse.data.length;
                } else {
                  scheduleCounts[timetable.id] = 0;
                }
              } catch (error) {
                console.error(`获取课表 ${timetable.id} 的课程数量失败:`, error);
                scheduleCounts[timetable.id] = 0;
              }
            })
          );
          setTimetableScheduleCounts(scheduleCounts);
        }

        // 关闭模态框
        setCopyTimetableModalVisible(false);
        setSelectedTimetableForCopy(null);
        setEditingTimetableName('');
      } else {
        message.error({ content: result.message || '复制失败', key: 'copy' });
      }
    } catch (error) {
      message.error({ content: '复制失败，请检查网络连接', key: 'copy' });
      console.error('复制课表失败:', error);
    }
  };

  const handleShowTodaysCourses = async (timetable) => {
    try {
      let allSchedules = [];
      
      if (timetable.isWeekly) {
        // 对于周固定课表，获取当前周实例数据
        try {
          // 先检查是否有当前周实例
          const checkResponse = await checkCurrentWeekInstance(timetable.id);
          if (checkResponse.success && checkResponse.data.hasCurrentWeekInstance) {
            // 有实例，获取实例数据
            const response = await getCurrentWeekInstance(timetable.id);
            if (response.success && response.data.hasInstance) {
              allSchedules = response.data.schedules;
            } else {
              message.error('获取当前周实例失败');
              return;
            }
          } else {
            // 没有实例，生成一个
            const generateResponse = await generateCurrentWeekInstance(timetable.id);
            if (generateResponse.success) {
              // 生成后获取课程数据
              const instanceResponse = await getCurrentWeekInstance(timetable.id);
              if (instanceResponse.success && instanceResponse.data.hasInstance) {
                allSchedules = instanceResponse.data.schedules;
              } else {
                message.error('生成实例后获取课程数据失败');
                return;
              }
            } else {
              message.error('生成当前周实例失败');
              return;
            }
          }
        } catch (error) {
          message.error('获取周固定课表实例失败');
          return;
        }
      } else {
        // 对于日期范围课表，使用原来的方式
        const response = await getTimetableSchedules(timetable.id);
        if (!response.success) {
          message.error(response.message || '获取课程安排失败');
          return;
        }
        allSchedules = response.data;
      }

      // 保存当前课表信息和所有课程数据
      setCurrentTimetable(timetable);
      setAllSchedulesData(allSchedules);

      const newStudentColorMap = { ...studentColorMap };
      let localColorIndex = Object.keys(newStudentColorMap).length;
      const localLightColorPalette = ['#f6ffed', '#e6f7ff', '#fff7e6', '#fff0f6', '#f9f0ff', '#f0f5ff' ];

      const assignColorToStudent = (studentName) => {
        if (studentName && !newStudentColorMap[studentName]) {
          newStudentColorMap[studentName] = localLightColorPalette[localColorIndex % localLightColorPalette.length];
          localColorIndex++;
        }
      };

      const generateDayData = (targetDate, isWeekly) => {
        let schedulesForDay = [];
        let subTitle = '';

        if (isWeekly) {
          // 对于周固定课表，数据已经是本周实例，直接按星期几过滤
          const weekDayMapEn = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const weekDayMapCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const dayOfWeekEn = weekDayMapEn[targetDate.day()];
          const dayOfWeekCn = weekDayMapCn[targetDate.day()];
          
          // 直接按星期几过滤本周实例中的课程
          schedulesForDay = allSchedules.filter(s => s.dayOfWeek === dayOfWeekEn);
          
          subTitle = `${targetDate.isSame(dayjs(), 'day') ? '今日' : '明日'}课程 (${targetDate.format('YYYY-MM-DD')} ${dayOfWeekCn})`;
        } else {
          const dateStr = targetDate.format('YYYY-MM-DD');
          schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
          subTitle = `${targetDate.isSame(dayjs(), 'day') ? '今日' : '明日'}课程 (${dateStr})`;
        }

        const sortedSchedules = schedulesForDay.sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (sortedSchedules.length === 0) {
          return { tableData: [], schedulesForCopy: [], subTitle };
        }

        sortedSchedules.forEach(s => assignColorToStudent(s.studentName));

        const firstScheduleHour = parseInt(sortedSchedules[0].startTime.substring(0, 2));

        const timeSlots = [];
        for (let hour = firstScheduleHour; hour <= 19; hour++) {
          timeSlots.push({
            time: `${hour.toString().padStart(2, '0')}:00`,
            displayTime: `${hour}-${hour + 1}`,
          });
        }

        const tableData = [];
        for (let i = 0; i < timeSlots.length; i += 2) {
          const leftSlot = timeSlots[i];
          const rightSlot = timeSlots[i + 1];
          const leftSchedule = sortedSchedules.find(s => s.startTime.substring(0, 5) === leftSlot.time);
          const rightSchedule = rightSlot ? sortedSchedules.find(s => s.startTime.substring(0, 5) === rightSlot.time) : null;
          tableData.push({
            key: i / 2,
            time1: leftSlot.displayTime,
            studentName1: leftSchedule ? leftSchedule.studentName : '',
            schedule1: leftSchedule || null,
            time2: rightSlot ? rightSlot.displayTime : '',
            studentName2: rightSchedule ? rightSchedule.studentName : '',
            schedule2: rightSchedule || null,
          });
        }
        return { tableData, schedulesForCopy: sortedSchedules, subTitle };
      };

      // Today
      const todayData = generateDayData(dayjs(), timetable.isWeekly);
      setTodaysCoursesData(todayData.tableData);
      setTodaysSchedulesForCopy(todayData.schedulesForCopy);
      setModalSubTitle(todayData.subTitle);

      // Tomorrow
      const tomorrowData = generateDayData(dayjs().add(1, 'day'), timetable.isWeekly);
      setTomorrowsCoursesData(tomorrowData.tableData);
      setTomorrowsSchedulesForCopy(tomorrowData.schedulesForCopy);
      setModalSubTitleTomorrow(tomorrowData.subTitle);

      if (todayData.tableData.length === 0 && tomorrowData.tableData.length === 0) {
        message.info('今天和明天都没有安排课程');
        return;
      }

      setStudentColorMap(newStudentColorMap);
      setModalMainTitle(timetable.name);
      setTodaysCoursesModalVisible(true);

      // 获取其他教练的今日课程数据
      setLoadingOtherCoachesToday(true);
      try {
        const todayDate = dayjs().format('YYYY-MM-DD');
        const todayResponse = await getInstanceSchedulesByDate(todayDate);
        if (todayResponse && todayResponse.success) {
          // 过滤掉当前课表的数据，只保留其他教练的数据
          const otherCoachesData = todayResponse.data.timetableSchedules?.filter(
            item => item.timetableId !== timetable.id
          ) || [];
          setOtherCoachesDataToday({ timetables: otherCoachesData });
        } else {
          console.warn('获取其他教练今日课程失败:', todayResponse?.error || '未知错误');
          setOtherCoachesDataToday(null);
        }
      } catch (error) {
        console.error('获取其他教练今日课程失败:', error);
        setOtherCoachesDataToday(null);
      } finally {
        setLoadingOtherCoachesToday(false);
      }

      // 获取其他教练的明日课程数据
      setLoadingOtherCoachesTomorrow(true);
      try {
        const tomorrowDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const tomorrowResponse = await getInstanceSchedulesByDate(tomorrowDate);
        if (tomorrowResponse && tomorrowResponse.success) {
          // 过滤掉当前课表的数据，只保留其他教练的数据
          const otherCoachesData = tomorrowResponse.data.timetableSchedules?.filter(
            item => item.timetableId !== timetable.id
          ) || [];
          setOtherCoachesDataTomorrow({ timetables: otherCoachesData });
        } else {
          console.warn('获取其他教练明日课程失败:', tomorrowResponse?.error || '未知错误');
          setOtherCoachesDataTomorrow(null);
        }
      } catch (error) {
        console.error('获取其他教练明日课程失败:', error);
        setOtherCoachesDataTomorrow(null);
      } finally {
        setLoadingOtherCoachesTomorrow(false);
      }

    } catch (error) {
      message.error('查询失败，请检查网络连接');
    }
  };

  // 生成复制文本
  const generateCopyText = (schedules, isToday = true, includeOtherCoaches = false, otherCoachesData = null) => {
    // 调试：打印currentTimetable的结构
    console.log('currentTimetable:', currentTimetable);
    console.log('user:', user);
    console.log('schedules:', schedules);
    console.log('includeOtherCoaches:', includeOtherCoaches);
    console.log('otherCoachesData:', otherCoachesData);
    
    // 检查是否有任何可复制的内容
    const hasCurrentCoachCourses = schedules && schedules.length > 0;
    const hasOtherCoachesCourses = includeOtherCoaches && otherCoachesData && otherCoachesData.timetables && otherCoachesData.timetables.length > 0;
    
    if (!hasCurrentCoachCourses && !hasOtherCoachesCourses) {
      return '没有可复制的课程';
    }
    
    // 获取当前教练名称 - 优先使用当前登录用户的信息
    const coachName = user?.nickname || user?.username || currentTimetable?.ownerName || currentTimetable?.nickname || currentTimetable?.username || currentTimetable?.user?.nickname || currentTimetable?.user?.username || '教练';
    
    // 构建标题
    const dateStr = isToday ? dayjs().format('YYYY年MM月DD日') : dayjs().add(1, 'day').format('YYYY年MM月DD日');
    const dayLabel = isToday ? '今日' : '明日';
    const title = `${dateStr} ${dayLabel}课程安排`;
    
    let result = title;
    
    // 构建当前教练的课程列表
    if (hasCurrentCoachCourses) {
      const courseList = schedules.map(schedule => {
          const startHour = parseInt(schedule.startTime.substring(0, 2));
          const displayTime = `${startHour}-${startHour + 1}`;
          return `${displayTime} ${schedule.studentName}`;
      }).join('\n');
      result += `\n${coachName}：\n${courseList}`;
    }

    // 如果需要包含其他教练的课程
    if (includeOtherCoaches && otherCoachesData && otherCoachesData.timetables && otherCoachesData.timetables.length > 0) {
      otherCoachesData.timetables.forEach(timetableInfo => {
        // 跳过当前教练的课表
        if (currentTimetable && timetableInfo.timetableId.toString() === currentTimetable.id.toString()) {
          return;
        }

        result += `\n${timetableInfo.ownerName}：`;
        const otherCourseList = timetableInfo.schedules.map(schedule => {
          const startHour = parseInt(schedule.startTime.substring(0, 2));
          const displayTime = `${startHour}-${startHour + 1}`;
          return `${displayTime} ${schedule.studentName}`;
        }).join('\n');
        result += `\n${otherCourseList}`;
      });
    }

    return result;
  };


  const getColumns = (colorMap) => [
    {
      title: '时间',
      dataIndex: 'time1',
      key: 'time1',
      width: '20%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName1',
      key: 'studentName1',
      width: '30%',
      align: 'center',
      onCell: (record) => ({
        style: {
          backgroundColor: record.studentName1 ? colorMap[record.studentName1] : undefined,
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `today-1-${record.key}`;
        const targetDate = dayjs();

        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement={getSmartPlacement(0)}
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time1)}
                  onCancel={() => setOpenPopoverKey(null)}
                  loading={addLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement={getSmartPlacement(0)}
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule1}
                  onDelete={() => handleDeleteSchedule(record.schedule1.id, record.schedule1)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                  updateLoading={updateLoading}
                  deleteLoading={deleteLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
    {
      title: '时间',
      dataIndex: 'time2',
      key: 'time2',
      width: '20%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName2',
      key: 'studentName2',
      width: '20%',
      align: 'center',
      onCell: (record) => ({
        style: {
          backgroundColor: record.studentName2 ? colorMap[record.studentName2] : undefined,
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `today-2-${record.key}`;
        const targetDate = dayjs();

        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement={getSmartPlacement(1)}
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time2)}
                  onCancel={() => setOpenPopoverKey(null)}
                  loading={addLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement={getSmartPlacement(1)}
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule2}
                  onDelete={() => handleDeleteSchedule(record.schedule2.id, record.schedule2)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                  updateLoading={updateLoading}
                  deleteLoading={deleteLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
  ];

  const getColumnsForTomorrow = (colorMap) => [
    {
      title: '时间',
      dataIndex: 'time1',
      key: 'time1',
      width: '20%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName1',
      key: 'studentName1',
      width: '20%',
      align: 'center',
      onCell: (record) => ({
        style: {
          backgroundColor: record.studentName1 ? colorMap[record.studentName1] : undefined,
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `tomorrow-1-${record.key}`;
        const targetDate = dayjs().add(1, 'day');

        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement={getSmartPlacement(0)}
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time1)}
                  onCancel={() => setOpenPopoverKey(null)}
                  loading={addLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement={getSmartPlacement(0)}
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule1}
                  onDelete={() => handleDeleteSchedule(record.schedule1.id, record.schedule1)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                  updateLoading={updateLoading}
                  deleteLoading={deleteLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
    {
      title: '时间',
      dataIndex: 'time2',
      key: 'time2',
      width: '20%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName2',
      key: 'studentName2',
      width: '20%',
      align: 'center',
      onCell: (record) => ({
        style: {
          backgroundColor: record.studentName2 ? colorMap[record.studentName2] : undefined,
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `tomorrow-2-${record.key}`;
        const targetDate = dayjs().add(1, 'day');

        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement={getSmartPlacement(1)}
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time2)}
                  onCancel={() => setOpenPopoverKey(null)}
                  loading={addLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement={getSmartPlacement(1)}
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule2}
                  onDelete={() => handleDeleteSchedule(record.schedule2.id, record.schedule2)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                  updateLoading={updateLoading}
                  deleteLoading={deleteLoading}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
  ];

  // 新增处理函数
  const handleAddSchedule = async (studentName, targetDate, displayTime) => {
    if (!studentName || !studentName.trim()) {
      message.warning('学生姓名不能为空');
      return;
    }

    setAddLoading(true);

    const [startHour, endHour] = displayTime.split('-');
    const startTime = `${startHour.padStart(2, '0')}:00:00`;
    const endTime = `${endHour.padStart(2, '0')}:00:00`;

    let payload = {
      studentName: studentName.trim(),
      startTime,
      endTime,
      note: '手动添加',
    };

    if (currentTimetable.isWeekly) {
      // 周课表需要使用英文格式的星期几
      const weekDayMapEn = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const dayOfWeek = weekDayMapEn[targetDate.day()];
      payload.dayOfWeek = dayOfWeek;
    } else {
      payload.scheduleDate = targetDate.format('YYYY-MM-DD');
      // 为日期范围课表计算星期几
      const weekDayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      payload.dayOfWeek = weekDayMap[targetDate.day()];
    }

    try {
      // 修正：周固定课表新增应写入“固定课表模板”，由后端决定是否同步至本周实例
      const response = await createSchedule(currentTimetable.id, payload);
      
      if (response.success) {
        message.success('添加成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
        // 更新课程数量
        updateTimetableScheduleCount(currentTimetable.id);
        // 失效该课表的短缓存，避免其它区块读取旧数据
        try {
          const { invalidateTimetableCache } = await import('../services/timetable');
          invalidateTimetableCache(currentTimetable.id);
        } catch (_) {}
      } else {
        message.error(response.message || '添加失败');
      }
    } catch (error) {
      message.error('网络错误，添加失败');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateSchedule = async (schedule, newName) => {
    if (!newName || newName.trim() === '') {
      message.warning('学生姓名不能为空');
      return;
    }

    setUpdateLoading(true);
    try {
      let response;
      // 检查是否是实例数据（通过schedule对象是否有instanceId字段来判断）
      if (schedule.instanceId || schedule.weeklyInstanceId) {
        // 使用实例更新API
        response = await updateInstanceSchedule(schedule.id, {
          studentName: newName.trim(),
        });
      } else {
        // 使用模板更新API
        response = await updateSchedule(currentTimetable.id, schedule.id, {
          studentName: newName.trim(),
        });
      }
      
      if (response.success) {
        message.success('修改成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
        // 更新课程数量
        updateTimetableScheduleCount(currentTimetable.id);
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId, schedule) => {
    setDeleteLoading(true);
    try {
      let response;
      // 检查是否是实例数据（通过schedule对象是否有instanceId字段来判断）
      if (schedule && (schedule.instanceId || schedule.weeklyInstanceId)) {
        // 使用实例删除API
        response = await deleteInstanceSchedule(scheduleId);
      } else {
        // 使用模板删除API
        response = await deleteSchedule(currentTimetable.id, scheduleId);
      }
      
      if (response.success) {
        message.success('删除成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
        // 更新课程数量
        updateTimetableScheduleCount(currentTimetable.id);
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setDeleteLoading(false);
    }
  };


  // 图标主色循环
  const iconColors = ['#dc2626','#1e40af','#059669','#7c3aed'];
  const getIconColor = (id) => iconColors[id % iconColors.length];

  // 渲染课表列表
  const renderTimetableList = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (timetables.length === 0) {
      return <Empty description="暂无课表，快去创建一个吧" />;
    }

    return (
      <List
        className="timetable-list"
        itemLayout="horizontal"
        dataSource={timetables}
        renderItem={(item) => (
          <List.Item
            style={{ position: 'relative' }}
            actions={[
              <Button type="link" onClick={() => handleShowTodaysCourses(item)}>今明课程</Button>,
              <Button type="link" onClick={() => handleInputTimetable(item)}>录入</Button>,
              <Button type="link" onClick={() => handleViewTimetable(item.id)}>查看</Button>,
              <Dropdown menu={getActionMenu(item)} trigger={["click"]} placement="bottomRight">
                <Button type="link">操作</Button>
              </Dropdown>
            ]}
          >
            {item.isActive ? <ActiveBadge /> : null}
            <List.Item.Meta
              className="timetable-item-meta"
              avatar={
                <div style={{ margin: 12 }}>
                <Avatar
                  shape="square"
                  size={48}
                  icon={<CalendarOutlined />}
                  style={{
                    backgroundColor: '#f9f0ff',
                    color: getIconColor(item.id),
                    border: '1px solid #e0d7f7',
                    borderRadius: '8px'
                  }}
                />
                </div>
              }
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingTimetableId === item.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Input
                          size="small"
                          value={editingTimetableName}
                          onChange={(e) => setEditingTimetableName(e.target.value)}
                          onPressEnter={() => handleSaveTimetableName(item.id)}
                          style={{ width: '200px' }}
                          autoFocus
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={() => handleSaveTimetableName(item.id)}
                          style={{ color: '#52c41a' }}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={handleCancelEditTimetableName}
                          style={{ color: '#ff4d4f' }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a onClick={() => handleViewTimetable(item.id)} style={{ fontWeight: 600, fontSize: 17 }}>{item.name}</a>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleStartEditTimetableName(item.id, item.name)}
                          style={{ color: '#1890ff', padding: '0 4px' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              }
              description={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888', fontSize: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>
                      {item.isWeekly ? (
                        <div>星期一至星期日</div>
                      ) : (
                        <div>{`${item.startDate} 至 ${item.endDate}`}</div>
                      )}
                    </div>
                    <div>
                      <span>创建于: {dayjs(item.createdAt).format('YYYY-MM-DD')}</span>
                      <span style={{ marginLeft: '16px' }}>共</span>
                      <span style={{ color: '#1890ff' }}>{timetableScheduleCounts[item.id] || 0}</span>
                      <span>课程</span>
                    </div>
                  </div>
                  <Tag
                    style={item.isWeekly
                      ? { backgroundColor: '#e6f7ff', borderColor: 'transparent', color: '#1890ff' }
                      : { backgroundColor: '#f9f0ff', borderColor: 'transparent', color: '#722ED1' }
                    }
                  >
                    {item.isWeekly ? '周固定课表' : '日期范围课表'}
                  </Tag>
                </div>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  // 渲染模态框
  const renderModals = () => (
    <>
      {/* 今明课程模态框 */}
      <Modal
        title={modalMainTitle}
        open={todaysCoursesModalVisible}
        onCancel={() => {
          setTodaysCoursesModalVisible(false);
          setTodaysCoursesData([]);
          setTomorrowsCoursesData([]);
          setTodaysSchedulesForCopy([]);
          setOtherCoachesExpandedToday(false);
          setOtherCoachesExpandedTomorrow(false);
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <div style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
          {modalSubTitle}
        </div>
        
        <Tabs
          defaultActiveKey="today"
          items={[
            {
              key: 'today',
              label: '今日课程',
              children: (
                <div>
                  <Table
                    columns={getColumns(studentColorMap)}
                    dataSource={todaysCoursesData}
                    pagination={false}
                    size="small"
                  />
                  
                  {/* 其他教练今日课程 */}
                  {todaysCoursesData.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500' }}>其他教练今日课程</span>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setOtherCoachesExpandedToday(!otherCoachesExpandedToday)}
                          loading={loadingOtherCoachesToday}
                        >
                          {otherCoachesExpandedToday ? '收起' : '展开'}
                        </Button>
                      </div>
                      {otherCoachesExpandedToday && (
                        <div style={{ 
                          maxHeight: '200px', 
                          overflowY: 'auto',
                          border: '1px solid #f0f0f0',
                          borderRadius: '4px',
                          padding: '8px'
                        }}>
                          {otherCoachesDataToday && otherCoachesDataToday.timetables && otherCoachesDataToday.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length > 0 ? (
                            otherCoachesDataToday.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).map((timetableInfo, index) => (
                              <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: index < otherCoachesDataToday.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{timetableInfo.ownerName}</div>
                                {timetableInfo.schedules.length > 0 ? (
                                  <div style={{ fontSize: '12px', color: '#666' }}>
                                    {(() => {
                                      // 每行显示两个课程
                                      const lines = [];
                                      for (let i = 0; i < timetableInfo.schedules.length; i += 2) {
                                        const lineItems = timetableInfo.schedules.slice(i, i + 2);
                                        lines.push(lineItems);
                                      }
                                      return lines.map((lineItems, lineIndex) => (
                                        <div key={lineIndex} style={{ 
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          marginBottom: lineIndex < lines.length - 1 ? '2px' : '0'
                                        }}>
                                          <span style={{ width: '48%' }}>
                                            {lineItems[0] ? `${lineItems[0].startTime.substring(0,5)}-${lineItems[0].endTime.substring(0,5)} ${lineItems[0].studentName}` : ''}
                                          </span>
                                          <span style={{ width: '48%' }}>
                                            {lineItems[1] ? `${lineItems[1].startTime.substring(0,5)}-${lineItems[1].endTime.substring(0,5)} ${lineItems[1].studentName}` : ''}
                                          </span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '12px', color: '#999' }}>今日无课程</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>暂无其他教练课程</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 复制按钮 */}
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Checkbox
                      checked={copyOtherCoachesToday}
                      onChange={(e) => setCopyOtherCoachesToday(e.target.checked)}
                      disabled={loadingOtherCoachesToday}
                    >
                      复制其他教练课程
                    </Checkbox>
                    <Button
                      onClick={() => {
                        const text = generateCopyText(todaysSchedulesForCopy, true, copyOtherCoachesToday, otherCoachesDataToday);
                        copyToClipboard(text);
                      }}
                    >
                      复制今日课程
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: 'tomorrow',
              label: '明日课程',
              children: (
                <div>
                  <Table
                    columns={getColumns(studentColorMap)}
                    dataSource={tomorrowsCoursesData}
                    pagination={false}
                    size="small"
                  />
                  
                  {/* 其他教练明日课程 */}
                  {(loadingOtherCoachesTomorrow || (otherCoachesDataTomorrow && otherCoachesDataTomorrow.timetables && otherCoachesDataTomorrow.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length > 0)) && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500' }}>其他教练明日课程</span>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setOtherCoachesExpandedTomorrow(!otherCoachesExpandedTomorrow)}
                          loading={loadingOtherCoachesTomorrow}
                        >
                          {otherCoachesExpandedTomorrow ? '收起' : '展开'}
                        </Button>
                      </div>
                      {otherCoachesExpandedTomorrow && (
                        <div style={{ 
                          maxHeight: '200px', 
                          overflowY: 'auto',
                          border: '1px solid #f0f0f0',
                          borderRadius: '4px',
                          padding: '8px'
                        }}>
                          {otherCoachesDataTomorrow && otherCoachesDataTomorrow.timetables && otherCoachesDataTomorrow.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length > 0 ? (
                            otherCoachesDataTomorrow.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).map((timetableInfo, index) => (
                              <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: index < otherCoachesDataTomorrow.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{timetableInfo.ownerName}</div>
                                {timetableInfo.schedules.length > 0 ? (
                                  <div style={{ fontSize: '12px', color: '#666' }}>
                                    {(() => {
                                      // 每行显示两个课程
                                      const lines = [];
                                      for (let i = 0; i < timetableInfo.schedules.length; i += 2) {
                                        const lineItems = timetableInfo.schedules.slice(i, i + 2);
                                        lines.push(lineItems);
                                      }
                                      return lines.map((lineItems, lineIndex) => (
                                        <div key={lineIndex} style={{ 
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          marginBottom: lineIndex < lines.length - 1 ? '2px' : '0'
                                        }}>
                                          <span style={{ width: '48%' }}>
                                            {lineItems[0] ? `${lineItems[0].startTime.substring(0,5)}-${lineItems[0].endTime.substring(0,5)} ${lineItems[0].studentName}` : ''}
                                          </span>
                                          <span style={{ width: '48%' }}>
                                            {lineItems[1] ? `${lineItems[1].startTime.substring(0,5)}-${lineItems[1].endTime.substring(0,5)} ${lineItems[1].studentName}` : ''}
                                          </span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '12px', color: '#999' }}>明日无课程</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>暂无其他教练课程</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 复制按钮 */}
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Checkbox
                      checked={copyOtherCoachesTomorrow}
                      onChange={(e) => setCopyOtherCoachesTomorrow(e.target.checked)}
                      disabled={loadingOtherCoachesTomorrow}
                    >
                      复制其他教练课程
                    </Checkbox>
                    <Button
                      onClick={() => {
                        const text = generateCopyText(tomorrowsSchedulesForCopy, false, copyOtherCoachesTomorrow, otherCoachesDataTomorrow);
                        copyToClipboard(text);
                      }}
                    >
                      复制明日课程
                    </Button>
                  </div>
                </div>
              )
            }
          ]}
        />
      </Modal>

      {/* 编辑课程模态框 */}
      {editingSchedule && (
        <EditScheduleModal
          visible={editModalVisible}
          schedule={editingSchedule}
          timetable={currentTimetable}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSchedule(null);
          }}
          onOk={(data) => {
            if (editingSchedule) {
              handleUpdateSchedule(editingSchedule, data.studentName);
              setEditModalVisible(false);
              setEditingSchedule(null);
            }
          }}
        />
      )}

      {/* 复制课表模态框 */}
      <Modal
        title="复制课表"
        open={copyTimetableModalVisible}
        onCancel={() => {
          setCopyTimetableModalVisible(false);
          setSelectedTimetableForCopy(null);
        }}
        onOk={handleConfirmCopyTimetable}
        okText="确认复制"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '6px' }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>源课表信息：</div>
          <div style={{ color: '#666' }}>
            {selectedTimetableForCopy?.name} ({selectedTimetableForCopy?.isWeekly ? '周固定课表' : '日期范围课表'})
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: 500, marginBottom: '8px' }}>新课表名称：</div>
          <Input
            placeholder={`${selectedTimetableForCopy?.name || ''} (复制)`}
            maxLength={100}
            showCount
            value={editingTimetableName}
            onChange={(e) => setEditingTimetableName(e.target.value)}
          />
        </div>

        <div style={{ padding: '12px', backgroundColor: '#fff7e6', borderRadius: '6px', border: '1px solid #ffd666' }}>
          <div style={{ fontSize: '12px', color: '#d46b08' }}>
            <div>• 复制后的课表将包含原课表的所有课程信息</div>
            <div>• 如果当前没有活动课表，复制的课表将自动设为活动状态</div>
            <div>• 每个用户最多只能有5个非归档课表</div>
          </div>
        </div>
      </Modal>

      {/* 转换弹窗 */}
      <Modal
        open={convertModal.visible}
        title={convertModal.mode === 'dateToWeekly' ? '转为周固定课表' : '转为日期范围课表'}
        onCancel={() => { setConvertModal({ visible: false, mode: null, timetable: null }); setSelectedWeekStart(null); setDateRange([]); }}
        onOk={async () => {
          if (!convertModal.timetable) return;
          
          // 显示loading消息
          message.loading({ content: '正在准备转换预览...', key: 'convert', duration: 0 });
          
          try {
            if (convertModal.mode === 'dateToWeekly') {
              if (!selectedWeekStart) { 
                message.warning('请选择一周'); 
                message.destroy('convert');
                return; 
              }
              
              // 延迟跳转，让用户看到loading效果
              setTimeout(() => {
                // 清除loading消息
                // message.destroy('convert'); // 移除此行
                
                const ws = dayjs(selectedWeekStart);
                const we = ws.add(6, 'day');
                navigate('/convert-preview', {
                  state: {
                    type: 'date-to-weekly',
                    sourceTimetable: convertModal.timetable,
                    weekStart: selectedWeekStart,
                    weekEnd: we.format('YYYY-MM-DD'),
                    newTimetableName: `${convertModal.timetable.name}-周固定`,
                    currentUserId: user?.id
                  }
                });
              }, 800);
              
            } else {
              if (!dateRange || dateRange.length !== 2) { 
                message.warning('请选择日期范围'); 
                message.destroy('convert');
                return; 
              }
              
              // 延迟跳转，让用户看到loading效果
              setTimeout(() => {
                // 清除loading消息
                
                const startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
                const endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');
                navigate('/convert-preview', {
                  state: {
                    type: 'weekly-to-date',
                    sourceTimetable: convertModal.timetable,
                    startDate: startDate,
                    endDate: endDate,
                    newTimetableName: `${convertModal.timetable.name}-日期`,
                    currentUserId: user?.id
                  }
                });
              }, 800);
            }
          } catch (error) { 
            message.error('操作失败'); 
            message.destroy('convert');
          }
        }}
        okText="确认"
        cancelText="取消"
      >
        {convertModal.mode === 'dateToWeekly' ? (
          <div>
            <div style={{ marginBottom: 8 }}>选择包含课程的一周：</div>
            <Select
              options={weekOptions}
              onChange={setSelectedWeekStart}
              style={{ width: '100%' }}
              placeholder="周一日期 ~ 周日日期 (课程数)"
            />
          </div>
        ) : convertModal.mode === 'weeklyToDate' ? (
          <div>
            <div style={{ marginBottom: 8 }}>开始日期：</div>
            <DatePicker
              style={{ width: '100%', marginBottom: 12 }}
              value={dateRange?.[0] || null}
              onChange={(v) => setDateRange([v, dateRange?.[1] || null])}
            />
            <div style={{ marginBottom: 8 }}>结束日期：</div>
            <DatePicker
              style={{ width: '100%' }}
              value={dateRange?.[1] || null}
              onChange={(v) => setDateRange([dateRange?.[0] || null, v])}
            />
          </div>
        ) : null}
      </Modal>
    </>
  );

  // 活动课表本周排课信息组件
  const WeeklyScheduleBlock = ({ coachColorMap }) => {
    const [weeklyScheduleData, setWeeklyScheduleData] = useState([]);
    const [weeklyScheduleLoading, setWeeklyScheduleLoading] = useState(false);
    const [viewMode, setViewMode] = useState('instance'); // 'instance' | 'template'
    const [allCoaches, setAllCoaches] = useState(new Set());
    const [selectedCoach, setSelectedCoach] = useState(null);
    const [coachBgColorMap, setCoachBgColorMap] = useState(new Map());
    const [coachCourseCount, setCoachCourseCount] = useState(new Map());
    const [studentBgColorMap, setStudentBgColorMap] = useState(new Map());
    
    // 半透明马卡龙调色板（更柔和）
    const colorPalette = [
      'rgba(186,225,255,0.45)', // sky
      'rgba(186,255,201,0.45)', // mint
      'rgba(255,183,197,0.45)', // pink
      'rgba(255,236,179,0.45)', // apricot
      'rgba(218,198,255,0.45)', // lavender
      'rgba(248,209,215,0.45)', // blush
      'rgba(255,255,186,0.45)', // lemon
      'rgba(210,245,228,0.45)', // aqua mint
      'rgba(197,225,165,0.45)', // light green
      'rgba(179,229,252,0.45)', // light blue
      'rgba(255,214,214,0.45)', // light coral
      'rgba(220,210,255,0.45)'  // pale violet
    ];

    // 解析 rgba(...) 或 rgb(...) 为数值数组
    const parseRgb = (color) => {
      if (!color) return [0, 0, 0];
      const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (m) {
        return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
      }
      // 简单处理 #rrggbb
      if (color.startsWith('#') && color.length === 7) {
        return [
          parseInt(color.slice(1, 3), 16),
          parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16)
        ];
      }
      return [0, 0, 0];
    };

    const colorDistance = (c1, c2) => {
      const [r1, g1, b1] = parseRgb(c1);
      const [r2, g2, b2] = parseRgb(c2);
      const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    // 挑选与 prevColor 差异最大的调色板颜色（用于避免相邻相近）
    const pickContrastingFromPalette = (prevColor) => {
      if (!prevColor) return colorPalette[0];
      let best = colorPalette[0];
      let bestDist = -1;
      for (const c of colorPalette) {
        const d = colorDistance(prevColor, c);
        if (d > bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return best;
    };
    
    useEffect(() => {
      fetchWeeklyScheduleData('instance'); // 明确指定初始加载为本周模式
    }, []); // 移除viewMode依赖，改为手动调用
    
    const fetchWeeklyScheduleData = async (targetMode = viewMode) => {
      setWeeklyScheduleLoading(true);
      console.log('fetchWeeklyScheduleData called with targetMode:', targetMode);
      try {
        // 根据目标视图模式获取不同的数据
        const response = targetMode === 'instance' 
          ? await getActiveWeeklySchedules()
          : await getActiveWeeklyTemplates();
        console.log('API response:', response);
        if (!response || !response.success) {
          const errorMsg = targetMode === 'instance' ? '获取本周排课数据失败' : '获取固定课表模板失败';
          console.error('API调用失败:', response);
          message.error(errorMsg);
          
          // 即使API失败，也要更新viewMode并设置空数据，确保UI状态正确
          setViewMode(targetMode);
          setWeeklyScheduleData([]);
          setAllCoaches(new Set());
          return;
        }
        
        const responseData = response.data;
        console.log('响应数据类型:', typeof responseData, '内容:', responseData);
        
        // 根据目标视图模式处理不同的数据格式
        let dates, schedules;
        if (targetMode === 'instance') {
          // 本周数据：直接是课程数组
          dates = [];
          schedules = Array.isArray(responseData) ? responseData : [];
        } else {
          // 固定模板数据：现在也是直接的课程数组
          dates = [];
          schedules = Array.isArray(responseData) ? responseData : [];
        }
        const weekDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        // 统计每位教练的课程数量（兼容不同返回字段）
        const countMap = new Map();
        (schedules || []).forEach(s => {
          const name = s.ownerNickname || s.ownerUsername || s.ownerName || s.username || s.nickname;
          if (!name) return;
          countMap.set(name, (countMap.get(name) || 0) + 1);
        });
        setCoachCourseCount(countMap);
        
        // 整理数据为表格格式
        const timeSlotMap = new Map();
        const allStudents = new Set();
        const allCoaches = new Set();
        
        // 统一处理：现在本周数据和模板数据都是扁平化的课程数组
        console.log(`处理${targetMode === 'instance' ? '本周' : '模板'}数据，课程数量:`, schedules.length);
        
        schedules.forEach((schedule, index) => {
          console.log(`检查课程 ${index + 1}:`, {
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            studentName: schedule.studentName
          });
          
          // 先跳过所有验证，看看数据本身有什么问题
          const dayOfWeek = schedule.dayOfWeek?.toLowerCase();
          
          // 如果没有有效的 dayOfWeek，暂时使用 'monday' 作为默认值进行测试
          const safeDayOfWeek = weekDayKeys.includes(dayOfWeek) ? dayOfWeek : 'monday';
          
          if (!schedule.startTime || !schedule.endTime) {
            console.warn(`课程 ${index + 1} 缺少时间信息，跳过`);
            return;
          }
          
          const timeKey = `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`;
          console.log(`强制添加课程到 ${safeDayOfWeek} ${timeKey}: ${schedule.studentName}`);
          
          if (!timeSlotMap.has(timeKey)) {
            timeSlotMap.set(timeKey, {
              time: timeKey,
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
              sunday: []
            });
          }
          
          const coachName = schedule.ownerNickname || schedule.ownerUsername;
          const scheduleItem = {
            coach: coachName,
            student: schedule.studentName,
            type: targetMode === 'instance' ? 'instance' : 'template',
            timetableName: schedule.timetableName,
            sourceIsWeekly: schedule.isWeekly === 1
          };
          
          timeSlotMap.get(timeKey)[safeDayOfWeek].push(scheduleItem);
          
          // 收集所有学员和教练
          allStudents.add(schedule.studentName);
          allCoaches.add(coachName);
        });
        
        // 转换为数组并按时间排序
        const tableData = Array.from(timeSlotMap.values())
          .sort((a, b) => a.time.localeCompare(b.time));
        
        // 如果没有数据，创建一个空的表格结构
        if (tableData.length === 0) {
          // 创建一个空的时间表作为占位
          const emptyTimeSlots = [
            '09:00-10:00', '10:00-11:00', '11:00-12:00',
            '14:00-15:00', '15:00-16:00', '16:00-17:00',
            '17:00-18:00', '18:00-19:00', '19:00-20:00'
          ];
          
          emptyTimeSlots.forEach(timeSlot => {
            tableData.push({
              time: timeSlot,
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
              sunday: []
            });
          });
        }
        
        const newCoachBgColorMap = new Map();
        Array.from(allCoaches).forEach((coach, index) => {
          newCoachBgColorMap.set(coach, colorPalette[index % colorPalette.length]);
        });
        setCoachBgColorMap(newCoachBgColorMap);

        const newStudentBgColorMap = new Map();
        Array.from(allStudents).forEach((student, index) => {
          newStudentBgColorMap.set(student, colorPalette[index % colorPalette.length]);
        });
        setStudentBgColorMap(newStudentBgColorMap);
        
        setWeeklyScheduleData(tableData);
        setAllCoaches(allCoaches);
        
        // 数据获取成功后更新viewMode
        setViewMode(targetMode);
        
        console.log('获取到的数据:', { dates, schedules, tableData, allStudents: Array.from(allStudents), allCoaches: Array.from(allCoaches) });
        console.log('最终tableData长度:', tableData.length);
        console.log('最终viewMode将被设置为:', targetMode);
      } catch (error) {
        console.error('获取排课数据失败:', error);
        console.error('错误详情:', error.stack);
        message.error(targetMode === 'instance' ? '获取本周排课数据失败' : '获取固定课表模板失败');
        
        // 即使失败也设置空数据，避免界面卡住
        setWeeklyScheduleData([]);
        setAllCoaches(new Set());
      } finally {
        setWeeklyScheduleLoading(false);
      }
    };
    
    // 切换到本周视图
    const switchToInstanceView = async () => {
      console.log('switchToInstanceView called, current viewMode:', viewMode);
      await fetchWeeklyScheduleData('instance');
    };
    
    // 切换到固定课表视图
    const switchToTemplateView = async () => {
      console.log('switchToTemplateView called, current viewMode:', viewMode);
      await fetchWeeklyScheduleData('template');
    };
    
    const renderScheduleCell = (schedules, day) => {
      const filteredByView = (schedules || []).filter(s => {
        if (viewMode === 'template') {
          // 固定：包含周固定来源 + 日期范围
          return (!!s.sourceIsWeekly) || s.type === 'dateRange' || s.type === 'template';
        }
        // 本周：包含实例 + 日期范围
        return s.type === 'instance' || s.type === 'dateRange';
      });

      const filtered = selectedCoach 
        ? filteredByView.filter(schedule => schedule.coach === selectedCoach)
        : filteredByView;

      if (!filtered || filtered.length === 0) {
        return <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
      }
      
      let lastColorInCell = null;

      const paletteSize = colorPalette.length;
      const nameHash = (s) => {
        s = String(s || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) - h) + s.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h);
      };

      return (
        <div style={{
          height: '100%',
          minHeight: '48px',
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}>
           {filtered.map((schedule, idx) => {
            // 1) 以学员名哈希为基准给定稳定索引
            const baseIndex = nameHash(schedule.student) % paletteSize;
            // 2) 如与上一块冲突，顺序探测寻找下一个不冲突颜色
            let candidate = baseIndex;
            let attempts = 0;
            let candidateColor = colorPalette[candidate];
            while (attempts < paletteSize && lastColorInCell && (candidateColor === lastColorInCell || colorDistance(candidateColor, lastColorInCell) < 80)) {
              candidate = (candidate + 1) % paletteSize;
              candidateColor = colorPalette[candidate];
              attempts++;
            }
            const bgColor = candidateColor;
            lastColorInCell = bgColor;
            
            // 在\"本周\"模式下，实例与固定不一致高亮
            let diffBorder = 'none';
            if (viewMode === 'instance' && schedule.type === 'instance') {
              const weeklySameStudent = (schedules || []).find(x => !!x.sourceIsWeekly && x.student === schedule.student);
              if (!weeklySameStudent || weeklySameStudent.coach !== schedule.coach) {
                diffBorder = '2px solid #fa8c16';
              }
            }
            return (
              <div
                key={`${schedule.coach}-${schedule.student}-${idx}`}
                style={{
                  backgroundColor: bgColor || 'transparent',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '12px',
                   fontWeight: 400,
                  wordBreak: 'break-word',
                  lineHeight: '1.2',
                  /* 让每个学员块铺满其等分区域，不留缝隙 */
                  width: '100%',
                  height: '100%',
                  border: diffBorder,
                  position: 'relative',
                  padding: 0,
                }}
                title={`教练: ${schedule.coach} | 学员: ${schedule.student}`}
              >
                {(() => {
                  const isTruncated = schedule.student.length > 4;
                  const content = isTruncated ? `${schedule.student.substring(0, 3)}…` : schedule.student;
                  return (
                    <span
                      className={isTruncated ? 'student-name-truncated' : ''}
                      title={isTruncated ? schedule.student : undefined}
                    >
                      {content}
                    </span>
                  );
                })()
                }
              </div>
            );
          })}
        </div>
      );
    };
    
    const weekDays = [
      { key: 'monday', title: '周一' },
      { key: 'tuesday', title: '周二' },
      { key: 'wednesday', title: '周三' },
      { key: 'thursday', title: '周四' },
      { key: 'friday', title: '周五' },
      { key: 'saturday', title: '周六' },
      { key: 'sunday', title: '周日' }
    ];
    
    // 生成表格列配置
    const columns = [
      {
        title: '时间',
        dataIndex: 'time',
        key: 'time',
        width: 60,
        align: 'center',
        render: (time) => {
          const [startTime, endTime] = time.split('-');
          return (
            <div style={{ 
              fontSize: '11px',
              fontWeight: 500, 
              color: '#333',
              lineHeight: '1.2',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}>
              <div>{startTime}</div>
              <div>{endTime}</div>
            </div>
          );
        }
      },
      ...weekDays.map((day, idx) => {
        // 计算“今天”对应的列（将周日=0转换为周一=0的索引）
        const todayIndex = (dayjs().day() + 6) % 7;
        const isTodayCol = idx === todayIndex;
        // 计算本周每一天的具体日期（以周一为一周开始）
        const monday = dayjs().day(1).startOf('day');
        const dateForCol = monday.add(idx, 'day').format('MM/DD');
        return {
          title: (
            <div
              style={{
                textAlign: 'center',
                fontWeight: isTodayCol ? 600 : 500,
                color: isTodayCol ? '#1677ff' : undefined
              }}
            >
              <div>{day.title}</div>
              {viewMode === 'instance' && <div style={{ fontSize: '10px', lineHeight: '12px', whiteSpace: 'nowrap', color: isTodayCol ? '#1677ff' : '#888' }}>{dateForCol}</div>}
            </div>
          ),
          dataIndex: day.key,
          key: day.key,
          align: 'center',
          onHeaderCell: () => ({
            style: isTodayCol ? { backgroundColor: '#e6f4ff' } : undefined
          }),
          render: (schedules) => renderScheduleCell(schedules, day.key)
        };
      })
    ];
    
    // 转换数据为表格格式
    const tableData = weeklyScheduleData.map((row, index) => ({
      key: index,
      time: row.time,
      monday: row.monday,
      tuesday: row.tuesday,
      wednesday: row.wednesday,
      thursday: row.thursday,
      friday: row.friday,
      saturday: row.saturday,
      sunday: row.sunday
    }));
    
    // 图例按照数量从多到少排序
    const coachesOrdered = React.useMemo(() => {
      const list = Array.from(allCoaches);
      return list.sort((a, b) => (coachCourseCount.get(b) || 0) - (coachCourseCount.get(a) || 0));
    }, [allCoaches, coachCourseCount]);

    return (
      <Card title={viewMode === 'instance' ? '本周排课信息' : '固定课表模板'} size="small" style={{ marginTop: '24px' }}
        extra={
          <div>
            <Button.Group>
              <Button 
                size="small" 
                type={viewMode==='instance' ? 'primary' : 'default'} 
                loading={weeklyScheduleLoading && viewMode !== 'instance'}
                disabled={weeklyScheduleLoading}
                onClick={switchToInstanceView}
              >
                本周
              </Button>
              <Button 
                size="small" 
                type={viewMode==='template' ? 'primary' : 'default'} 
                loading={weeklyScheduleLoading && viewMode !== 'template'}
                disabled={weeklyScheduleLoading}
                onClick={switchToTemplateView}
              >
                固定
              </Button>
            </Button.Group>
          </div>
        }
      >
        <Spin spinning={weeklyScheduleLoading}>
          {/* 教练颜色图例说明 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', justifyContent: 'center' }}>
              {coachesOrdered.map((coach, index) => (
                <div 
                  key={coach} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    cursor: 'pointer',
                    opacity: selectedCoach && selectedCoach !== coach ? 0.5 : 1,
                    transition: 'opacity 0.3s'
                  }}
                  onClick={() => setSelectedCoach(selectedCoach === coach ? null : coach)}
                >
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: coachBgColorMap.get(coach) || 'transparent', 
                    borderRadius: '2px' 
                  }}></div>
                  <span style={{ color: '#000', fontWeight: 500 }}>
                    {coach}
                    <span
                      style={{
                        marginLeft: 6,
                        fontWeight: 700,
                        color: (() => {
                          const c = coachBgColorMap.get(coach);
                          if (typeof c === 'string' && c.startsWith('rgba(')) {
                            const m = c.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
                            if (m) {
                              // 加深色彩
                              const r = Math.round(parseInt(m[1],10)*0.72);
                              const g = Math.round(parseInt(m[2],10)*0.72);
                              const b = Math.round(parseInt(m[3],10)*0.72);
                              return `rgb(${r}, ${g}, ${b})`;
                            }
                          }
                          return c || '#1677ff';
                        })()
                      }}
                    >
                      {coachCourseCount.get(coach) || 0}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={columns}
              dataSource={tableData}
              pagination={false}
              size="small"
              bordered
              rowClassName={() => 'weekly-schedule-row'}
              style={{ fontSize: '12px' }}
            />
          </div>
        </Spin>
      </Card>
    );
  };

  // 管理员概览组件
  const AdminOverview = ({ dayTab, setDayTab }) => {
    const { coaches, totalCoaches, totalTodayCourses, totalWeeklyCourses, totalLastWeekCourses } = coachesStatistics || {};
    
    // dayTab 由父组件托管（'today' | 'tomorrow' | 'leave'）
    const [tomorrowCoachDetails, setTomorrowCoachDetails] = useState({});
    const [coachDetailsLoading, setCoachDetailsLoading] = useState(false);
    
    // 请假记录相关状态
    const [leaveRecords, setLeaveRecords] = useState([]);
    const [leaveRecordsLoading, setLeaveRecordsLoading] = useState(false);
    const [selectedCoachTab, setSelectedCoachTab] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10; // 每页显示10个记录
    const [selectedRecords, setSelectedRecords] = useState(new Set());

    // 上月课程弹窗状态
    const [lastMonthModalVisible, setLastMonthModalVisible] = useState(false);
    const [lastMonthCoachName, setLastMonthCoachName] = useState('');
    const [lastMonthLoading, setLastMonthLoading] = useState(false);
    const [lastMonthRecords, setLastMonthRecords] = useState([]);

    const openLastMonthModal = async (coachName) => {
      setLastMonthCoachName(coachName);
      setLastMonthModalVisible(true);
      setLastMonthLoading(true);
      try {
        // 根据教练名找到其ID
        const coach = (coaches || []).find(c => (c.nickname || c.username) === coachName);
        if (!coach) {
          setLastMonthRecords([]);
          setLastMonthLoading(false);
          return;
        }
        const resp = await getCoachLastMonthRecords(coach.id);
        if (resp && resp.success) {
          const list = (resp.data || []).map(x => ({
            scheduleDate: x.date,
            timeRange: `${String(x.startTime||'').slice(0,5)}-${String(x.endTime||'').slice(0,5)}`,
            studentName: x.studentName || '',
            status: x.isOnLeave ? '请假' : '正常'
          }));
          setLastMonthRecords(list);
        } else {
          setLastMonthRecords([]);
        }
      } catch (error) {
        message.error('获取上月课程记录失败');
      } finally {
        setLastMonthLoading(false);
      }
    };

    // 获取请假记录
    const fetchLeaveRecords = async () => {
      setLeaveRecordsLoading(true);
      try {
        const response = await getLeaveRecords();
        if (response && response.success) {
          setLeaveRecords(response.data || []);
        } else {
          message.error('获取请假记录失败');
        }
      } catch (error) {
        console.error('获取请假记录失败:', error);
        message.error('获取请假记录失败');
      } finally {
        setLeaveRecordsLoading(false);
      }
    };

    // 删除选中的请假记录
    const deleteSelectedRecords = async () => {
      if (selectedRecords.size === 0) {
        message.warning('请先选择要删除的记录');
        return;
      }
      
      // 显示确认对话框
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除选中的 ${selectedRecords.size} 条请假记录吗？删除后无法恢复。`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const recordsToDelete = Array.from(selectedRecords);
            
            // 调用后端API删除记录
            const response = await deleteLeaveRecordsBatch(recordsToDelete);
            
            if (response && response.success) {
              // 更新本地状态
              setLeaveRecords(prev => prev.filter(record => !selectedRecords.has(record.id)));
              setSelectedRecords(new Set());
              message.success(`成功删除 ${recordsToDelete.length} 条记录`);
            } else {
              message.error(response?.message || '删除记录失败');
            }
          } catch (error) {
            console.error('删除记录失败:', error);
            message.error('删除记录失败，请重试');
          }
        }
      });
    };

    // 当切到“请假”页时自动拉取数据，避免空白
    useEffect(() => {
      if (dayTab === 'leave') {
        fetchLeaveRecords();
      }
    }, [dayTab]);

    // 切换记录选中状态
    const toggleRecordSelection = (recordId) => {
      setSelectedRecords(prev => {
        const newSet = new Set(prev);
        if (newSet.has(recordId)) {
          newSet.delete(recordId);
        } else {
          newSet.add(recordId);
        }
        return newSet;
      });
    };

    // 点击学员名字显示详情
    const handleStudentClick = (studentName, coachName) => {
      setSelectedStudent(studentName);
      setSelectedCoach(coachName);
      setStudentDetailVisible(true);
    };

    // 额外拉取今日活动课表的课程，用于显示学员+时间（后端统计缺少明细时兜底）
    const [todayCoachDetails, setTodayCoachDetails] = useState({});
    const [todayCoachLeaves, setTodayCoachLeaves] = useState({});

    // 统一教练颜色（高区分度深色，按教练列表顺序分配，避免重复）
    const coachPalette = ['#dc2626', '#38bdf8', '#059669', '#7c3aed'];
    const coachColorMap = React.useMemo(() => {
      const map = {};
      (coaches || []).forEach((c, idx) => {
        const name = c?.nickname || c?.username;
        if (name && !map[name]) {
          map[name] = coachPalette[idx % coachPalette.length];
        }
      });
      return map;
    }, [coaches]);
    const colorForCoach = (name) => coachColorMap[name] || coachPalette[0];

    // 计算明日课时总数
    const totalTomorrowCourses = Object.values(tomorrowCoachDetails).reduce((total, details) => {
      return total + (details ? details.length : 0);
    }, 0);
    
    // 计算上周课时总数 (暂时设为0，可以根据需要从后端获取)
    // const totalLastWeekCourses = 0;
    useEffect(() => {
      if (!coachesStatistics) return;
      
      setCoachDetailsLoading(true);
      const todayStr = dayjs().format('YYYY-MM-DD');
      const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
      
      const normalizeName = (name) => String(name || '').replace(/[\s\u3000]/g, '');
      const hhmm = (t) => String(t).slice(0, 5);

      Promise.all([
        // 获取今日数据（一次性）
        getInstanceSchedulesByDate(todayStr).then(res => {
          if (res && res.success && res.data) {
            const list = res.data.timetables || res.data.timetableSchedules || [];
            const map = {};
            list.forEach(t => {
              const owner = t.ownerName || t.username || t.nickname;
              const schedules = t.schedules || [];
              
              // 去重：基于学生姓名、开始时间、结束时间的组合
              const uniqueSchedules = [];
              const seen = new Set();
              
              schedules.forEach(s => {
                // 过滤掉请假学员，不显示在今日课程中
                if (s.isOnLeave) {
                  return;
                }
                const key = `${normalizeName(s.studentName)}_${hhmm(s.startTime)}_${hhmm(s.endTime)}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  uniqueSchedules.push(s);
                }
              });
              
              // 按开始时间排序后再生成显示文本
              const sortedSchedules = uniqueSchedules.sort((a, b) => {
                const timeA = hhmm(a.startTime);
                const timeB = hhmm(b.startTime);
                return timeA.localeCompare(timeB);
              });
                const items = sortedSchedules.map(s => {
                  const base = `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`;
                  return base;
                });
              if (items.length > 0) {
                map[owner] = items;
              }
            });
            if (Object.keys(map).length > 0) {
              setTodayCoachDetails(map);
            } else {
              // 使用合并版接口，避免重复请求
              return getActiveSchedulesByDateMerged(todayStr).then(res2 => {
                if (res2 && res2.success && res2.data && res2.data.timetables) {
                  const map2 = {};
                  res2.data.timetables.forEach(t => {
                    const owner2 = t.ownerName || t.username || t.nickname;
                    const schedules2 = t.schedules || [];
                    
                    // 去重：基于学生姓名、开始时间、结束时间的组合
                    const uniqueSchedules2 = [];
                    const seen2 = new Set();
                    
                    schedules2.forEach(s => {
                      // 过滤掉请假学员，不显示在今日课程中
                      if (s.isOnLeave) {
                        return;
                      }
                      const key = `${normalizeName(s.studentName)}_${hhmm(s.startTime)}_${hhmm(s.endTime)}`;
                      if (!seen2.has(key)) {
                        seen2.add(key);
                        uniqueSchedules2.push(s);
                      }
                    });
                    
                    // 按开始时间排序后再生成显示文本
                    const sortedSchedules2 = uniqueSchedules2.sort((a, b) => {
                      const timeA = hhmm(a.startTime);
                      const timeB = hhmm(b.startTime);
                      return timeA.localeCompare(timeB);
                    });
                  const items2 = sortedSchedules2.map(s => {
                    const base2 = `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`;
                    return base2;
                  });
                  if (items2.length > 0) map2[owner2] = items2;
                  });
                  setTodayCoachDetails(map2);
                }
              });
            }
          }
        }).catch(() => {}),
        
        // 获取明日数据（一次性）
        getInstanceSchedulesByDate(tomorrowStr).then(res => {
          if (res && res.success && res.data) {
            const list = res.data.timetables || res.data.timetableSchedules || [];
            const map = {};
            list.forEach(t => {
              const owner = t.ownerName || t.username || t.nickname;
              const schedules = t.schedules || [];
              
              // 去重：基于学生姓名、开始时间、结束时间的组合
              const uniqueSchedules = [];
              const seen = new Set();
              
              schedules.forEach(s => {
                const key = `${normalizeName(s.studentName)}_${hhmm(s.startTime)}_${hhmm(s.endTime)}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  uniqueSchedules.push(s);
                }
              });
              
              // 按开始时间排序后再生成显示文本
              const sortedSchedules = uniqueSchedules.sort((a, b) => {
                const timeA = hhmm(a.startTime);
                const timeB = hhmm(b.startTime);
                return timeA.localeCompare(timeB);
              });
              const items = sortedSchedules.map(s => `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`);
              if (items.length > 0) {
                map[owner] = items;
              }
            });
            if (Object.keys(map).length > 0) {
              setTomorrowCoachDetails(map);
            } else {
              return getActiveSchedulesByDateMerged(tomorrowStr).then(res2 => {
                if (res2 && res2.success && res2.data && res2.data.timetables) {
                  const map2 = {};
                  res2.data.timetables.forEach(t => {
                    const owner2 = t.ownerName || t.username || t.nickname;
                    const schedules2 = t.schedules || [];
                    
                    // 去重：基于学生姓名、开始时间、结束时间的组合
                    const uniqueSchedules2 = [];
                    const seen2 = new Set();
                    
                    schedules2.forEach(s => {
                      const key = `${normalizeName(s.studentName)}_${hhmm(s.startTime)}_${hhmm(s.endTime)}`;
                      if (!seen2.has(key)) {
                        seen2.add(key);
                        uniqueSchedules2.push(s);
                      }
                    });
                    
                    // 按开始时间排序后再生成显示文本
                    const sortedSchedules2 = uniqueSchedules2.sort((a, b) => {
                      const timeA = hhmm(a.startTime);
                      const timeB = hhmm(b.startTime);
                      return timeA.localeCompare(timeB);
                    });
                    const items2 = sortedSchedules2.map(s => {
                      const base2 = `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`;
                      return s.isOnLeave ? `${base2} 请假` : base2;
                    });
                    if (items2.length > 0) map2[owner2] = items2;
                  });
                  setTomorrowCoachDetails(map2);
                }
              });
            }
          }
        }).catch(() => {})
      ]).finally(() => {
        setCoachDetailsLoading(false);
      });
    }, [coachesStatistics]);

    // 准备图表数据
    const chartData = (coaches || []).map(coach => ({
      name: coach.nickname || coach.username,
      todayCourses: coach.todayCourses,
      weeklyCourses: coach.weeklyCourses
    }));

    const pieData = [
      { name: '今日有课', value: (coaches || []).filter(c => c.todayCourses > 0).length },
      { name: '今日无课', value: (coaches || []).filter(c => c.todayCourses === 0).length }
    ];

    const COLORS = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2'];

    return (
      <div>
        {/* 统计卡片：每行四个 */}
        <Row gutter={[8, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={6} sm={6}>
            <Card
              style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              styles={{ body: { padding: '12px 0', textAlign: 'center' } }}
            >
              <Spin spinning={statisticsLoading} size="small">
                <Statistic
                  title="本周课时"
                  value={totalWeeklyCourses || 0}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#faad14' }}
                  titleStyle={{ whiteSpace: 'nowrap' }}
                />
              </Spin>
            </Card>
          </Col>
          <Col xs={6} sm={6}>
            <Card
              style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              styles={{ body: { padding: '12px 0', textAlign: 'center' } }}
            >
              <Spin spinning={statisticsLoading} size="small">
                <Statistic
                  title="今日课时"
                  value={totalTodayCourses || 0}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  titleStyle={{ whiteSpace: 'nowrap' }}
                />
              </Spin>
            </Card>
          </Col>
          <Col xs={6} sm={6}>
            <Card
              style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              styles={{ body: { padding: '12px 0', textAlign: 'center' } }}
            >
              <Spin spinning={coachDetailsLoading || statisticsLoading} size="small">
                <Statistic
                  title="明日课时"
                  value={totalTomorrowCourses || 0}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                  titleStyle={{ whiteSpace: 'nowrap' }}
                />
              </Spin>
            </Card>
          </Col>
          <Col xs={6} sm={6}>
            <Card
              style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              styles={{ body: { padding: '12px 0', textAlign: 'center' } }}
            >
              <Spin spinning={statisticsLoading} size="small">
                <Statistic
                  title="上周课时"
                  value={totalLastWeekCourses || 0}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                  titleStyle={{ whiteSpace: 'nowrap' }}
                />
              </Spin>
            </Card>
          </Col>
        </Row>

        {/* 今明有课教练切换卡片 */}
        <Card
          size="small"
          style={{ marginBottom: '24px' }}
          styles={{ body: { padding: '0 24px 16px 24px' } }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
              <div>
                <Button.Group>
                  <Button type={dayTab==='today' ? 'primary' : 'default'} size="small" onClick={()=>setDayTab('today')}>今日</Button>
                  <Button type={dayTab==='tomorrow' ? 'primary' : 'default'} size="small" onClick={()=>setDayTab('tomorrow')}>明日</Button>
                  <Button type={dayTab==='leave' ? 'primary' : 'default'} size="small" onClick={()=>{
                    setDayTab('leave');
                    fetchLeaveRecords();
                  }}>请假</Button>
                </Button.Group>
              </div>
              <span style={{ color: '#999', fontSize: 13, textAlign: 'right', display: 'block', width: '100%' }}>
                {dayTab==='today' ? '今日有课教练' : dayTab==='tomorrow' ? '明日有课教练' : '请假记录'} 
                <span style={{ color: '#1890ff', fontWeight: 500 }}>{
                  dayTab==='today'
                    ? Object.entries(todayCoachDetails).filter(([_, items]) => items.some(item => !item.includes('（请假）'))).length
                    : dayTab==='tomorrow'
                    ? Object.entries(tomorrowCoachDetails).filter(([_, items]) => items.some(item => !item.includes('（请假）'))).length
                    : leaveRecords.length
                }</span>
                {dayTab !== 'leave' && <span style={{ color: '#999' }}>/{coaches?.length || 0}</span>}
              </span>
            </div>
          }
        >
          <Spin spinning={coachDetailsLoading || statisticsLoading || leaveRecordsLoading}>
          {dayTab === 'leave' ? (
            // 请假记录显示
            leaveRecords.length === 0 ? (
              <div style={{ color: '#999', paddingTop: '16px' }}>暂无请假记录</div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {(() => {
                  // 按教练分组
                  const groupedByCoach = leaveRecords.reduce((acc, record) => {
                    const coachName = record.coachName;
                    if (!acc[coachName]) {
                      acc[coachName] = [];
                    }
                    acc[coachName].push(record);
                    return acc;
                  }, {});

                  const coachNames = Object.keys(groupedByCoach);
                  
                  // 如果没有选中教练，默认选中第一个
                  if (!selectedCoachTab && coachNames.length > 0) {
                    setSelectedCoachTab(coachNames[0]);
                  }

                  return (
                    <div>
                      {/* 教练tab切换 */}
                      <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {coachNames.map((coachName) => (
                            <span
                              key={coachName}
                              onClick={() => {
                                setSelectedCoachTab(coachName);
                                setCurrentPage(1); // 切换教练时重置到第一页
                              }}
                              style={{
                                cursor: 'pointer',
                                color: selectedCoachTab === coachName ? '#1890ff' : '#666',
                                fontSize: '14px',
                                fontWeight: selectedCoachTab === coachName ? 'bold' : 'normal',
                                borderBottom: selectedCoachTab === coachName ? '2px solid #1890ff' : '2px solid transparent',
                                paddingBottom: '4px',
                                transition: 'all 0.3s'
                              }}
                            >
                              {coachName}（{groupedByCoach[coachName].length}）
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 显示选中教练的请假记录 */}
                      {selectedCoachTab && groupedByCoach[selectedCoachTab] && (
                        <div>
                          {/* 删除按钮 */}
                          {selectedRecords.size > 0 && (
                            <div style={{ 
                              marginBottom: '12px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center' 
                            }}>
                              <span style={{ color: '#666', fontSize: '12px' }}>
                                已选择 {selectedRecords.size} 条记录
                              </span>
                              <button
                                onClick={deleteSelectedRecords}
                                style={{
                                  padding: '4px 12px',
                                  backgroundColor: '#ff4d4f',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                删除选中
                              </button>
                            </div>
                          )}

                          {/* 该教练的请假记录，单列显示 */}
                          {(() => {
                            const records = groupedByCoach[selectedCoachTab];
                            const totalPages = Math.ceil(records.length / pageSize);
                            const startIndex = (currentPage - 1) * pageSize;
                            const endIndex = startIndex + pageSize;
                            const currentRecords = records.slice(startIndex, endIndex);
                            
                            // 按学员分组，计算每个学员的请假次数
                            const studentLeaveCount = records.reduce((acc, record) => {
                              const studentName = record.studentName;
                              if (!acc[studentName]) {
                                acc[studentName] = 0;
                              }
                              acc[studentName]++;
                              return acc;
                            }, {});

                            return (
                              <div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {currentRecords.map((record, index) => (
                                    <div key={startIndex + index} style={{ 
                                      width: '100%',
                                      padding: '6px 12px', 
                                      backgroundColor: selectedRecords.has(record.id) ? '#e6f7ff' : '#f9f9f9', 
                                      borderRadius: '4px',
                                      border: selectedRecords.has(record.id) ? '1px solid #91d5ff' : '1px solid #e8e8e8',
                                      fontSize: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '12px'
                                    }}>
                                      {/* 复选框 */}
                                      <input
                                        type="checkbox"
                                        checked={selectedRecords.has(record.id)}
                                        onChange={() => toggleRecordSelection(record.id)}
                                        style={{ 
                                          width: '16px', 
                                          height: '16px',
                                          cursor: 'pointer'
                                        }}
                                      />
                                      
                                      {/* 记录内容 */}
                                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div style={{ 
                                            fontSize: '10px', 
                                            color: '#ff4d4f', 
                                            backgroundColor: '#fff2f0', 
                                            padding: '1px 4px', 
                                            borderRadius: '2px',
                                            border: '1px solid #ffccc7'
                                          }}>
                                            {studentLeaveCount[record.studentName]}次
                                          </div>
                                          <span 
                                            style={{ 
                                              fontWeight: 'bold', 
                                              color: '#1890ff',
                                              cursor: 'pointer',
                                              textDecoration: 'underline'
                                            }}
                                            onClick={() => handleStudentClick(record.studentName, selectedCoachTab)}
                                          >
                                            {record.studentName}
                                          </span>
                                          {record.leaveReason && (
                                            <span style={{ color: '#fa8c16' }}>
                                              {record.leaveReason}
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '11px' }}>
                                          <span>{record.scheduleDate}</span>
                                          <span>{record.startTime?.substring(0,5)}-{record.endTime?.substring(0,5)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* 分页控件 */}
                                {totalPages > 1 && (
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    gap: '8px', 
                                    marginTop: '16px',
                                    padding: '8px 0'
                                  }}>
                                    <button
                                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                      disabled={currentPage === 1}
                                      style={{
                                        padding: '4px 8px',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        backgroundColor: currentPage === 1 ? '#f5f5f5' : 'white',
                                        color: currentPage === 1 ? '#999' : '#333',
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      上一页
                                    </button>
                                    
                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                      第 {currentPage} 页，共 {totalPages} 页
                                    </span>
                                    
                                    <button
                                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                      disabled={currentPage === totalPages}
                                      style={{
                                        padding: '4px 8px',
                                        border: '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        backgroundColor: currentPage === totalPages ? '#f5f5f5' : 'white',
                                        color: currentPage === totalPages ? '#999' : '#333',
                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      下一页
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )
          ) : (dayTab==='today' ? Object.entries(todayCoachDetails).filter(([_, items]) => items.some(item => !item.includes('（请假）'))).length === 0 : Object.entries(tomorrowCoachDetails).filter(([_, items]) => items.some(item => !item.includes('（请假）'))).length === 0) ? (
            <div style={{ color: '#999' }}>{dayTab==='today' ? '今日' : '明日'}暂无课程</div>
          ) : (
            (() => {
              const entries = dayTab==='today' ? Object.entries(todayCoachDetails) : Object.entries(tomorrowCoachDetails);
              // 按课程数量从多到少排序（不区分请假与否，已在显示处标注）
              const sorted = entries.sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0));
              return sorted.map(([coachName, detailItems], idx) => {
                // 根据教练姓名找到对应的教练ID，用于保持颜色一致
                const coach = (coaches || []).find(c => (c.nickname || c.username) === coachName);
                const coachId = coach?.id || idx;
                
                return (
                <div key={idx} style={{ 
                  paddingTop: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex', 
                  alignItems: 'center'
                }}>
                  {/* 第一列：教练信息 - 占1/3 */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '33.33%',
                    flex: '0 0 33.33%'
                  }}>
                    <Avatar size="small" style={{ backgroundColor: colorForCoach(coachName) }}>
                      {coachName?.[0]?.toUpperCase()}
                    </Avatar>
                    <div style={{ 
                      marginLeft: 8, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center'
                    }}>
                      <span 
                        style={{ 
                          fontWeight: 500, 
                          fontSize: 14, 
                          lineHeight: '1.2',
                          color: coachTimetableMap[coachName] ? '#1890ff' : 'inherit',
                          cursor: coachTimetableMap[coachName] ? 'pointer' : 'default',
                          textDecoration: coachTimetableMap[coachName] ? 'underline' : 'none'
                        }}
                        onClick={() => {
                          const timetableId = coachTimetableMap[coachName];
                          if (timetableId) {
                            navigate(`/view-timetable/${timetableId}`);
                          }
                        }}
                      >
                        {coachName}
                      </span>
                      <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 12, marginTop: 4, lineHeight: '1.2' }}>
                        {detailItems.filter(item => !item.includes('（请假）')).length}课时
                      </span>
                    </div>
                  </div>
                  {/* 第二列和第三列：学员数据 - 占2/3 */}
                  <div style={{ 
                    color: '#333', 
                    fontSize: 14, 
                    width: '66.66%',
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center',
                    flex: 1
                  }}>
                    {(() => {
                      const rawItems = detailItems;
                      const parsed = rawItems.length > 0
                        ? rawItems.map((item) => {
                            if (typeof item === 'string') {
                              // 尝试格式1: 10:00-11:00 学员
                              const spaceIdx = item.indexOf(' ');
                              const timeStr = spaceIdx > 0 ? item.slice(0, spaceIdx) : '';
                              const name = spaceIdx > 0 ? item.slice(spaceIdx + 1) : item;
                              const [sh, sm, eh, em] = [timeStr.slice(0,2), timeStr.slice(3,5), timeStr.slice(6,8), timeStr.slice(9,11)];
                              const startHour = sh || timeStr.slice(0,2);
                              const endHour = eh || timeStr.slice(3,5);
                              return { time: `${startHour}-${endHour}`, name };
                            }
                            // 后端对象: LocalTime
                            const st = String(item.startTime);
                            const et = String(item.endTime);
                            const startHour = st.slice(0,2);
                            const endHour = et.slice(0,2);
                            return { time: `${startHour}-${endHour}`, name: item.studentName };
                          })
                        : [];

                      // 二次去重（时间+学员名），同时规范化学员名去掉空格/全角空格
                      const seen = new Set();
                      const items = [];
                      parsed.forEach(it => {
                        const normName = String(it.name || '').replace(/[\s\u3000]/g, '');
                        const key = `${it.time}|${normName}`;
                        if (!seen.has(key)) {
                          seen.add(key);
                          items.push({ time: it.time, name: normName });
                        }
                      });
                      
                      if (items.length === 0) return '—';
                      
                      // 每行显示两个，用换行分隔
                      const lines = [];
                      for (let i = 0; i < items.length; i += 2) {
                        const lineItems = items.slice(i, i + 2);
                        lines.push(lineItems);
                      }
                      return lines.map((lineItems, index) => (
                        <div key={index} style={{ 
                          marginBottom: index < lines.length - 1 ? '4px' : '0',
                          lineHeight: '1.4',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          {/* 第一列学员 */}
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            width: '48%'
                          }}>
                            <span style={{ 
                              fontFamily: 'monospace',
                              minWidth: '32px',
                              textAlign: 'left'
                            }}>
                              {lineItems[0]?.time || ''}
                            </span>
                            <span 
                              style={{ 
                                minWidth: '36px',
                                textAlign: 'left',
                                fontFamily: 'monospace',
                                color: lineItems[0] ? (() => {
                                  // 根据学员名字生成不同颜色
                                  const colors = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#722ed1', '#f5222d'];
                                  const hash = lineItems[0].name.split('').reduce((a, b) => {
                                    a = ((a << 5) - a) + b.charCodeAt(0);
                                    return a & a;
                                  }, 0);
                                  return colors[Math.abs(hash) % colors.length];
                                })() : 'transparent',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={() => handleStudentClick(lineItems[0].name, coachName)}
                            >
                              {lineItems[0] ? (lineItems[0].name.length === 2 ? lineItems[0].name.split('').join('　') : lineItems[0].name) : ''}
                            </span>
                          </div>
                          {/* 第二列学员 */}
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            width: '48%'
                          }}>
                            <span style={{ 
                              fontFamily: 'monospace',
                              minWidth: '32px',
                              textAlign: 'left'
                            }}>
                              {lineItems[1]?.time || ''}
                            </span>
                            <span 
                              style={{ 
                                minWidth: '36px',
                                textAlign: 'left',
                                fontFamily: 'monospace',
                                color: lineItems[1] ? (() => {
                                  // 根据学员名字生成不同颜色
                                  const colors = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#722ed1', '#f5222d'];
                                  const hash = lineItems[1].name.split('').reduce((a, b) => {
                                    a = ((a << 5) - a) + b.charCodeAt(0);
                                    return a & a;
                                  }, 0);
                                  return colors[Math.abs(hash) % colors.length];
                                })() : 'transparent',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={() => handleStudentClick(lineItems[1].name, coachName)}
                            >
                              {lineItems[1] ? (lineItems[1].name.length === 2 ? lineItems[1].name.split('').join('　') : lineItems[1].name) : ''}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                );
              });
            })()
          )}
          </Spin>
        </Card>

        {/* 图表区域已移除 */}

        {/* 教练详情表格 */}
        <Card title="教练详情" size="small">
          <Spin spinning={statisticsLoading}>
            <Table
              dataSource={coaches ? coaches.sort((a, b) => {
                const nameA = a.nickname || a.username;
                const nameB = b.nickname || b.username;
                const valA = (todayCoachDetails[nameA] || []).length;
                const valB = (todayCoachDetails[nameB] || []).length;
                return valB - valA; // 降序排列
              }) : []}
              columns={[
                {
                  title: '教练',
                  dataIndex: 'nickname',
                  key: 'nickname',
                  align: 'center',
                  render: (text, record) => {
                    const coachName = text || record.username;
                    const timetableId = coachTimetableMap[coachName];
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        <Avatar size="small" style={{ backgroundColor: colorForCoach(coachName) }}>
                          {coachName?.[0]?.toUpperCase()}
                        </Avatar>
                        <span 
                          style={{ 
                            marginLeft: '8px',
                            color: timetableId ? '#1890ff' : 'inherit',
                            cursor: timetableId ? 'pointer' : 'default',
                            textDecoration: timetableId ? 'underline' : 'none'
                          }}
                          onClick={() => {
                            if (timetableId) {
                              navigate(`/view-timetable/${timetableId}`);
                            }
                          }}
                        >
                          {coachName}
                        </span>
                      </div>
                    );
                  }
                },
                {
                  title: '今日课程',
                  key: 'todayCourses',
                  align: 'center',
                  render: (_, record) => {
                    const name = record.nickname || record.username;
                    const value = (todayCoachDetails[name] || []).length;
                    return (
                      <span style={{ color: value > 0 ? '#52c41a' : '#999', fontWeight: 500 }}>
                        {value}
                      </span>
                    );
                  }
                },
                {
                  title: '今日请假',
                  key: 'todayLeaves',
                  align: 'center',
                  render: (_, record) => {
                    const value = record.todayLeaves ?? 0;
                    return (
                      <span style={{ color: value > 0 ? '#fa8c16' : '#999', fontWeight: 500 }}>
                        {value}
                      </span>
                    );
                  }
                },
                {
                  title: '本周课程',
                  dataIndex: 'weeklyCourses',
                  key: 'weeklyCourses',
                  align: 'center',
                  render: (value) => (
                    <span style={{ color: '#1890ff', fontWeight: 500 }}>
                      {value}
                    </span>
                  )
                },
                {
                  title: '上月课程',
                  dataIndex: 'lastMonthCourses',
                  key: 'lastMonthCourses',
                  align: 'center',
                  render: (value, record) => {
                    const coachName = record.nickname || record.username;
                    return (
                      <span
                        style={{ color: '#722ed1', fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => openLastMonthModal(coachName)}
                        title="点击查看上月所有上课记录"
                      >
                        {value ?? 0}
                      </span>
                    );
                  }
                }
              ]}
              pagination={false}
              size="small"
              style={{ textAlign: 'center' }}
            />
          </Spin>
        </Card>

        {/* 活动课表本周排课信息 */}
        <WeeklyScheduleBlock coachColorMap={coachColorMap} />

        {/* 学员详情模态框在页面底部统一渲染，避免重复 */}

        {/* 上月课程记录弹窗 */}
        <Modal
          title={`上月课程记录 - ${lastMonthCoachName}`}
          open={lastMonthModalVisible}
          onCancel={() => setLastMonthModalVisible(false)}
          footer={null}
          width={700}
          style={{ top: 24 }}
          rootClassName="last-month-modal"
        >
          <Spin spinning={lastMonthLoading}>
            <div style={{ marginBottom: 12, fontSize: '13px', color: '#666' }}>
              共 {lastMonthRecords.length} 条
            </div>
            <List
              dataSource={lastMonthRecords}
              renderItem={(item, index) => (
                <List.Item style={{ padding: '8px 0', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '20px' }}>
                    <div style={{ minWidth: '40px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#999', fontSize: '11px' }}>#{index + 1}</span>
                    </div>
                    <div style={{ minWidth: '80px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#722ed1', fontWeight: 500 }}>{item.scheduleDate}</span>
                    </div>
                    <div style={{ minWidth: '100px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#666' }}>{item.timeRange}</span>
                    </div>
                    <div style={{ minWidth: '100px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#333', fontWeight: 500 }}>{item.studentName || '-'}</span>
                    </div>
                    <div style={{ minWidth: '60px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {item.status === '请假' ? (
                        <Tag color="orange" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', height: '20px' }}>请假</Tag>
                      ) : (
                        <Tag color="green" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', height: '20px' }}>正常</Tag>
                      )}
                    </div>
                  </div>
                </List.Item>
              )}
              pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, className: 'centered-pagination' }}
            />
          </Spin>
        </Modal>
      </div>
    );
  };

  // 生成学员头像颜色的函数
  const getStudentAvatarColor = (studentName, index) => {
    const colors = [
      '#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1',
      '#13c2c2', '#eb2f96', '#faad14', '#a0d911', '#2f54eb',
      '#f759ab', '#36cfc9', '#ff7875', '#ffa940', '#b37feb'
    ];
    // 使用学员名字的哈希值来确保相同名字总是得到相同颜色
    let hash = 0;
    for (let i = 0; i < studentName.length; i++) {
      hash = ((hash << 5) - hash + studentName.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };


  // 构建tab项目
  const buildTabItems = () => {
    const tabItems = [];
    
    // 管理员显示教练概览
    if (user?.role?.toUpperCase() === 'ADMIN') {
      tabItems.push({
        key: 'overview',
        label: '教练概览',
        children: <AdminOverview dayTab={adminDayTab} setDayTab={setAdminDayTab} />
      });
    }
    
    // 所有用户都显示我的课表和我的学员
    tabItems.push(
      {
        key: 'timetables',
        label: '我的课表',
        children: (
          <div>
            {renderTimetableList()}
          </div>
        )
      },
      {
        key: 'students',
        label: '我的学员',
        children: <MyStudents 
          onStudentClick={(studentName) => {
            setSelectedStudent(studentName);
            setSelectedCoach(user?.role?.toUpperCase() === 'ADMIN' ? null : user?.nickname || user?.username); // 普通用户传递自己的名称
            setStudentDetailVisible(true);
          }}
          showAllCheckbox={user?.role?.toUpperCase() === 'ADMIN'} // 只有管理员显示"全部"复选框
        />
      },
      {
        key: 'hours',
        label: '我的课时',
        children: (
          <div style={{ padding: '8px 0' }}>
            <MyHours user={user} />
          </div>
        )
      }
    );
    
    return tabItems;
  };

  // 显示Tab界面（管理员和普通用户都显示）
  const tabItems = buildTabItems();
  
  return (
    <div className="page-container" style={{ paddingTop: '0.25rem' }}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
        tabBarGutter={12}
        tabBarExtraContent={{
          right: (
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={handleCreateTimetable}
              disabled={timetables.length >= 5}
            >
              创建课表
            </Button>
          )
        }}
      />
      {/* 模态框等保持不变 */}
      {renderModals()}
      
      {/* 内联定义：我的课时 */}
      {/* 为避免拆文件，这里定义轻量 MyHours 组件 */}
      
      {/* 学员详情模态框 */}
      <StudentDetailModal
        visible={studentDetailVisible}
        onClose={() => setStudentDetailVisible(false)}
        studentName={selectedStudent}
        coachName={selectedCoach}
      />
    </div>
  );
};

export default Dashboard;
 
// 轻量实现：我的课时
const MyHours = ({ user }) => {
  const [loading, setLoading] = React.useState(false);
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [stats, setStats] = React.useState({ count: 0, hours: 0 });
  const [records, setRecords] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [timetables, setTimetables] = React.useState([]);
  const [coachId, setCoachId] = React.useState(null);
  const [coachOptions, setCoachOptions] = React.useState([]);
  const isInitialized = React.useRef(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 管理员：加载教练下拉（后端已去重并按注册时间倒序）
      if (user?.role?.toUpperCase() === 'ADMIN') {
        const resp = await getCoachesWithTimetables();
        const options = (resp?.data?.list || []).map(x => ({ value: String(x.id), label: x.name, createdAt: x.createdAt }));
        setCoachOptions(options);
        if (!coachId && options.length > 0) {
          const meId = user?.id ? String(user.id) : null;
          const byId = meId ? options.find(o => String(o.value) === meId) : null;
          setCoachId((byId || options[0]).value);
        }
      }

      // 后端分页查询
      const params = {
        startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : undefined,
        endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : undefined,
        coachId: user?.role?.toUpperCase() === 'ADMIN' ? (coachId ? String(coachId) : undefined) : undefined,
        page,
        size: pageSize
      };
      const resp = await getMyHoursPaged(params);
      const list = resp?.data?.list || [];
      const total = resp?.data?.total || 0;
      // 统计总课时
      const totalHours = list.reduce((sum, s) => {
        const st = dayjs(s.startTime, 'HH:mm:ss');
        const et = dayjs(s.endTime, 'HH:mm:ss');
        return sum + et.diff(st, 'hour', true);
      }, 0);
      // 规范字段（兼容现有列定义）
      const selectedCoachName = user?.role?.toUpperCase() === 'ADMIN'
        ? (coachOptions.find(o => String(o.value) === String(coachId))?.label || '')
        : (user?.nickname || user?.username || '');
      const mapped = list.map(s => ({
        ...s,
        scheduleDate: s.scheduleDate,
        startTime: s.startTime,
        endTime: s.endTime,
        studentName: s.studentName,
        timetableOwner: s.coachName || selectedCoachName
      }));
      setTotalCount(total);
      setRecords(mapped);
      setStats({ count: total, hours: totalHours });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, coachId, page]);

  // 初始化时加载数据
  React.useEffect(() => { 
    fetchData(); 
    isInitialized.current = true;
  }, []); // 空依赖数组，只在组件挂载时执行一次
  
  // 分页时自动查询
  React.useEffect(() => { 
    if (isInitialized.current) { // 只有在初始化完成后才响应分页变化
      fetchData(); 
    }
  }, [page]);

  // 每页数量
  const pageSize = 10;

  const baseColumns = [
    { 
      title: '日期时间', 
      key: 'datetime',
      width: 180,
      align: 'center',
      render: (_, record) => {
        let dateStr = '';
        if (record.scheduleDate) {
          dateStr = dayjs(record.scheduleDate).format('YYYY-MM-DD');
        } else if (record.dayOfWeek) {
          // 如果没有具体日期但有星期几，根据当前周推算具体日期
          const dayMap = {
            'MONDAY': 1,
            'TUESDAY': 2, 
            'WEDNESDAY': 3,
            'THURSDAY': 4,
            'FRIDAY': 5,
            'SATURDAY': 6,
            'SUNDAY': 0
          };
          const targetDay = dayMap[record.dayOfWeek];
          if (targetDay !== undefined) {
            // 获取当前周的周一
            const today = dayjs();
            const currentWeekMonday = today.startOf('week').add(1, 'day'); // 周一是第一天
            // 计算目标日期
            const targetDate = currentWeekMonday.add(targetDay - 1, 'day');
            
            // 后端已经过滤了未来记录，所以这里直接显示推算的日期
            dateStr = targetDate.format('YYYY-MM-DD');
          } else {
            dateStr = record.dayOfWeek;
          }
        } else {
          dateStr = '-';
        }
        
        const timeStr = `${record.startTime?.slice(0,5)}~${record.endTime?.slice(0,5)}`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500, color: '#722ed1', fontSize: '12px' }}>{dateStr}</span>
            <span style={{ fontSize: '11px', color: '#666' }}>{timeStr}</span>
          </div>
        );
      }
    },
    { title: '学员', dataIndex: 'studentName', key: 'student', width: 100, align: 'center' },
  ];

  const columns = React.useMemo(() => {
    if (user?.role?.toUpperCase() === 'ADMIN') {
      return [
        ...baseColumns,
        { title: '教练', dataIndex: 'timetableOwner', key: 'coach', width: 100, align: 'center', render: v => v || '-' }
      ];
    }
    return baseColumns;
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 200px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'center', marginBottom: 12, width: '100%' }}>
        <DatePicker placeholder="开始日期" value={startDate} onChange={setStartDate} style={{ width: '100%' }} />
        <DatePicker placeholder="结束日期" value={endDate} onChange={setEndDate} style={{ width: '100%' }} />
        <Button type="primary" onClick={() => { setPage(1); fetchData(); }} loading={loading} style={{ minWidth: 72 }}>查询</Button>
        {user?.role?.toUpperCase() === 'ADMIN' && (
          <Select
            placeholder="选择教练"
            allowClear
            style={{ gridColumn: '1 / span 1', width: '100%' }}
            value={coachId}
            onChange={setCoachId}
            options={coachOptions}
          />
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Table
          size="small"
          rowKey={(r)=>`${r.scheduleDate}-${r.startTime}-${r.id || Math.random()}`}
          columns={columns}
          dataSource={records}
          loading={loading}
          className="myhours-table"
          pagination={false}
        />
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
              第 {((page - 1) * pageSize) + 1}~{Math.min(page * pageSize, totalCount)} 条记录
            </span>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
              共计 {stats.count} 课时
            </span>
          </div>
        </div>
        <Pagination
          className="myhours-pagination"
          current={page}
          pageSize={pageSize}
          total={totalCount}
          onChange={(p)=>{ setPage(p); }}
          showSizeChanger={false}
        />
      </div>
    </div>
  );
};