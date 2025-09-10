import React, { useState, useEffect, useCallback } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Modal, Table, Divider, Tag, Popover, Input, Dropdown, Menu, Checkbox, DatePicker, Select, Tabs, Card, Statistic, Row, Col } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, StarFilled, UpOutlined, DownOutlined, RetweetOutlined, InboxOutlined, DeleteOutlined, UserOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules, createSchedule, updateSchedule, deleteSchedule, updateTimetable, setActiveTimetable, archiveTimetableApi, getActiveSchedulesByDateMerged, copyTimetableToUser, getWeeksWithCountsApi, convertDateToWeeklyApi, convertWeeklyToDateApi, copyConvertDateToWeeklyApi, copyConvertWeeklyToDateApi, clearTimetableSchedules, getTodaySchedulesOnce, getTomorrowSchedulesOnce } from '../services/timetable';
import { checkCurrentWeekInstance, generateCurrentWeekInstance, getCurrentWeekInstance, deleteInstanceSchedule, updateInstanceSchedule, createInstanceSchedule } from '../services/weeklyInstance';
import { getCoachesStatistics, getInstanceSchedulesByDate, getActiveWeeklySchedules, getActiveWeeklyTemplates, getAllTimetables } from '../services/admin';
import dayjs from 'dayjs';
import EditScheduleModal from '../components/EditScheduleModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

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
  const [modalSubTitleTomorrow, setModalSubTitleTomorrow] = useState('');
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
      const response = await getAllTimetables(true); // 只获取活动课表
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
      getTodaySchedulesOnce(activeTimetableId)
        .then(response => { if (response && response.success) setOtherCoachesDataToday(response.data); })
        .catch(error => {
          console.error('获取其他教练今日课程失败:', error);
        })
        .finally(() => {
          setLoadingOtherCoachesToday(false);
        });

      // 获取其他教练的明日课程数据
      setLoadingOtherCoachesTomorrow(true);
      getTomorrowSchedulesOnce(activeTimetableId)
        .then(response => { if (response && response.success) setOtherCoachesDataTomorrow(response.data); })
        .catch(error => {
          console.error('获取其他教练明日课程失败:', error);
        })
        .finally(() => {
          setLoadingOtherCoachesTomorrow(false);
        });

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
      let response;
      
      // 检查是否有当前周实例
      const instanceCheck = await checkCurrentWeekInstance(currentTimetable.id);
      console.log('instanceCheck response:', instanceCheck);
      
      if (instanceCheck.success && instanceCheck.data.hasInstance) {
        // 有实例，添加到实例中
        const instanceId = instanceCheck.data.instanceId || instanceCheck.data.id;
        console.log('Using existing instanceId:', instanceId);
        if (!instanceId) {
          message.error('无法获取实例ID');
          return;
        }
        response = await createInstanceSchedule(instanceId, payload);
      } else {
        // 没有实例，先创建实例再添加
        const createInstanceResponse = await generateCurrentWeekInstance(currentTimetable.id);
        console.log('createInstanceResponse:', createInstanceResponse);
        if (createInstanceResponse.success) {
          const instanceId = createInstanceResponse.data.instanceId || createInstanceResponse.data.id;
          console.log('Using new instanceId:', instanceId);
          if (!instanceId) {
            message.error('无法获取新创建的实例ID');
            return;
          }
          response = await createInstanceSchedule(instanceId, payload);
        } else {
          message.error('创建周实例失败');
          return;
        }
      }
      
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
    
    // 颜色调色板（与现有课表保持一致）
    const colorPalette = [
      '#E6F7FF', '#F0F5FF', '#F6FFED', '#FFFBE6', '#FFF1F0', '#FCF4FF',
      '#FFF0F6', '#F9F0FF', '#FFF7E6', '#FFFAE6', '#D9F7BE', '#B5F5EC',
      '#ADC6FF', '#D3ADF7', '#FFADD2', '#FFD8BF'
    ];
    
    // 教练文字颜色调色板
    const coachTextColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];
    
    // 学员背景色和教练文字色映射
    const studentColorMap = new Map();
    const coachTextColorMap = new Map();
    
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
        
        // 为学员分配背景色
        Array.from(allStudents).forEach((student, index) => {
          studentColorMap.set(student, colorPalette[index % colorPalette.length]);
        });
        
        // 为教练分配文字色
        Array.from(allCoaches).forEach((coach, index) => {
          coachTextColorMap.set(coach, coachTextColorPalette[index % coachTextColorPalette.length]);
        });
        
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
    
    const getCoachColor = (coachName) => {
      // 高区分度配色（包含天蓝色）
      const colors = ['#dc2626', '#38bdf8', '#059669', '#22c55e'];
      const hash = coachName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    };
    
    const renderScheduleCell = (schedules, day) => {
      const filtered = (schedules || []).filter(s => {
        if (viewMode === 'template') {
          // 固定：包含周固定来源 + 日期范围
          return (!!s.sourceIsWeekly) || s.type === 'dateRange' || s.type === 'template';
        }
        // 本周：包含实例 + 日期范围
        return s.type === 'instance' || s.type === 'dateRange';
      });
      if (!filtered || filtered.length === 0) {
        return <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
      }
      
      return (
        <div style={{
          height: '100%',
          minHeight: '48px',
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}>
          {filtered.map((schedule, idx) => {
            // 在"本周"模式下，实例与固定不一致高亮
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
                  backgroundColor: studentColorMap.get(schedule.student) || 'transparent',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: (coachColorMap && coachColorMap[schedule.coach]) || getCoachColor(schedule.coach),
                  fontSize: '12px',
                  fontWeight: 600,
                  wordBreak: 'break-word',
                  lineHeight: '1.2',
                  borderTop: idx > 0 ? '1px solid #fff' : 'none',
                  border: diffBorder,
                  position: 'relative',
                  padding: '2px'
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
              <div style={{ fontSize: '10px', lineHeight: '12px', whiteSpace: 'nowrap', color: isTodayCol ? '#1677ff' : '#888' }}>{dateForCol}</div>
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
    
    return (
      <Card title={viewMode === 'instance' ? '本周排课信息' : '固定课表模板'} size="small" style={{ marginTop: '16px' }}
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
          
          {/* 教练颜色图例说明 */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
              {(coachColorMap ? Object.keys(coachColorMap) : Array.from(allCoaches)).map((coach, index) => (
                <div key={coach} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    backgroundColor: (coachColorMap && coachColorMap[coach]) || getCoachColor(coach), 
                    borderRadius: '2px' 
                  }}></div>
                  <span style={{ color: (coachColorMap && coachColorMap[coach]) || getCoachColor(coach), fontWeight: 500 }}>{coach}</span>
                </div>
              ))}
            </div>
          </div>
        </Spin>
      </Card>
    );
  };

  // 管理员概览组件
  const AdminOverview = () => {
    const { coaches, totalCoaches, totalTodayCourses, totalWeeklyCourses, totalLastWeekCourses } = coachesStatistics || {};
    
    // 今日/明日切换
    const [dayTab, setDayTab] = useState('today'); // 'today' | 'tomorrow'
    const [tomorrowCoachDetails, setTomorrowCoachDetails] = useState({});
    const [coachDetailsLoading, setCoachDetailsLoading] = useState(false);

    // 额外拉取今日活动课表的课程，用于显示学员+时间（后端统计缺少明细时兜底）
    const [todayCoachDetails, setTodayCoachDetails] = useState({});

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
                    const items2 = sortedSchedules2.map(s => `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`);
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
                    const items2 = sortedSchedules2.map(s => `${hhmm(s.startTime)}-${hhmm(s.endTime)} ${normalizeName(s.studentName)}`);
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
                </Button.Group>
              </div>
              <span style={{ color: '#999', fontSize: 13, textAlign: 'right', display: 'block', width: '100%' }}>
                {dayTab==='today' ? '今日有课教练' : '明日有课教练'} 
                <span style={{ color: '#1890ff', fontWeight: 500 }}>{
                  dayTab==='today'
                    ? Object.keys(todayCoachDetails).length
                    : Object.keys(tomorrowCoachDetails).length
                }</span>
                <span style={{ color: '#999' }}>/{coaches?.length || 0}</span>
              </span>
            </div>
          }
        >
          <Spin spinning={coachDetailsLoading || statisticsLoading}>
          {(dayTab==='today' ? Object.keys(todayCoachDetails).length === 0 : Object.keys(tomorrowCoachDetails).length === 0) ? (
            <div style={{ color: '#999' }}>{dayTab==='today' ? '今日' : '明日'}暂无课程</div>
          ) : (
            (dayTab==='today' ? Object.entries(todayCoachDetails) : Object.entries(tomorrowCoachDetails))
              .map(([coachName, detailItems], idx) => {
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
                      <span style={{ color: '#52c41a', fontWeight: 500, fontSize: 12, marginTop: 4, lineHeight: '1.2' }}>{detailItems.length}课时</span>
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
                            <span style={{ 
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
                              })() : 'transparent'
                            }}>
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
                            <span style={{ 
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
                              })() : 'transparent'
                            }}>
                              {lineItems[1] ? (lineItems[1].name.length === 2 ? lineItems[1].name.split('').join('　') : lineItems[1].name) : ''}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                );
              })
          )}
          </Spin>
        </Card>

        {/* 图表区域已移除 */}

        {/* 教练详情表格 */}
        <Card title="教练详情" size="small">
          <Spin spinning={statisticsLoading}>
            <Table
              dataSource={coaches}
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
                  sorter: (a, b) => {
                    const nameA = a.nickname || a.username;
                    const nameB = b.nickname || b.username;
                    const valA = (todayCoachDetails[nameA] || []).length;
                    const valB = (todayCoachDetails[nameB] || []).length;
                    return valA - valB;
                  },
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
                  title: '本周课程',
                  dataIndex: 'weeklyCourses',
                  key: 'weeklyCourses',
                  align: 'center',
                  sorter: (a, b) => a.weeklyCourses - b.weeklyCourses,
                  defaultSortOrder: 'descend',
                  sortDirections: ['descend', 'ascend'],
                  render: (value) => (
                    <span style={{ color: '#1890ff', fontWeight: 500 }}>
                      {value}
                    </span>
                  )
                },
                {
                  title: '本月课程',
                  key: 'monthlyCourses',
                  align: 'center',
                  sorter: (a, b) => {
                    // 这里需要后端提供本月课程数据，暂时使用本周数据作为占位
                    return (a.weeklyCourses * 4) - (b.weeklyCourses * 4);
                  },
                  render: (_, record) => {
                    // 暂时使用本周数据 * 4 作为估算值，后续需要后端提供真实数据
                    const value = record.weeklyCourses * 4;
                    return (
                      <span style={{ color: '#722ed1', fontWeight: 500 }}>
                        {value}
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
      </div>
    );
  };

  // 如果是管理员，显示Tab界面
  if (user?.role?.toUpperCase() === 'ADMIN') {
    const tabItems = [
      {
        key: 'overview',
        label: '教练概览',
        children: <AdminOverview />
      },
      {
        key: 'timetables',
        label: '我的课表',
        children: (
          <div>
            {/* 管理员视图下，顶部标题去掉，创建按钮已移到 Tabs 右上角 */}
            {renderTimetableList()}
          </div>
        )
      }
    ];

    return (
      <div className="page-container" style={{ paddingTop: '0.25rem' }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="large"
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
      </div>
    );
  }

  // 非管理员用户显示原有界面
  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
        <h1 style={{ margin: 0, fontWeight: '700' }}>我的课表</h1>
        {loadingScheduleCounts && (
          <div style={{ 
            position: 'absolute', 
            left: '50%', 
            transform: 'translateX(-50%)',
            top: '40px',
            fontSize: '12px',
            color: '#999',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Spin size="small" style={{ marginRight: '6px' }} />
            正在统计课程数量...
          </div>
        )}
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={handleCreateTimetable}
          style={{ position: 'absolute', right: 0 }}
          disabled={timetables.length >= 5}
        >
          创建课表
        </Button>
      </div>

      {loading ? (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '80px 20px',
          minHeight: '400px'
        }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
            正在加载课表数据...
          </div>
        </div>
      ) : timetables.length === 0 ? (
        <Empty description="暂无课表，快去创建一个吧" />
      ) : (
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
                        <a onClick={() => handleViewTimetable(item.id)} style={{ fontWeight: 600, fontSize: 17 }}>{item.name}</a>
                      )}
                    </div>
                    {!editingTimetableId && (
                      <div style={{ display: 'flex', gap: '4px' }}>
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
      )}
      <Modal
        title={
          <div style={{ paddingBottom: '8px' }}>
            <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: '500', color: '#262626' }}>{modalMainTitle}</div>
          </div>
        }
        open={todaysCoursesModalVisible}
        onCancel={() => {
          setTodaysCoursesModalVisible(false);
          setCurrentTimetable(null);
          setAllSchedulesData([]);
          setOpenPopoverKey(null);
                        // 重置复制其他教练课程相关状态
              setCopyOtherCoachesToday(true);
              setCopyOtherCoachesTomorrow(true);
              setOtherCoachesDataToday([]);
              setOtherCoachesDataTomorrow([]);
              setLoadingOtherCoachesToday(false);
              setLoadingOtherCoachesTomorrow(false);
              setOtherCoachesExpandedToday(false);
              setOtherCoachesExpandedTomorrow(false);
          setOtherCoachesExpandedToday(false);
          setOtherCoachesExpandedTomorrow(false);
        }}
        width={600}
        footer={null}
      >
        {todaysCoursesData.length > 0 && (
          <>
            {/* 显示其他教练今日课程信息 */}
            {(loadingOtherCoachesToday || (otherCoachesDataToday && otherCoachesDataToday.timetables && otherCoachesDataToday.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length > 0)) && (
              <div style={{ marginBottom: '16px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                {/* 折叠标题栏 */}
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px 4px 0 0',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: otherCoachesExpandedToday ? '1px solid #f0f0f0' : 'none'
                  }}
                  onClick={() => setOtherCoachesExpandedToday(!otherCoachesExpandedToday)}
                >
                  <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                    其他教练课程 ({dayjs().format('YYYY-MM-DD')})
                  </div>
                  <div style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {loadingOtherCoachesToday && (
                      <Spin size="small" />
                    )}
                    {otherCoachesExpandedToday ? <UpOutlined /> : <DownOutlined />}
                  </div>
                </div>

                {/* 可折叠的内容区域 */}
                {!loadingOtherCoachesToday && otherCoachesDataToday && otherCoachesDataToday.timetables && (
                  <div
                    style={{
                      maxHeight: otherCoachesExpandedToday ? '200px' : '0px',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease-in-out'
                    }}
                  >
                    <div style={{ padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                      {otherCoachesDataToday.timetables
                        .filter(timetableInfo => currentTimetable && timetableInfo.timetableId.toString() !== currentTimetable.id.toString())
                        .map((timetableInfo, index) => (
                          <div key={index} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1890ff', marginBottom: '4px' }}>
                              {timetableInfo.ownerName} - {timetableInfo.timetableName}
                            </div>
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
                                  marginBottom: lineIndex < lines.length - 1 ? '2px' : '0',
                                  marginLeft: '8px'
                                }}>
                                  <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                    {lineItems[0] ? `${lineItems[0].startTime.substring(0,5)}-${lineItems[0].endTime.substring(0,5)} ${lineItems[0].studentName}` : ''}
                                  </span>
                                  <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                    {lineItems[1] ? `${lineItems[1].startTime.substring(0,5)}-${lineItems[1].endTime.substring(0,5)} ${lineItems[1].studentName}` : ''}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'left', fontSize: '14px', color: '#8c8c8c', marginBottom: '8px' }}>{modalSubTitle}</div>
            <Table
              dataSource={todaysCoursesData}
              pagination={false}
              bordered
              size="small"
              columns={getColumns(studentColorMap)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={copyOtherCoachesToday}
                  onChange={(e) => setCopyOtherCoachesToday(e.target.checked)}
                  disabled={loadingOtherCoachesToday}
                >
                  复制其他教练课程
                </Checkbox>
              </div>
              <Button
                icon={<CopyOutlined />}
                type="primary"
                onClick={() => copyToClipboard(generateCopyText(todaysSchedulesForCopy, true, copyOtherCoachesToday, otherCoachesDataToday))}
              >
                复制今日课程
              </Button>
            </div>
          </>
        )}

        {tomorrowsCoursesData.length > 0 && (
          <>
            <Divider />
            
            {/* 显示其他教练明日课程信息 */}
            {(loadingOtherCoachesTomorrow || (otherCoachesDataTomorrow && otherCoachesDataTomorrow.timetables && otherCoachesDataTomorrow.timetables.filter(t => currentTimetable && t.timetableId.toString() !== currentTimetable.id.toString()).length > 0)) && (
              <div style={{ marginBottom: '16px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                {/* 折叠标题栏 */}
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px 4px 0 0',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: otherCoachesExpandedTomorrow ? '1px solid #f0f0f0' : 'none'
                  }}
                  onClick={() => setOtherCoachesExpandedTomorrow(!otherCoachesExpandedTomorrow)}
                >
                  <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                    其他教练课程 ({dayjs().add(1, 'day').format('YYYY-MM-DD')})
                  </div>
                  <div style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {loadingOtherCoachesTomorrow && (
                      <Spin size="small" />
                    )}
                    {otherCoachesExpandedTomorrow ? <UpOutlined /> : <DownOutlined />}
                  </div>
                </div>

                {/* 可折叠的内容区域 */}
                {!loadingOtherCoachesTomorrow && otherCoachesDataTomorrow && otherCoachesDataTomorrow.timetables && (
                  <div
                    style={{
                      maxHeight: otherCoachesExpandedTomorrow ? '200px' : '0px',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease-in-out'
                    }}
                  >
                    <div style={{ padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                      {otherCoachesDataTomorrow.timetables
                        .filter(timetableInfo => currentTimetable && timetableInfo.timetableId.toString() !== currentTimetable.id.toString())
                        .map((timetableInfo, index) => (
                          <div key={index} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1890ff', marginBottom: '4px' }}>
                              {timetableInfo.ownerName} - {timetableInfo.timetableName}
                            </div>
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
                                  marginBottom: lineIndex < lines.length - 1 ? '2px' : '0',
                                  marginLeft: '8px'
                                }}>
                                  <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                    {lineItems[0] ? `${lineItems[0].startTime.substring(0,5)}-${lineItems[0].endTime.substring(0,5)} ${lineItems[0].studentName}` : ''}
                                  </span>
                                  <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                    {lineItems[1] ? `${lineItems[1].startTime.substring(0,5)}-${lineItems[1].endTime.substring(0,5)} ${lineItems[1].studentName}` : ''}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'left', fontSize: '14px', color: '#8c8c8c', marginBottom: '8px' }}>{modalSubTitleTomorrow}</div>
            <Table
              dataSource={tomorrowsCoursesData}
              pagination={false}
              bordered
              size="small"
              columns={getColumnsForTomorrow(studentColorMap)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={copyOtherCoachesTomorrow}
                  onChange={(e) => setCopyOtherCoachesTomorrow(e.target.checked)}
                  disabled={loadingOtherCoachesTomorrow}
                >
                  复制其他教练课程
                </Checkbox>
              </div>
              <Button
                icon={<CopyOutlined />}
                type="primary"
                onClick={() => copyToClipboard(generateCopyText(tomorrowsSchedulesForCopy, false, copyOtherCoachesTomorrow, otherCoachesDataTomorrow))}
              >
                复制明日课程
              </Button>
            </div>
          </>
        )}

        {(todaysCoursesData.length > 0 || tomorrowsCoursesData.length > 0) && <Divider />}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Button
            danger
            type="primary"
            onClick={() => {
              setTodaysCoursesModalVisible(false);
              setCurrentTimetable(null);
              setAllSchedulesData([]);
              setOpenPopoverKey(null);
              // 重置复制其他教练课程相关状态
              setCopyOtherCoachesToday(true);
              setCopyOtherCoachesTomorrow(true);
              setOtherCoachesDataToday([]);
              setOtherCoachesDataTomorrow([]);
              setLoadingOtherCoachesToday(false);
              setLoadingOtherCoachesTomorrow(false);
              setOtherCoachesExpandedToday(false);
              setOtherCoachesExpandedTomorrow(false);
            }}
            style={{ minWidth: '100px' }}
          >
            关闭
          </Button>
        </div>
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


    </div>
  );
};

export default Dashboard;