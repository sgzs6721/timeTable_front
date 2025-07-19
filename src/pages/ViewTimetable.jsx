import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Table, message, Space, Tag, Popover, Spin, Input, Modal } from 'antd';
import { LeftOutlined, CalendarOutlined, RightOutlined, CopyOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, deleteSchedule, updateSchedule, createSchedule, createSchedulesBatch } from '../services/timetable';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import html2canvas from 'html2canvas';
import EditScheduleModal from '../components/EditScheduleModal';
import { isWeChatBrowser } from '../utils/browserDetect';
import './ViewTimetable.css';

dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.locale({ ...dayjs.Ls.en, weekStart: 1 });

const dayMap = {
  MONDAY: '一',
  TUESDAY: '二',
  WEDNESDAY: '三',
  THURSDAY: '四',
  FRIDAY: '五',
  SATURDAY: '六',
  SUNDAY: '日',
};

const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onExport, onMove, onCopy, timetable, isArchived, onClose, deleteLoading }) => {
  const [name, setName] = React.useState(schedule.studentName);
  const isNameChanged = name !== schedule.studentName;

  return (
    <div style={{ width: '220px', display: 'flex', flexDirection: 'column' }}>
      {/* 关闭图标 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
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
          disabled={isArchived}
        />
        {!isArchived && (
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
        )}
      </div>

      {timetable.isWeekly ? (
        <p style={{ margin: '8px 0', textAlign: 'left' }}>
          {`星期${dayMap[schedule.dayOfWeek.toUpperCase()] || schedule.dayOfWeek}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`}
        </p>
      ) : (
        <p style={{ margin: '8px 0', textAlign: 'left' }}>
          {`${schedule.scheduleDate}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`}
        </p>
      )}

      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        <Button
          type="primary"
          size="small"
          onClick={() => onExport(schedule.studentName)}
          style={{ 
            flex: 1,
            backgroundColor: '#52c41a',
            borderColor: '#52c41a'
          }}
        >
          全部
        </Button>
        {!isArchived && (
          <>
            <Button
              type="default"
              size="small"
              onClick={() => onMove(schedule)}
              style={{
                flex: 1,
                backgroundColor: '#1890ff',
                borderColor: '#1890ff',
                color: 'white'
              }}
            >
              移动
            </Button>
            <Button
              type="default"
              size="small"
              onClick={() => onCopy(schedule)}
              style={{
                flex: 1,
                backgroundColor: '#722ed1',
                borderColor: '#722ed1',
                color: 'white'
              }}
            >
              复制
            </Button>
            <Button
              type="primary"
              danger
              loading={deleteLoading}
              onClick={onDelete}
              size="small"
              disabled={deleteLoading}
              style={{ 
                flex: 1,
                backgroundColor: '#ff4d4f',
                borderColor: '#ff4d4f'
              }}
            >
              删除
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

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

const ViewTimetable = ({ user }) => {
  const [timetable, setTimetable] = useState(null);
  const [timetableOwner, setTimetableOwner] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportingStudentName, setExportingStudentName] = useState('');

  // 多选功能状态
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [batchScheduleModalVisible, setBatchScheduleModalVisible] = useState(false);
  const [batchStudentName, setBatchStudentName] = useState('');

  // Day schedule modal state
  const [dayScheduleModalVisible, setDayScheduleModalVisible] = useState(false);
  const [dayScheduleData, setDayScheduleData] = useState([]);
  const [dayScheduleTitle, setDayScheduleTitle] = useState('');
  const [daySchedulesForCopy, setDaySchedulesForCopy] = useState([]);
  const [currentDayDate, setCurrentDayDate] = useState(null);
  const [currentDayLabel, setCurrentDayLabel] = useState('');

  // 移动功能状态
  const [moveMode, setMoveMode] = useState(false);
  const [scheduleToMove, setScheduleToMove] = useState(null);
  const [selectedMoveTarget, setSelectedMoveTarget] = useState(null);
  const [moveTargetText, setMoveTargetText] = useState('请选择要移动到的时间段');
  const [moveLoading, setMoveLoading] = useState(false);

  // 复制功能状态
  const [copyMode, setCopyMode] = useState(false);
  const [scheduleToCopy, setScheduleToCopy] = useState(null);
  const [selectedCopyTargets, setSelectedCopyTargets] = useState(new Set());
  const [copyLoading, setCopyLoading] = useState(false);

  // 删除功能状态
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 智能弹框定位函数
  const getSmartPlacement = useCallback((dayIndex, timeIndex) => {
    const totalTimeSlots = 11; // 固定的时间段数量：09:00-20:00，共11个时间段
    const screenWidth = window.innerWidth;

    // 移动端优先使用上下方向
    if (screenWidth <= 768) {
      if (timeIndex <= Math.floor(totalTimeSlots / 2)) {
        return 'bottom';
      } else {
        return 'top';
      }
    }

    // 桌面端智能定位
    // 根据列位置决定左右方向 (dayIndex: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日)
    let horizontalPlacement;
    if (dayIndex <= 1) {
      // 周一、周二：弹框显示在右侧
      horizontalPlacement = 'right';
    } else if (dayIndex >= 5) {
      // 周六、周日：弹框显示在左侧
      horizontalPlacement = 'left';
    } else {
      // 周三、周四、周五：根据时间位置决定，优先使用上下方向
      if (timeIndex <= Math.floor(totalTimeSlots / 3)) {
        return 'bottom';
      } else if (timeIndex >= Math.floor(totalTimeSlots * 2 / 3)) {
        return 'top';
      } else {
        return 'top'; // 中间时间段默认上方
      }
    }

    // 根据行位置决定上下方向
    let verticalPlacement;
    if (timeIndex <= Math.floor(totalTimeSlots / 3)) {
      // 前1/3行，弹框显示在下方
      verticalPlacement = 'Bottom';
    } else if (timeIndex >= Math.floor(totalTimeSlots * 2 / 3)) {
      // 后1/3行，弹框显示在上方
      verticalPlacement = 'Top';
    } else {
      // 中间行，默认显示在下方
      verticalPlacement = 'Bottom';
    }

    return `${horizontalPlacement}${verticalPlacement}`;
  }, []);



  const tableRef = useRef(null);
  const navigate = useNavigate();
  const { timetableId } = useParams();

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

  // 时间段定义
  const timeSlots = [
    '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '13:00-14:00', '14:00-15:00',
    '15:00-16:00', '16:00-17:00', '17:00-18:00',
    '18:00-19:00', '19:00-20:00'
  ];

  // 星期定义
  const weekDays = [
    { key: 'monday', label: '周一' },
    { key: 'tuesday', label: '周二' },
    { key: 'wednesday', label: '周三' },
    { key: 'thursday', label: '周四' },
    { key: 'friday', label: '周五' },
    { key: 'saturday', label: '周六' },
    { key: 'sunday', label: '周日' },
  ];

  // Swipe handling
  const touchStartRef = React.useRef(null);

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const delta = touchEndX - touchStartRef.current;
    const threshold = 50; // px
    if (Math.abs(delta) > threshold) {
      if (delta < 0 && currentWeek < totalWeeks) {
        setCurrentWeek(currentWeek + 1);
      } else if (delta > 0 && currentWeek > 1) {
        setCurrentWeek(currentWeek - 1);
      }
    }
    touchStartRef.current = null;
  };

  const handleShowDayCourses = (day, dayIndex) => {
    let schedulesForDay = [];
    let modalTitle = '';
    let targetDate = null;

    if (timetable.isWeekly) {
      schedulesForDay = allSchedules.filter(s => s.dayOfWeek.toLowerCase() === day.key);
      modalTitle = `${timetable.name} - ${day.label}`;
      // 对于周固定课表，计算本周对应的日期
      const today = dayjs();
      const currentWeekStart = today.startOf('week');
      targetDate = currentWeekStart.add(dayIndex, 'day');
    } else {
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        targetDate = weekDates.start.add(dayIndex, 'day');
        const dateStr = targetDate.format('YYYY-MM-DD');
        schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
        modalTitle = `${timetable.name} - ${dateStr} (${day.label})`;
      }
    }

    const sortedSchedules = schedulesForDay.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (sortedSchedules.length === 0) {
      message.info('当天没有课程');
      return;
    }

    const studentColorMapForDay = new Map(studentColorMap);
    sortedSchedules.forEach(s => {
      if (s.studentName && !studentColorMapForDay.has(s.studentName)) {
        studentColorMapForDay.set(s.studentName, colorPalette[studentColorMapForDay.size % colorPalette.length]);
      }
    });

    const firstScheduleHour = parseInt(sortedSchedules[0].startTime.substring(0, 2));
    const timeSlotsForDay = [];
    for (let hour = firstScheduleHour; hour <= 19; hour++) {
      timeSlotsForDay.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        displayTime: `${hour}-${hour + 1}`,
      });
    }

    const tableData = timeSlotsForDay.map((slot, index) => {
      const schedule = sortedSchedules.find(s => s.startTime.substring(0, 5) === slot.time);
      return {
        key: index,
        time: slot.displayTime,
        studentName: schedule ? schedule.studentName : '',
        schedule: schedule || null,
      };
    });

    setDayScheduleData(tableData);
    setDayScheduleTitle(modalTitle);
    setDaySchedulesForCopy(sortedSchedules);
    setCurrentDayDate(targetDate);
    setCurrentDayLabel(day.label);
    setDayScheduleModalVisible(true);
  };

  const generateCopyTextForDay = (schedules, targetDate, dayLabel) => {
    if (!schedules || schedules.length === 0) return '没有可复制的课程';
    
    // 格式化日期为：2025年07月14日
    let formattedDate = '';
    if (targetDate) {
      formattedDate = targetDate.format('YYYY年MM月DD日');
    }
    
    // 获取教练名称
    const coachName = timetableOwner?.nickname || timetableOwner?.username || '教练';
    
    // 构建标题
    const title = formattedDate ? `${formattedDate} ${dayLabel}课程安排` : `${dayLabel}课程安排`;
    
    // 构建课程列表
    const courseList = schedules.map(schedule => {
        const startHour = parseInt(schedule.startTime.substring(0, 2));
        const endHour = startHour + 1;
        return `${startHour}-${endHour} ${schedule.studentName}`;
    }).join('\n');
    
    return `${title}\n${coachName}：\n${courseList}`;
  };



  useEffect(() => {
    fetchTimetable();
  }, [timetableId]);

  useEffect(() => {
    if (timetable) {
      fetchSchedules();
    }
  }, [timetable, currentWeek]); // 添加currentWeek依赖，当周数变化时重新获取数据

  const fetchTimetable = async () => {
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        const { timetable: timetableData, owner } = response.data;
        setTimetable(timetableData);
        setTimetableOwner(owner);
        if (!timetableData.isWeekly && timetableData.startDate && timetableData.endDate) {
          const start = dayjs(timetableData.startDate);
          const end = dayjs(timetableData.endDate);
          const today = dayjs();

          // 找到起始日期所在周的周一（与后端逻辑一致）
          const anchorMonday = start.startOf('week');

          // 计算总周数
          const totalDays = end.diff(anchorMonday, 'day') + 1;
          const weeks = Math.ceil(totalDays / 7);
          setTotalWeeks(weeks > 0 ? weeks : 1);

          // 计算当前应该显示的周数
          let targetWeek = 1; // 默认第一周

          // 检查今天是否在课表日期范围内
          if (today.isSameOrAfter(start) && today.isSameOrBefore(end)) {
            // 计算今天是第几周
            const daysSinceAnchor = today.diff(anchorMonday, 'day');
            const weekNumber = Math.floor(daysSinceAnchor / 7) + 1;

            // 确保周数在有效范围内
            if (weekNumber >= 1 && weekNumber <= weeks) {
              targetWeek = weekNumber;
            }
          }

          setCurrentWeek(targetWeek);
        }
      } else {
        message.error(response.message || '获取课表失败');
        navigate('/dashboard');
      }
    } catch (error) {
      message.error('获取课表失败，请检查网络连接');
      navigate('/dashboard');
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // 对于日期范围课表，按周获取数据；对于周固定课表，获取所有数据
      const week = timetable && !timetable.isWeekly ? currentWeek : null;
      const response = await getTimetableSchedules(timetableId, week);
      if (response.success) {
        setAllSchedules(response.data);
      } else {
        message.error(response.message || '获取课程安排失败');
      }
    } catch (error) {
      message.error('获取课程安排失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 局部刷新函数，不影响页面loading状态
  const refreshSchedulesQuietly = async () => {
    try {
      const week = timetable && !timetable.isWeekly ? currentWeek : null;
      const response = await getTimetableSchedules(timetableId, week);
      if (response.success) {
        setAllSchedules(response.data);
      } else {
        message.error(response.message || '获取课程安排失败');
      }
    } catch (error) {
      message.error('获取课程安排失败，请检查网络连接');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    setDeleteLoading(true);
    try {
      const response = await deleteSchedule(timetableId, scheduleId);
      if (response.success) {
        setOpenPopoverKey(null);
        await refreshSchedulesQuietly();
        message.success('删除成功');
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 更新学生姓名
  const handleSaveStudentName = async (scheduleObj, newName) => {
    if (!newName || newName.trim() === '') {
      message.warning('学生姓名不能为空');
      return;
    }
    const payload = {
      studentName: newName.trim(),
    };
    try {
      const response = await updateSchedule(timetableId, scheduleObj.id, payload);
      if (response.success) {
        setOpenPopoverKey(null);
        await refreshSchedulesQuietly();
        message.success('修改成功');
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  const handleStartMove = (schedule) => {
    setScheduleToMove(schedule);
    setMoveMode(true);
    setSelectedMoveTarget(null);
    setOpenPopoverKey(null);
    message.info('请选择要移动到的时间段');
  };

  const handleCancelMove = () => {
    setMoveMode(false);
    setScheduleToMove(null);
    setSelectedMoveTarget(null);
    setMoveTargetText('请选择要移动到的时间段');
  };

  const handleSelectMoveTarget = (targetDayKey, targetTimeIndex) => {
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const targetKey = `${pagePrefix}-${targetDayKey}-${targetTimeIndex}`;
    setSelectedMoveTarget(targetKey);
    
    // 生成显示文本
    const dayText = dayMap[targetDayKey.toUpperCase()] || targetDayKey;
    const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'];
    const timeText = timeSlots[targetTimeIndex] || `${targetTimeIndex + 9}:00-${targetTimeIndex + 10}:00`;
    
    setMoveTargetText(`移动到周${dayText}，${timeText}`);
  };

  const handleConfirmMove = async () => {
    if (!selectedMoveTarget || !scheduleToMove) {
      message.warning('请先选择移动目标位置');
      return;
    }

    setMoveLoading(true);
    console.log('selectedMoveTarget:', selectedMoveTarget);
    console.log('scheduleToMove:', scheduleToMove);
    
    // 处理key格式: week-3-tuesday-5 或 weekly-tuesday-5
    const parts = selectedMoveTarget.split('-');
    let targetDayKey, targetTimeIndex;
    
    if (parts.length === 4) {
      // week-3-tuesday-5 格式
      targetDayKey = parts[2];
      targetTimeIndex = parts[3];
    } else if (parts.length === 3) {
      // weekly-tuesday-5 格式
      targetDayKey = parts[1]; 
      targetTimeIndex = parts[2];
    } else {
      message.error('移动目标格式错误');
      return;
    }
    
    console.log('targetDayKey:', targetDayKey, 'targetTimeIndex:', targetTimeIndex);
    
    const targetTimeSlot = timeSlots[parseInt(targetTimeIndex)];
    console.log('targetTimeSlot:', targetTimeSlot);
    
    const [startTimeStr, endTimeStr] = targetTimeSlot.split('-');
    const startTime = `${startTimeStr}:00`;
    const endTime = `${endTimeStr}:00`;

    let payload = {
      startTime,
      endTime,
      dayOfWeek: targetDayKey.toUpperCase(),
    };

    // 如果是日期范围课表，需要计算目标日期
    if (!timetable.isWeekly) {
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        const dayIndex = weekDays.findIndex(day => day.key === targetDayKey);
        const targetDate = weekDates.start.add(dayIndex, 'day');
        payload.scheduleDate = targetDate.format('YYYY-MM-DD');
      }
    }

    try {
      const response = await updateSchedule(timetableId, scheduleToMove.id, payload);
      if (response.success) {
        setMoveMode(false);
        setScheduleToMove(null);
        setSelectedMoveTarget(null);
        setMoveTargetText('请选择要移动到的时间段');
        await refreshSchedulesQuietly();
        message.success('课程移动成功');
      } else {
        message.error(response.message || '移动失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setMoveLoading(false);
    }
  };



  const handleStartCopy = (schedule) => {
    setCopyMode(true);
    setScheduleToCopy(schedule);
    setSelectedCopyTargets(new Set());
    setOpenPopoverKey(null);
    message.info('选择要复制到的时间段（可多选），点击确认复制');
  };

  const handleCancelCopy = () => {
    setCopyMode(false);
    setScheduleToCopy(null);
    setSelectedCopyTargets(new Set());
  };

  const handleSelectCopyTarget = (targetDayKey, targetTimeIndex) => {
    // 使用与cellKey相同的格式
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const targetKey = `${pagePrefix}-${targetDayKey}-${targetTimeIndex}`;
    const newTargets = new Set(selectedCopyTargets);
    
    if (newTargets.has(targetKey)) {
      newTargets.delete(targetKey);
    } else {
      newTargets.add(targetKey);
    }
    
    setSelectedCopyTargets(newTargets);
  };

  const handleConfirmCopy = async () => {
    if (!scheduleToCopy || selectedCopyTargets.size === 0) {
      message.warning('请先选择要复制到的时间段');
      return;
    }

    setCopyLoading(true);
    try {
      // 构建批量创建的payload数组
      const schedulesToCreate = Array.from(selectedCopyTargets).map((targetKey) => {
        // 解析cellKey格式：pagePrefix-dayKey-timeIndex
        const parts = targetKey.split('-');
        let dayKey, timeIndex, weekNum;

        if (timetable.isWeekly) {
          // 周固定课表：weekly-dayKey-timeIndex
          [, dayKey, timeIndex] = parts;
        } else {
          // 日期范围课表：week-weekNum-dayKey-timeIndex
          [, weekNum, dayKey, timeIndex] = parts;
        }

        const dayIndex = weekDays.findIndex(day => day.key === dayKey);
        const targetTimeSlot = timeSlots[parseInt(timeIndex)];
        const [startTimeStr, endTimeStr] = targetTimeSlot.split('-');
        const startTime = `${startTimeStr}:00`;
        const endTime = `${endTimeStr}:00`;

        let scheduleDate = null;
        if (!timetable.isWeekly) {
          // 对于日期范围课表，使用cellKey中的周数信息计算日期
          const targetWeek = weekNum ? parseInt(weekNum) : currentWeek;
          const startDate = dayjs(timetable.startDate);
          const anchorMonday = startDate.startOf('week');
          const weekStart = anchorMonday.add(targetWeek - 1, 'week');
          const currentDate = weekStart.add(dayIndex, 'day');
          scheduleDate = currentDate.format('YYYY-MM-DD');
        }

        const payload = {
          studentName: scheduleToCopy.studentName,
          dayOfWeek: dayKey.toUpperCase(),
          startTime,
          endTime,
          note: '复制创建',
        };

        if (scheduleDate) {
          payload.scheduleDate = scheduleDate;
        }

        return payload;
      });

      // 使用批量创建接口
      const response = await createSchedulesBatch(timetableId, schedulesToCreate);
      
      if (response.success) {
        await refreshSchedulesQuietly();
        message.success(`成功复制 ${schedulesToCreate.length} 个课程`);
      } else {
        message.error(response.message || '复制失败');
      }

      handleCancelCopy();
    } catch (err) {
      message.error('网络错误，复制失败');
      handleCancelCopy();
    } finally {
      setCopyLoading(false);
    }
  };

  const handleExportStudentSchedule = async (studentName) => {
    try {
      message.loading({ content: '正在导出全部课时...', key: 'exporting' });

      let schedulesToExport;
      if (timetable && !timetable.isWeekly) {
        const response = await getTimetableSchedules(timetableId);
        // 检查响应是否成功
        if (response && response.success) {
          schedulesToExport = response.data;
        } else {
          message.destroy('exporting');
          message.error(response?.message || '获取全部课程安排失败');
          return;
        }
      } else {
        schedulesToExport = allSchedules;
      }

      const studentSchedules = schedulesToExport.filter(s => s.studentName === studentName);
      message.destroy('exporting');

      if (studentSchedules.length === 0) {
        message.info('该学生在本课表没有课程');
        return;
      }

      setExportingStudentName(studentName);

      // 格式化内容
      let content = '';

      if (timetable.isWeekly) {
        // 周固定课表
        content += studentSchedules
          .map(s => {
            const dayOfWeek = s.dayOfWeek ? s.dayOfWeek.toUpperCase() : '';
            
            // 改进的映射逻辑
            let dayText = dayMap[dayOfWeek];
            if (!dayText) {
              // 如果dayMap中没有找到，尝试其他可能的格式
              if (dayOfWeek.includes('MONDAY') || dayOfWeek.includes('一')) dayText = '一';
              else if (dayOfWeek.includes('TUESDAY') || dayOfWeek.includes('二')) dayText = '二';
              else if (dayOfWeek.includes('WEDNESDAY') || dayOfWeek.includes('三')) dayText = '三';
              else if (dayOfWeek.includes('THURSDAY') || dayOfWeek.includes('四')) dayText = '四';
              else if (dayOfWeek.includes('FRIDAY') || dayOfWeek.includes('五')) dayText = '五';
              else if (dayOfWeek.includes('SATURDAY') || dayOfWeek.includes('六')) dayText = '六';
              else if (dayOfWeek.includes('SUNDAY') || dayOfWeek.includes('日') || dayOfWeek.includes('天')) dayText = '日';
              else dayText = s.dayOfWeek || '未知';
            }
            
            return `星期${dayText}, ${s.startTime.substring(0, 5)}~${s.endTime.substring(0, 5)}`;
          })
          .join('\n');
      } else {
        // 日期范围课表 - 根据scheduleDate计算星期几，并按日期排序
        content += studentSchedules
          .sort((a, b) => {
            // 按scheduleDate从早到晚排序
            const dateA = new Date(a.scheduleDate);
            const dateB = new Date(b.scheduleDate);
            return dateA - dateB;
          })
          .map(s => {
            let dayText = '未知';
            
            // 如果有scheduleDate，根据日期计算星期几
            if (s.scheduleDate) {
              const date = new Date(s.scheduleDate);
              const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
              const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
              dayText = weekDays[dayOfWeek];
            } else if (s.dayOfWeek) {
              // 如果dayOfWeek存在，使用映射逻辑
              const dayOfWeek = s.dayOfWeek.toUpperCase();
              let mappedDayText = dayMap[dayOfWeek];
              if (!mappedDayText) {
                if (dayOfWeek.includes('MONDAY') || dayOfWeek.includes('一')) mappedDayText = '一';
                else if (dayOfWeek.includes('TUESDAY') || dayOfWeek.includes('二')) mappedDayText = '二';
                else if (dayOfWeek.includes('WEDNESDAY') || dayOfWeek.includes('三')) mappedDayText = '三';
                else if (dayOfWeek.includes('THURSDAY') || dayOfWeek.includes('四')) mappedDayText = '四';
                else if (dayOfWeek.includes('FRIDAY') || dayOfWeek.includes('五')) mappedDayText = '五';
                else if (dayOfWeek.includes('SATURDAY') || dayOfWeek.includes('六')) mappedDayText = '六';
                else if (dayOfWeek.includes('SUNDAY') || dayOfWeek.includes('日') || dayOfWeek.includes('天')) mappedDayText = '日';
                else mappedDayText = s.dayOfWeek;
              }
              dayText = mappedDayText;
            }
            
            return `${s.scheduleDate}, 星期${dayText}, ${s.startTime.substring(0, 5)}~${s.endTime.substring(0, 5)}`;
          })
          .join('\n');
      }

      setExportContent(content);
      setExportModalVisible(true);
      setOpenPopoverKey(null);
    } catch (error) {
      message.destroy('exporting');
      console.error('导出失败:', error);
      message.error('导出失败，请检查网络连接');
    }
  };

  const handleExportTable = () => {
    const tableNode = tableRef.current;
    if (!tableNode) {
      message.error('无法导出，未找到表格元素');
      return;
    }

    message.loading({ content: '正在生成图片...', key: 'exporting' });

    // 1. 克隆节点
    const clonedNode = tableNode.cloneNode(true);

    // 2. 在克隆体上修改截断的学生姓名
    const elementsToModify = clonedNode.querySelectorAll('.student-name-truncated');

    elementsToModify.forEach(el => {
      if (el.title) {
        el.innerText = el.title;
      }
    });

    // 计算整个表格中最长文字的宽度
    const calculateMaxTextWidth = () => {
      let maxWidth = 0;

      // 为计算文字宽度创建测试元素
      const testDiv = document.createElement('div');
      testDiv.style.position = 'absolute';
      testDiv.style.left = '-9999px';
      testDiv.style.fontSize = '12px';
      testDiv.style.fontFamily = 'inherit';
      testDiv.style.whiteSpace = 'nowrap';
      testDiv.style.visibility = 'hidden';
      document.body.appendChild(testDiv);

      // 检查所有表头
      const headerCells = clonedNode.querySelectorAll('thead th');
      headerCells.forEach(th => {
        testDiv.innerText = th.innerText || th.textContent || '';
        maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
      });

      // 检查所有单元格内容
      const allCells = clonedNode.querySelectorAll('tbody td');
      allCells.forEach(cell => {
        // 获取单元格中所有学生姓名（包括截断的）
        const studentNames = cell.querySelectorAll('.student-name-truncated');
        studentNames.forEach(nameEl => {
          const fullName = nameEl.title || nameEl.innerText;
          testDiv.innerText = fullName;
          maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
        });

        // 也检查非截断的文本
        const allText = cell.innerText || cell.textContent || '';
        if (allText.trim()) {
          testDiv.innerText = allText;
          maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
        }
      });

      document.body.removeChild(testDiv);

      // 添加一个字的宽度作为缓冲（约14px）
      return maxWidth + 14;
    };

    const maxTextWidth = calculateMaxTextWidth();
    const headerCells = clonedNode.querySelectorAll('thead th');
    const columnCount = headerCells.length;

    // 所有列都使用相同宽度，基于最长文字+1个字的宽度
    const uniformWidth = Math.max(maxTextWidth, 60); // 最小60px
    const totalWidth = uniformWidth * columnCount;

    // 对所有单元格设置统一样式
    const allCells = clonedNode.querySelectorAll('td, th');
    allCells.forEach(cell => {
      cell.style.whiteSpace = 'nowrap';  // 所有单元格都不换行
      cell.style.overflow = 'visible';
      cell.style.textOverflow = 'clip';
      cell.style.padding = '8px 16px';  // 内边距
    });

    // 设置表格布局和各列宽度
    const tableElement = clonedNode.querySelector('table');
    if (tableElement) {
      tableElement.style.tableLayout = 'fixed';
      tableElement.style.width = `${totalWidth}px`;

      // 所有列都设置为相同宽度
      headerCells.forEach(th => {
        th.style.width = `${uniformWidth}px`;
      });
    }

    // 必须将克隆节点添加到DOM中才能被html2canvas捕获，但可以设为不可见
    clonedNode.style.position = 'absolute';
    clonedNode.style.width = `${totalWidth}px`;  // 匹配表格宽度
    clonedNode.style.left = '-9999px';
    clonedNode.style.top = '0px';
    clonedNode.style.backgroundColor = 'white';
    document.body.appendChild(clonedNode);

    // 3. 对克隆体截图
    html2canvas(clonedNode, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      const weekInfo = !timetable?.isWeekly && totalWeeks > 1 ? `-第${currentWeek}周` : '';
      link.download = `${timetable?.name || '课表'}${weekInfo}-${new Date().toLocaleString()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success({ content: '图片已导出！', key: 'exporting' });
    }).catch(error => {
      console.error('导出失败:', error);
      message.error({ content: '导出失败，请稍后重试', key: 'exporting' });
    }).finally(() => {
      // 4. 清理
      document.body.removeChild(clonedNode);
    });
  };

  // 多选功能处理函数
  const toggleMultiSelectMode = () => {
    const newMode = !multiSelectMode;
    setMultiSelectMode(newMode);
    setSelectedCells(new Set()); // 切换模式时总是清空选择
    setOpenPopoverKey(null);

    // 如果是进入多选模式，显示提示
    if (newMode) {
      message.info('已进入多选模式，点击空白单元格进行选择');
    }
  };

  const handleCellSelection = (cellKey, dayIndex, timeIndex) => {
    if (!multiSelectMode) return;

    const newSelectedCells = new Set(selectedCells);
    if (newSelectedCells.has(cellKey)) {
      newSelectedCells.delete(cellKey);
    } else {
      newSelectedCells.add(cellKey);
    }
    setSelectedCells(newSelectedCells);
  };

  // 获取当前页面的选择数量
  const getCurrentPageSelectionCount = useCallback(() => {
    if (!multiSelectMode || selectedCells.size === 0) return 0;

    const currentPagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    let count = 0;

    selectedCells.forEach(cellKey => {
      if (cellKey.startsWith(currentPagePrefix)) {
        count++;
      }
    });

    return count;
  }, [multiSelectMode, selectedCells, timetable?.isWeekly, currentWeek]);

  const openBatchScheduleModal = () => {
    if (selectedCells.size === 0) {
      message.warning('请先选择要排课的时间段');
      return;
    }
    setBatchScheduleModalVisible(true);
  };

  const handleBatchSchedule = async () => {
    if (!batchStudentName.trim()) {
      message.warning('请输入学生姓名');
      return;
    }

    const weekDates = getCurrentWeekDates();
    const schedulesToCreate = [];

    Array.from(selectedCells).forEach(cellKey => {
      // 解析新的cellKey格式：pagePrefix-dayKey-timeIndex
      const parts = cellKey.split('-');
      let dayKey, timeIndex, weekNum;

      if (timetable.isWeekly) {
        // 周固定课表：weekly-dayKey-timeIndex
        [, dayKey, timeIndex] = parts;
      } else {
        // 日期范围课表：week-weekNum-dayKey-timeIndex
        [, weekNum, dayKey, timeIndex] = parts;
      }

      const dayIndex = weekDays.findIndex(day => day.key === dayKey);
      const timeSlot = timeSlots[parseInt(timeIndex)];
      const [startTimeStr, endTimeStr] = timeSlot.split('-');
      const startTime = `${startTimeStr}:00`;
      const endTime = `${endTimeStr}:00`;

      let scheduleDate = null;
      if (!timetable.isWeekly) {
        // 对于日期范围课表，使用cellKey中的周数信息计算日期
        const targetWeek = weekNum ? parseInt(weekNum) : currentWeek;
        const startDate = dayjs(timetable.startDate);
        const anchorMonday = startDate.startOf('week');
        const weekStart = anchorMonday.add(targetWeek - 1, 'week');
        const currentDate = weekStart.add(dayIndex, 'day');
        scheduleDate = currentDate.format('YYYY-MM-DD');
      }

      const payload = {
        studentName: batchStudentName.trim(),
        dayOfWeek: dayKey.toUpperCase(),
        startTime,
        endTime,
        note: '批量添加',
      };

      if (scheduleDate) {
        payload.scheduleDate = scheduleDate;
      }

      schedulesToCreate.push(payload);
    });

    try {
      const response = await createSchedulesBatch(timetableId, schedulesToCreate);
      if (response.success) {
        setBatchScheduleModalVisible(false);
        setBatchStudentName('');
        setSelectedCells(new Set());
        setMultiSelectMode(false);
        await refreshSchedulesQuietly();
        message.success(`成功添加 ${schedulesToCreate.length} 个课程安排`);
      } else {
        message.error(response.message || '批量添加失败');
      }
    } catch (error) {
      message.error('网络错误，批量添加失败');
    }
  };

  const cancelBatchSchedule = () => {
    setBatchScheduleModalVisible(false);
    setBatchStudentName('');
  };



  // Get the date range for the current week based on Monday as the first day
  const getCurrentWeekDates = () => {
    if (!timetable || timetable.isWeekly) return { start: null, end: null };

    const startDate = dayjs(timetable.startDate);

    // 找到起始日期所在周的周一（与后端逻辑一致）
    const anchorMonday = startDate.startOf('week');

    // 计算当前周的开始和结束日期
    const weekStart = anchorMonday.add(currentWeek - 1, 'week');
    const weekEnd = weekStart.add(6, 'day');

    return { start: weekStart, end: weekEnd };
  };

  // 由于我们现在按周获取数据，所以直接使用allSchedules
  const currentWeekSchedules = useMemo(() => {
    return allSchedules || [];
  }, [allSchedules]);

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
  };

  const colorPalette = [
    '#E6F7FF', '#F0F5FF', '#F6FFED', '#FFFBE6', '#FFF1F0', '#FCF4FF',
    '#FFF0F6', '#F9F0FF', '#FFF7E6', '#FFFAE6', '#D9F7BE', '#B5F5EC',
    '#ADC6FF', '#D3ADF7', '#FFADD2', '#FFD8BF'
  ];

  const textColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];

  const studentColorMap = new Map();
  const studentTextColorMap = new Map();

  const allStudentNames = [...new Set(allSchedules.map(s => s.studentName).filter(Boolean))];
  allStudentNames.forEach((name, index) => {
    studentColorMap.set(name, colorPalette[index % colorPalette.length]);
    studentTextColorMap.set(name, textColorPalette[index % textColorPalette.length]);
  });

  const generateColumns = () => {
    const weekDates = getCurrentWeekDates();

    const columns = [
      {
        title: '时间',
        dataIndex: 'time',
        key: 'time',
        className: 'timetable-time-column',
        render: (time) => (
          <div className="time-cell">
            {time.split('-').map((t, i) => (
              <div key={i} className="time-part">{t}</div>
            ))}
          </div>
        )
      },
    ];

    weekDays.forEach((day, index) => {
      let columnTitle;
      if (!timetable.isWeekly && weekDates && weekDates.start) {
        const currentDate = weekDates.start.add(index, 'day');
        columnTitle = (
          <div
            style={{ textAlign: 'center', cursor: timetable.isArchived ? 'default' : 'pointer' }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {currentDate.format('MM/DD')}
            </div>
          </div>
        );
      } else {
        columnTitle = (
          <div
            style={{ textAlign: 'center', cursor: timetable.isArchived ? 'default' : 'pointer' }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            {day.label}
          </div>
        )
      }

      columns.push({
        title: columnTitle,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (text, record) => {
          const schedules = currentWeekSchedules.filter(s => {
            const timeKey = `${s.startTime.substring(0, 5)}-${s.endTime.substring(0, 5)}`;
            let scheduleDayKey;
            if (timetable.isWeekly) {
              scheduleDayKey = s.dayOfWeek.toLowerCase();
            } else {
              const scheduleDate = dayjs(s.scheduleDate);
              const dayIndex = scheduleDate.day();
              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              scheduleDayKey = dayNames[dayIndex];
            }
            return timeKey === record.time && scheduleDayKey === day.key;
          });

          if (!schedules || schedules.length === 0) {
            const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
            const cellKey = `${pagePrefix}-${day.key}-${record.key}`;
            const isSelected = selectedCells.has(cellKey);

            if (timetable?.isArchived) {
              return <div style={{ height: '48px' }} />;
            }

            const handleCellClick = (e) => {
              if (multiSelectMode) {
                e.stopPropagation();
                handleCellSelection(cellKey, index, record.key);
              } else if (moveMode) {
                e.stopPropagation();
                handleSelectMoveTarget(day.key, record.key);
              } else if (copyMode) {
                e.stopPropagation();
                handleSelectCopyTarget(day.key, record.key);
              }
            };

            const handleOpenChange = (newOpen) => {
              if (!multiSelectMode) {
                setOpenPopoverKey(newOpen ? cellKey : null);
              }
            };

            const handleAddSchedule = async (studentName) => {
              const trimmedName = studentName.trim();
              if (!trimmedName) {
                message.warning('学生姓名不能为空');
                return;
              }

              const [startTimeStr, endTimeStr] = record.time.split('-');
              const startTime = `${startTimeStr}:00`;
              const endTime = `${endTimeStr}:00`;

              let scheduleDate = null;
              if (!timetable.isWeekly && weekDates && weekDates.start) {
                const currentDate = weekDates.start.add(index, 'day');
                scheduleDate = currentDate.format('YYYY-MM-DD');
              }

              const payload = {
                studentName: trimmedName,
                dayOfWeek: day.key.toUpperCase(),
                startTime,
                endTime,
                note: '手动添加',
              };

              if (scheduleDate) {
                payload.scheduleDate = scheduleDate;
              }

              try {
                const resp = await createSchedule(timetableId, payload);
                if (resp.success) {
                  setOpenPopoverKey(null);
                  await refreshSchedulesQuietly();
                  message.success('添加成功');
                } else {
                  message.error(resp.message || '添加失败');
                }
              } catch (err) {
                message.error('网络错误，添加失败');
              }
            };

            if (multiSelectMode) {
              return (
                <div
                  style={{
                    height: '48px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                    border: isSelected ? '2px solid #1890ff' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: isSelected ? '#1890ff' : '#ccc'
                  }}
                  onClick={handleCellClick}
                  title={isSelected ? '点击取消选择' : '点击选择'}
                >
                  {isSelected ? '✓' : ''}
                </div>
              );
            }

            if (moveMode) {
              const isSelected = selectedMoveTarget === cellKey;
              return (
                                  <div
                    style={{
                      height: '48px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e6f4ff' : 'transparent',
                      border: '1px solid #f0f0f0',
                      position: 'relative'
                    }}
                    onClick={handleCellClick}
                    title={isSelected ? '点击取消选择' : '点击选择此处移动课程'}
                  >
                    {/* 右上角的单选钮 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '12px',
                        height: '12px',
                        border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        borderRadius: '50%', // 圆形单选钮
                        backgroundColor: isSelected ? '#1890ff' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      {isSelected && (
                        <div style={{ 
                          width: '4px', 
                          height: '4px', 
                          backgroundColor: 'white', 
                          borderRadius: '50%' 
                        }} />
                      )}
                    </div>
                  </div>
              );
            }

            if (copyMode) {
              const isSelected = selectedCopyTargets.has(cellKey);
              
              return (
                <div
                  style={{
                    height: '48px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    border: '1px solid #f0f0f0',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start', // Align to top to control position with padding
                    justifyContent: 'center',
                    paddingTop: isSelected ? '25px' : '0', // Push text down
                  }}
                  onClick={handleCellClick}
                  title={isSelected ? '点击取消选择' : `复制 "${scheduleToCopy?.studentName}" 到此`}
                >
                  {/* 显示被复制的学生姓名 */}
                  {isSelected && scheduleToCopy && (
                    <span style={{ fontSize: '12px', color: '#722ed1' }}>
                      {scheduleToCopy.studentName}
                    </span>
                  )}
                  {/* 右上角的小复选框 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '12px',
                      height: '12px',
                      border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '2px',
                      backgroundColor: isSelected ? '#1890ff' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: 'bold',
                      color: 'white',
                      pointerEvents: 'none' // 防止复选框阻止父元素的点击事件
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </div>
                </div>
              );
            }

            return (
              <Popover
                placement={getSmartPlacement(index, record.key)}
                title={null}
                content={ <NewSchedulePopoverContent onAdd={handleAddSchedule} onCancel={() => handleOpenChange(false)} /> }
                trigger={multiSelectMode ? "contextMenu" : "click"}
                open={!timetable?.isArchived && openPopoverKey === cellKey}
                onOpenChange={handleOpenChange}
              >
                <div style={{ height: '48px', cursor: 'pointer' }} />
              </Popover>
            );
          }

          const cellKey = `${day.key}-${record.key}`;
          const handleOpenChange = (newOpen) => {
            setOpenPopoverKey(newOpen ? cellKey : null);
          };

          const popoverContent = (
            <div>
              {schedules.map((student, idx) => (
                <div key={student.id}>
                  <SchedulePopoverContent
                    schedule={student}
                    onDelete={() => handleDeleteSchedule(student.id)}
                    onUpdateName={(newName) => handleSaveStudentName(student, newName)}
                    onExport={handleExportStudentSchedule}
                    onMove={handleStartMove}
                    onCopy={handleStartCopy}
                    timetable={timetable}
                    isArchived={timetable?.isArchived}
                    onClose={() => setOpenPopoverKey(null)}
                    deleteLoading={deleteLoading}
                  />
                  {idx < schedules.length - 1 && <hr style={{ margin: '8px 0' }} />}
                </div>
              ))}
            </div>
          );

          // 在移动模式或复制模式下，有内容的单元格不可点击
          if (moveMode || copyMode || multiSelectMode) {
            const isSourceCellForMove = moveMode && scheduleToMove && schedules.some(s => s.id === scheduleToMove.id);
            const isSourceCellForCopy = copyMode && scheduleToCopy && schedules.some(s => s.id === scheduleToCopy.id);
            const isSourceCell = isSourceCellForMove || isSourceCellForCopy;

            let modeText = '此模式下无法操作已有课程';
            if (moveMode) modeText = '移动模式下无法操作已有课程';
            if (copyMode) modeText = '复制模式下无法操作已有课程';
            if (multiSelectMode) modeText = '多选模式下无法选择已有课程的单元格';

            let sourceCellTitle = '';
            if (isSourceCellForMove) sourceCellTitle = `正在移动: ${scheduleToMove.studentName}`;
            if (isSourceCellForCopy) sourceCellTitle = `正在复制: ${scheduleToCopy.studentName}`;

            const sourceHighlightColor = isSourceCellForCopy ? '#722ed1' : '#ff4d4f'; // 紫色用于复制，红色用于移动
            const sourceHighlightBoxShadow = isSourceCellForCopy ? '0 0 8px rgba(114, 46, 209, 0.7)' : '0 0 8px rgba(255, 77, 79, 0.7)';

            return (
              <div style={{
                height: '100%',
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                cursor: 'not-allowed',
                // 高亮源单元格
                border: isSourceCell ? `2px solid ${sourceHighlightColor}` : 'none',
                boxShadow: isSourceCell ? sourceHighlightBoxShadow : 'none',
                borderRadius: isSourceCell ? '4px' : '0',
                opacity: isSourceCell ? 1 : 0.6
              }}>
                {schedules.map((student, idx) => (
                  <div
                    key={student.id}
                    style={{
                      backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#333',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                      borderTop: idx > 0 ? '1px solid #fff' : 'none',
                    }}
                    title={isSourceCell ? sourceCellTitle : modeText}
                  >
                    {(() => {
                      const isTruncated = student.studentName.length > 4;
                      const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                      return (
                        <span
                          className={isTruncated ? 'student-name-truncated' : ''}
                          title={isTruncated ? student.studentName : undefined}
                        >
                          {content}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          }

          return (
            <Popover
              placement={getSmartPlacement(index, record.key)}
              title={null}
              content={popoverContent}
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={handleOpenChange}
            >
              <div style={{ height: '100%', minHeight: '48px', display: 'flex', flexDirection: 'column', width: '100%', cursor: 'pointer' }}>
                {schedules.map((student, idx) => (
                  <div
                    key={student.id}
                    style={{
                      backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#333',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                      borderTop: idx > 0 ? '1px solid #fff' : 'none',
                    }}
                    title={`点击查看详情或删除`}
                  >
                    {(() => {
                      const isTruncated = student.studentName.length > 4;
                      const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                      return (
                        <span
                          className={isTruncated ? 'student-name-truncated' : ''}
                          title={isTruncated ? student.studentName : undefined}
                        >
                          {content}
                        </span>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </Popover>
          );
        },
      });
    });

    return columns;
  };

  const tableDataSource = timeSlots.map((time, index) => ({
    key: index,
    time: time,
  }));

  if (loading && !timetable) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => navigate(-1)}
          icon={<LeftOutlined style={{ fontSize: 20 }} />}
          style={{
            position: 'absolute',
            left: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Space align="center" size="large">
            <CalendarOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
            <h1 style={{ margin: 0 }}>{timetable?.name}</h1>
          </Space>
        </div>
        {!isWeChatBrowser() && (
          <div style={{
            position: 'absolute',
            right: 0
          }}>
            <a
              onClick={handleExportTable}
              style={{
                color: '#1890ff',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 8px',
                textDecoration: 'none'
              }}
            >
              导出
            </a>
          </div>
        )}
      </div>

      {/* 功能控制区域 */}
      {!timetable?.isArchived && (
        <div style={{
          display: 'flex',
          justifyContent: moveMode || copyMode ? 'flex-end' : 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '8px 12px',
          backgroundColor: multiSelectMode ? '#f0f9ff' : (moveMode ? '#e6f4ff' : (copyMode ? '#f6ffed' : '#fafafa')),
          borderRadius: '6px',
          border: multiSelectMode ? '1px solid #bae7ff' : (moveMode ? '1px solid #91caff' : (copyMode ? '1px solid #b7eb8f' : '1px solid #f0f0f0'))
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', justifyContent: moveMode || copyMode ? 'space-between' : 'flex-start' }}>
            {!moveMode && !copyMode && (
              <Button
                type={multiSelectMode ? 'default' : 'default'}
                size="small"
                onClick={toggleMultiSelectMode}
                style={multiSelectMode ? {
                  backgroundColor: '#fff2f0',
                  borderColor: '#ffccc7',
                  color: '#cf1322'
                } : {}}
              >
                {multiSelectMode ? '退出多选' : '多选排课'}
              </Button>
            )}

            {moveMode && (
              <>
                <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 'bold' }}>
                  {moveTargetText}
                </span>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button
                    type="default"
                    size="small"
                    onClick={handleCancelMove}
                    style={{
                      backgroundColor: '#fff2f0',
                      borderColor: '#ffccc7',
                      color: '#cf1322'
                    }}
                  >
                    取消移动
                  </Button>
                  {selectedMoveTarget && (
                    <Button
                      type="primary"
                      size="small"
                      loading={moveLoading}
                      onClick={handleConfirmMove}
                      disabled={moveLoading}
                      style={{
                        backgroundColor: '#1890ff',
                        borderColor: '#1890ff',
                        color: '#ffffff'
                      }}
                    >
                      确认移动
                    </Button>
                  )}
                </div>
              </>
            )}

            {copyMode && (
              <>
                <span style={{ fontSize: '14px', color: '#722ed1', fontWeight: 'bold' }}>
                  请选择要复制到的时间段
                </span>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button
                    type="default"
                    size="small"
                    onClick={handleCancelCopy}
                    style={{
                      backgroundColor: '#fff2f0',
                      borderColor: '#ffccc7',
                      color: '#cf1322'
                    }}
                  >
                    取消复制
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    loading={copyLoading}
                    onClick={handleConfirmCopy}
                    disabled={selectedCopyTargets.size === 0 || copyLoading}
                    style={{
                      backgroundColor: '#1890ff',
                      borderColor: '#1890ff',
                      color: '#ffffff'
                    }}
                  >
                    确认复制 ({selectedCopyTargets.size})
                  </Button>
                </div>
              </>
            )}

            {multiSelectMode && (
              <span style={{ fontSize: '14px', color: '#666' }}>
                {timetable?.isWeekly ? (
                  `已选择 ${selectedCells.size} 个时间段`
                ) : (
                  `共选择 ${selectedCells.size} 个时间段 (本页 ${getCurrentPageSelectionCount()} 个)`
                )}
              </span>
            )}
          </div>

          {multiSelectMode && selectedCells.size > 0 && !moveMode && (
            <Button
              type="primary"
              size="small"
              onClick={openBatchScheduleModal}
            >
              批量排课
            </Button>
          )}
        </div>
      )}



      <div className="compact-timetable-container" ref={tableRef}>
        <Table
          columns={generateColumns()}
          dataSource={tableDataSource}
          pagination={false}
          loading={loading}
          size="small"
          bordered
          className="compact-timetable"
        />
      </div>

      {!timetable?.isWeekly && totalWeeks > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem', gap: '1rem' }}>
          <Button
            type="text"
            onClick={() => currentWeek > 1 && handleWeekChange(currentWeek - 1)}
            disabled={currentWeek <= 1}
            icon={<LeftOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
            第 {currentWeek} 周 / 共 {totalWeeks} 周
          </Tag>
          <Button
            type="text"
            onClick={() => currentWeek < totalWeeks && handleWeekChange(currentWeek + 1)}
            disabled={currentWeek >= totalWeeks}
            icon={<RightOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      )}

      <Modal
        title={
          <span>
            <span style={{ color: studentTextColorMap.get(exportingStudentName) || '#000' }}>
              {exportingStudentName}
            </span>
            的课程安排
          </span>
        }
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        width={350}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} type="primary" onClick={() => copyToClipboard(exportContent)}>
            复制
          </Button>,
          <Button key="close" onClick={() => setExportModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>{exportContent}</pre>
      </Modal>

      {editingSchedule && (
        <EditScheduleModal
          visible={editModalVisible}
          schedule={editingSchedule}
          timetable={timetable}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSchedule(null);
          }}
          onOk={(data) => {
            // 新增全量编辑的保存逻辑
            if (editingSchedule) {
              handleSaveStudentName({ ...editingSchedule, ...data }, data.studentName);
            }
          }}
        />
      )}

      {/* 批量排课模态框 */}
      <Modal
        title="批量排课"
        open={batchScheduleModalVisible}
        onOk={handleBatchSchedule}
        onCancel={cancelBatchSchedule}
        okText="确认排课"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: '16px' }}>
          <p style={{ marginBottom: '8px', color: '#666' }}>
            将为以下 {selectedCells.size} 个时间段批量排课：
          </p>
          <div style={{
            maxHeight: '120px',
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
                         {Array.from(selectedCells).map(cellKey => {
               // 解析cellKey格式
               const parts = cellKey.split('-');
               let dayKey, timeIndex, weekNum, displayText;

               if (timetable?.isWeekly) {
                 // 周固定课表：weekly-dayKey-timeIndex
                 [, dayKey, timeIndex] = parts;
                 const dayLabel = weekDays.find(day => day.key === dayKey)?.label;
                 const timeSlot = timeSlots[parseInt(timeIndex)];
                 displayText = `${dayLabel} ${timeSlot}`;
               } else {
                 // 日期范围课表：week-weekNum-dayKey-timeIndex
                 [, weekNum, dayKey, timeIndex] = parts;
                 const dayLabel = weekDays.find(day => day.key === dayKey)?.label;
                 const timeSlot = timeSlots[parseInt(timeIndex)];
                 displayText = `第${weekNum}周 ${dayLabel} ${timeSlot}`;
               }

               return (
                 <div key={cellKey} style={{ marginBottom: '4px' }}>
                   {displayText}
                 </div>
               );
             })}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            学生姓名：
          </label>
          <Input
            value={batchStudentName}
            onChange={(e) => setBatchStudentName(e.target.value)}
            placeholder="请输入学生姓名"
            onPressEnter={handleBatchSchedule}
          />
        </div>
      </Modal>

      <Modal
        title={
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
              {timetable?.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
              {timetableOwner?.nickname || timetableOwner?.username || '未知用户'} · {dayScheduleTitle?.split(' - ')[1] || dayScheduleTitle}
            </div>
          </div>
        }
        open={dayScheduleModalVisible}
        onCancel={() => setDayScheduleModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={() => copyToClipboard(generateCopyTextForDay(daySchedulesForCopy, currentDayDate, currentDayLabel))}>
            复制课程
          </Button>,
          <Button key="close" onClick={() => setDayScheduleModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={400}
      >
        <Table
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: '40%', align: 'center' },
            {
              title: '学员',
              dataIndex: 'studentName',
              key: 'studentName',
              width: '60%',
              align: 'center',
              onCell: (record) => ({
                style: {
                  backgroundColor: record.studentName ? studentColorMap.get(record.studentName) : 'transparent',
                }
              }),
              render: (text) => text,
            },
          ]}
          dataSource={dayScheduleData}
          pagination={false}
          size="small"
          bordered
        />
      </Modal>


    </div>
  );
};

export default ViewTimetable;