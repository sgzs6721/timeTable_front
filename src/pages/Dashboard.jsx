import React, { useState, useEffect, useCallback } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Modal, Table, Divider, Tag, Popover, Input, Dropdown, Menu, Checkbox, DatePicker, Select } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, StarFilled, UpOutlined, DownOutlined, RetweetOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules, createSchedule, updateSchedule, deleteSchedule, updateTimetable, setActiveTimetable, archiveTimetableApi, getActiveSchedulesByDate, copyTimetableToUser, getWeeksWithCountsApi, convertDateToWeeklyApi, convertWeeklyToDateApi, copyConvertDateToWeeklyApi, copyConvertWeeklyToDateApi } from '../services/timetable';
import { checkCurrentWeekInstance, generateCurrentWeekInstance, getCurrentWeekInstance } from '../services/weeklyInstance';
import dayjs from 'dayjs';
import EditScheduleModal from '../components/EditScheduleModal';
import './Dashboard.css';

// 新增的组件，用于添加新课程
const NewSchedulePopoverContent = ({ onAdd, onCancel }) => {
  const [name, setName] = React.useState('');

  return (
    <div style={{ width: '180px', display: 'flex', flexDirection: 'column' }}>
      <Input
        size="small"
        placeholder="学生姓名"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button size="small" onClick={onCancel} style={{ marginRight: 8 }}>
          取消
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={() => onAdd(name)}
        >
          添加
        </Button>
      </div>
    </div>
  );
};

// 新增的组件，用于修改现有课程
const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onCancel, timetable }) => {
  const [name, setName] = React.useState(schedule.studentName);
  const isNameChanged = name !== schedule.studentName;

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
        <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>星期:</strong> {schedule.dayOfWeek}</p>
      ) : (
        <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>日期:</strong> {schedule.scheduleDate}</p>
      )}

      <p style={{ margin: '4px 0', textAlign: 'left' }}>
        <strong>时间:</strong> {schedule.startTime.substring(0,5)} - {schedule.endTime.substring(0,5)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <Button size="small" onClick={onCancel}>取消</Button>
        <Button type="primary" danger size="small" onClick={onDelete}>删除</Button>
        <Button
          size="small"
          onClick={() => onUpdateName(name)}
          disabled={!isNameChanged}
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
  const [timetables, setTimetables] = useState([]);
  const [archivedTimetables, setArchivedTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timetableScheduleCounts, setTimetableScheduleCounts] = useState({});
  const [todaysCoursesModalVisible, setTodaysCoursesModalVisible] = useState(false);
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

  const navigate = useNavigate();

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
      try {
        const response = await getTimetables();
        const allTimetables = response.data;
        const activeTimetables = allTimetables.filter(t => !t.isArchived);
        const archivedTimetables = allTimetables.filter(t => t.isArchived);

        setTimetables(activeTimetables);
        setArchivedTimetables(archivedTimetables);

        // 获取每个课表的课程数量
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
      } catch (error) {
        message.error('获取课表列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetables();
  }, []);

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

    return {
      items: [
        {
          key: 'active',
          label: '设为活动课表',
          disabled: setActiveDisabled,
          onClick: () => handleSetActiveTimetable(item.id),
          style: !setActiveDisabled ? { color: '#52c41a' } : undefined,
        },
        {
          key: 'archive',
          label: '归档',
          onClick: () => handleArchiveTimetable(item.id),
          style: { color: '#faad14' },
        },
        {
          key: 'delete',
          label: '删除课表',
          danger: true,
          onClick: () => handleDeleteTimetable(item.id),
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
      message.loading({ content: '正在查询课程安排...', key: 'courses' });
      
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
              message.destroy('courses');
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
                message.destroy('courses');
                message.error('生成实例后获取课程数据失败');
                return;
              }
            } else {
              message.destroy('courses');
              message.error('生成当前周实例失败');
              return;
            }
          }
        } catch (error) {
          message.destroy('courses');
          message.error('获取周固定课表实例失败');
          return;
        }
      } else {
        // 对于日期范围课表，使用原来的方式
        const response = await getTimetableSchedules(timetable.id);
        if (!response.success) {
          message.destroy('courses');
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
          
          subTitle = `${targetDate.isSame(dayjs(), 'day') ? '今日' : '明日'}课程 (${dayOfWeekCn})`;
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
        message.destroy('courses');
        message.info('今天和明天都没有安排课程');
        return;
      }

      message.destroy('courses');
      setStudentColorMap(newStudentColorMap);
      setModalMainTitle(timetable.name);
      setTodaysCoursesModalVisible(true);

      // 获取其他教练的今日课程数据
      setLoadingOtherCoachesToday(true);
      const todayDateStr = dayjs().format('YYYY-MM-DD');
      getActiveSchedulesByDate(todayDateStr)
        .then(response => {
          if (response.success) {
            setOtherCoachesDataToday(response.data);
          }
        })
        .catch(error => {
          console.error('获取其他教练今日课程失败:', error);
        })
        .finally(() => {
          setLoadingOtherCoachesToday(false);
        });

      // 获取其他教练的明日课程数据
      setLoadingOtherCoachesTomorrow(true);
      const tomorrowDateStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
      getActiveSchedulesByDate(tomorrowDateStr)
        .then(response => {
          if (response.success) {
            setOtherCoachesDataTomorrow(response.data);
          }
        })
        .catch(error => {
          console.error('获取其他教练明日课程失败:', error);
        })
        .finally(() => {
          setLoadingOtherCoachesTomorrow(false);
        });

    } catch (error) {
      message.destroy('courses');
      message.error('查询失败，请检查网络连接');
    }
  };

  // 生成复制文本
  const generateCopyText = (schedules, isToday = true, includeOtherCoaches = false, otherCoachesData = null) => {
    if (!schedules || schedules.length === 0) return '没有可复制的课程';
    
    // 获取当前教练名称
    const coachName = currentTimetable?.nickname || currentTimetable?.username || currentTimetable?.user?.username || '教练';
    
    // 构建标题
    const dateStr = isToday ? dayjs().format('YYYY年MM月DD日') : dayjs().add(1, 'day').format('YYYY年MM月DD日');
    const dayLabel = isToday ? '今日' : '明日';
    const title = `${dateStr} ${dayLabel}课程安排`;
    
    // 构建当前教练的课程列表
    const courseList = schedules.map(schedule => {
        const startHour = parseInt(schedule.startTime.substring(0, 2));
        const displayTime = `${startHour}-${startHour + 1}`;
        return `${displayTime} ${schedule.studentName}`;
    }).join('\n');

    let result = `${title}\n${coachName}：\n${courseList}`;

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
      width: '25%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName1',
      key: 'studentName1',
      width: '25%',
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
                  onDelete={() => handleDeleteSchedule(record.schedule1.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
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
      width: '25%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName2',
      key: 'studentName2',
      width: '25%',
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
                  onDelete={() => handleDeleteSchedule(record.schedule2.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
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
      width: '25%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName1',
      key: 'studentName1',
      width: '25%',
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
                  onDelete={() => handleDeleteSchedule(record.schedule1.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
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
      width: '25%',
      align: 'center',
    },
    {
      title: '学员',
      dataIndex: 'studentName2',
      key: 'studentName2',
      width: '25%',
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
                  onDelete={() => handleDeleteSchedule(record.schedule2.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
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
      const response = await createSchedule(currentTimetable.id, payload);
      if (response.success) {
        message.success('添加成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
        // 更新课程数量
        updateTimetableScheduleCount(currentTimetable.id);
      } else {
        message.error(response.message || '添加失败');
      }
    } catch (error) {
      message.error('网络错误，添加失败');
    }
  };

  const handleUpdateSchedule = async (schedule, newName) => {
    if (!newName || newName.trim() === '') {
      message.warning('学生姓名不能为空');
      return;
    }

    try {
      const response = await updateSchedule(currentTimetable.id, schedule.id, {
        studentName: newName.trim(),
      });
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
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const response = await deleteSchedule(currentTimetable.id, scheduleId);
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
    }
  };


  // 图标主色循环
  const iconColors = ['#722ED1','#1890ff','#52c41a','#faad14','#eb2f96','#fa541c','#13c2c2','#531dab'];
  const getIconColor = (id) => iconColors[id % iconColors.length];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
        <h1 style={{ margin: 0, fontWeight: '700' }}>我的课表</h1>
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
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
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
                        {timetableScheduleCounts[item.id] > 0 && (
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyTimetable(item)}
                            style={{ color: '#52c41a', padding: '0 4px' }}
                            title="复制课表"
                          />
                        )}
                        {timetableScheduleCounts[item.id] > 0 && (
                          <Button
                            type="text"
                            size="small"
                            icon={<RetweetOutlined />}
                            onClick={async () => {
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
                            }}
                            style={{ color: '#fa8c16', padding: '0 4px' }}
                            title={item.isWeekly ? '转为日期类课表' : '按某周转为周固定'}
                          />
                        )}
                      </div>
                    )}
                  </div>
                }
                description={
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888', fontSize: '12px' }}>
                      {item.isWeekly ? (
                        <div>星期一至星期日</div>
                      ) : (
                        <div>{`${item.startDate} 至 ${item.endDate}`}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888', fontSize: '12px' }}>
                      <div>
                        <span>创建于: {dayjs(item.createdAt).format('YYYY-MM-DD')}</span>
                        <span style={{ marginLeft: '16px' }}>共</span>
                        <span style={{ color: '#1890ff' }}>{timetableScheduleCounts[item.id] || 0}</span>
                        <span>课程</span>
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
                  </>
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
                            {timetableInfo.schedules.map((sch, schIndex) => (
                              <div key={schIndex} style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                                {sch.startTime.substring(0, 5)}-{sch.endTime.substring(0, 5)} {sch.studentName}
                              </div>
                            ))}
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
                复制今日
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
                            {timetableInfo.schedules.map((sch, schIndex) => (
                              <div key={schIndex} style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                                {sch.startTime.substring(0, 5)}-{sch.endTime.substring(0, 5)} {sch.studentName}
                              </div>
                            ))}
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
                复制明日
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
          try {
            if (convertModal.mode === 'dateToWeekly') {
              if (!selectedWeekStart) { message.warning('请选择一周'); return; }
              // 跳转到预览页面
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
            } else {
              if (!dateRange || dateRange.length !== 2) { message.warning('请选择日期范围'); return; }
              const startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
              const endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');
              // 跳转到预览页面
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
            }
          } catch { message.error('操作失败'); }
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