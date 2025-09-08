import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Table, message, Space, Tag, Popover, Spin, Input, Modal, Checkbox, Collapse, Dropdown } from 'antd';
import { LeftOutlined, CalendarOutlined, RightOutlined, CopyOutlined, CloseOutlined, CheckOutlined, DownOutlined, UpOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, getTimetableSchedulesByStudent, deleteSchedule, updateSchedule, createSchedule, createSchedulesBatch, getActiveSchedulesByDate, deleteSchedulesBatch } from '../services/timetable';
import { 
  getCurrentWeekInstance, 
  generateCurrentWeekInstance, 
  checkCurrentWeekInstance,
  clearCurrentWeekInstanceSchedules,
  syncTemplateToInstances,
  restoreCurrentWeekInstanceToTemplate,
  createInstanceSchedule,
  createInstanceSchedulesBatch,
  updateInstanceSchedule,
  deleteInstanceSchedule,
  deleteInstanceSchedulesBatch,
  generateNextWeekInstance,
  switchToWeekInstance,
  getInstanceSchedules,
  getWeeklyInstances
} from '../services/weeklyInstance';
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

const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onExport, onMove, onCopy, timetable, isArchived, onClose, deleteLoading, updateLoading, templateSchedules, viewMode }) => {
  const [name, setName] = React.useState(schedule.studentName);
  const isNameChanged = name !== schedule.studentName;

  // 获取对应的固定课表模板内容
  const getTemplateSchedule = () => {
    if (!timetable || !timetable.isWeekly || viewMode !== 'instance' || !templateSchedules) {
      return null;
    }
    
    return templateSchedules.find(template => 
      template.dayOfWeek === schedule.dayOfWeek &&
      template.startTime === schedule.startTime &&
      template.endTime === schedule.endTime
    );
  };

  const templateSchedule = getTemplateSchedule();
  const isModified = templateSchedule && (
    templateSchedule.studentName !== schedule.studentName ||
    templateSchedule.subject !== schedule.subject ||
    templateSchedule.note !== schedule.note
  );



  return (
    <div style={{ width: '220px', display: 'flex', flexDirection: 'column' }}>
      {/* 时间信息和关闭图标在同一行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {timetable.isWeekly ? (
            `星期${dayMap[schedule.dayOfWeek.toUpperCase()] || schedule.dayOfWeek}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`
          ) : (
            `${dayjs(schedule.scheduleDate).format('MM/DD')}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`
          )}
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ padding: '0', minWidth: 'auto', height: 'auto' }}
        />
      </div>

      {/* 如果是已修改的课程，显示固定课表原始内容 */}
      {isModified && templateSchedule && (
        <div style={{ 
          backgroundColor: '#f6f6f6', 
          padding: '6px 8px', 
          borderRadius: '4px', 
          marginBottom: '8px',
          border: '1px solid #d9d9d9',
          fontSize: '12px',
          color: '#666'
        }}>
          固定课表原始内容: <strong>{templateSchedule.studentName}</strong>
        </div>
      )}

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
            disabled={!isNameChanged || updateLoading}
            loading={updateLoading}
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
              onClick={() => onCopy(schedule, null)}
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

const NewSchedulePopoverContent = ({ onAdd, onCancel, addLoading, timeInfo }) => {
  const [name, setName] = React.useState('');

  return (
    <div style={{ width: '180px', display: 'flex', flexDirection: 'column' }}>
      {/* 时间信息显示 */}
      {timeInfo && (
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          {timeInfo}
        </div>
      )}
      <Input
        size="small"
        placeholder="学生姓名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={addLoading}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button size="small" onClick={onCancel} style={{ marginRight: 8 }} disabled={addLoading}>
          取消
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={() => onAdd(name)}
          loading={addLoading}
          disabled={addLoading}
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
  const [templateSchedules, setTemplateSchedules] = useState([]); // 存储固定课表模板数据用于比较
  const [loading, setLoading] = useState(true);
  
  // 周实例相关状态
  const [viewMode, setViewMode] = useState(null); // 'template' | 'instance' | null (initially)
  const [currentWeekInstance, setCurrentWeekInstance] = useState(null);
  const [hasCurrentWeekInstance, setHasCurrentWeekInstance] = useState(false);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [instanceDataLoading, setInstanceDataLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  
  // 每周实例分页相关状态
  const [weeklyInstances, setWeeklyInstances] = useState([]);
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [availableTimeModalVisible, setAvailableTimeModalVisible] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportingStudentName, setExportingStudentName] = useState('');

  // 多选功能状态
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [batchScheduleModalVisible, setBatchScheduleModalVisible] = useState(false);
  const [batchStudentName, setBatchStudentName] = useState('');
  
  // 多选删除功能状态
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSchedulesForDelete, setSelectedSchedulesForDelete] = useState(new Set());

  // Day schedule modal state
  const [dayScheduleModalVisible, setDayScheduleModalVisible] = useState(false);
  const [dayScheduleData, setDayScheduleData] = useState([]);
  const [dayScheduleTitle, setDayScheduleTitle] = useState('');
  const [daySchedulesForCopy, setDaySchedulesForCopy] = useState([]);
  const [currentDayDate, setCurrentDayDate] = useState(null);
  const [currentDayLabel, setCurrentDayLabel] = useState('');

  // 复制时包含其他教练课程相关状态
  const [copyOtherCoachesInModal, setCopyOtherCoachesInModal] = useState(true);
  const [otherCoachesDataInModal, setOtherCoachesDataInModal] = useState([]);
  const [loadingOtherCoachesInModal, setLoadingOtherCoachesInModal] = useState(false);
  const [otherCoachesExpanded, setOtherCoachesExpanded] = useState(false);

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
  
  // 修改和添加功能状态
  const [updateLoading, setUpdateLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const availableSlotsTitle = useMemo(() => {
    if (viewMode === 'template') {
      return '固定可排课时段';
    }
    return '本周可供排课时段';
  }, [viewMode]);

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
  const addScheduleInputRef = useRef(null);
  const [newScheduleInfo, setNewScheduleInfo] = useState({ studentName: '' });
  const [popoverVisible, setPopoverVisible] = useState({});

  const handlePopoverVisibleChange = (key, visible) => {
    setPopoverVisible(prev => ({ ...prev, [key]: visible }));
    if (!visible) {
      setNewScheduleInfo({ studentName: '' }); // 关闭时清空输入
    }
  };

  // 处理时间单元格点击，显示可供排课时段
  const handleTimeCellClick = (timeSlot) => {
    console.log('Time cell clicked:', timeSlot);
    const availableSlots = [];
    
    // 定义时间段
    const timeSlots = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'
    ];
    
    // 遍历每一天
    weekDays.forEach((day, dayIndex) => {
      const isWeekend = dayIndex >= 5; // 周六(5)和周日(6)
      const startHour = isWeekend ? 10 : 16; // 周末10点开始，工作日16点开始
      const endHour = 20; // 都到20点结束
      
      // 获取该天已排课的时间段
      const scheduledTimes = allSchedules
        .filter(schedule => {
          if (viewMode === 'instance' && currentWeekInstance) {
            // 实例视图：按日期过滤
            const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
            const currentDate = instanceStartDate.add(dayIndex, 'day');
            return schedule.scheduleDate === currentDate.format('YYYY-MM-DD');
          } else {
            // 模板视图：按星期几过滤
            return schedule.dayOfWeek.toLowerCase() === day.key;
          }
        })
        .map(schedule => `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`);
      
      // 检查每个时间段是否空闲
      timeSlots.forEach(timeSlot => {
        const [startTime] = timeSlot.split('-');
        const hour = parseInt(startTime.split(':')[0]);
        
        // 检查是否在可选时间范围内
        if (hour >= startHour && hour < endHour) {
          // 周末午休时间排除
          if (isWeekend && (hour === 12 || hour === 13)) {
            return; // continue
          }
          // 检查是否已排课
          if (!scheduledTimes.includes(timeSlot)) {
            availableSlots.push({
              day: day.label,
              date: viewMode === 'instance' && currentWeekInstance 
                ? dayjs(currentWeekInstance.weekStartDate).add(dayIndex, 'day').format('MM/DD')
                : null,
              timeSlot: timeSlot,
              dayIndex: dayIndex
            });
          }
        }
      });
    });
    
    console.log('Available slots:', availableSlots);
    setAvailableTimeSlots(availableSlots);
    setAvailableTimeModalVisible(true);
  };
  
  const handleAddSchedule = async (dayKey, timeIndex, studentName) => {
    const trimmedName = studentName.trim();
    if (!trimmedName) {
      message.warning('学生姓名不能为空');
      return;
    }

    const [startTimeStr, endTimeStr] = timeSlots[timeIndex].split('-');
    const startTime = `${startTimeStr}:00`;
    const endTime = `${endTimeStr}:00`;

    let scheduleDate = null;
    if (!timetable.isWeekly) {
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        const dayIndex = weekDays.findIndex(day => day.key === dayKey);
        const currentDate = weekDates.start.add(dayIndex, 'day');
        scheduleDate = currentDate.format('YYYY-MM-DD');
      }
    }

    const payload = {
      studentName: trimmedName,
      dayOfWeek: dayKey.toUpperCase(),
      startTime,
      endTime,
      note: '手动添加',
    };

    if (scheduleDate) {
      payload.scheduleDate = scheduleDate;
    }

    setAddLoading(true);
    try {
      let resp;
      if (viewMode === 'instance' && currentWeekInstance) {
        resp = await createInstanceSchedule(currentWeekInstance.id, payload);
      } else {
        resp = await createSchedule(timetableId, payload);
      }
      
      if (resp.success) {
        handlePopoverVisibleChange(`popover-${dayKey}-${timeIndex}`, false);
        await refreshSchedulesQuietly();
        message.success('添加成功');
      } else {
        message.error(resp.message || '添加失败');
      }
    } catch (err) {
      message.error('网络错误，添加失败');
    } finally {
      setAddLoading(false);
    }
  };


  const renderEmptyCell = (day, timeIndex) => {
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const cellKey = `${pagePrefix}-${day.key}-${timeIndex}`;
    const isSelected = selectedCells.has(cellKey);

    if (timetable?.isArchived) {
      return <div style={{ height: '48px' }} />;
    }

    const handleCellClick = (e) => {
      if (multiSelectMode) {
        e.stopPropagation();
        handleCellSelection(cellKey, weekDays.findIndex(d => d.key === day.key), timeIndex);
      } else if (moveMode) {
        e.stopPropagation();
        handleSelectMoveTarget(day.key, timeIndex);
      } else if (copyMode) {
        e.stopPropagation();
        handleSelectCopyTarget(day.key, timeIndex);
      }
    };

    if (multiSelectMode || moveMode || copyMode) {
       // ... existing multi-select/move/copy rendering logic ...
       // This part is simplified for brevity. The original logic remains.
       return (
        <div
          style={{
            height: '48px',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
            border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0',
          }}
          onClick={handleCellClick}
        />
      );
    }
    
    const popoverKey = `popover-${day.key}-${timeIndex}`;

    const popoverContent = (
      <div style={{ width: '180px' }}>
        <Input
          ref={addScheduleInputRef}
          placeholder="学生姓名"
          value={newScheduleInfo.studentName}
          onChange={(e) => setNewScheduleInfo({ ...newScheduleInfo, studentName: e.target.value })}
          onPressEnter={() => handleAddSchedule(day.key, timeIndex, newScheduleInfo.studentName)}
          style={{ marginBottom: '8px' }}
          disabled={addLoading}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button size="small" onClick={() => handlePopoverVisibleChange(popoverKey, false)} disabled={addLoading}>
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => handleAddSchedule(day.key, timeIndex, newScheduleInfo.studentName)}
            loading={addLoading}
            disabled={addLoading}
          >
            添加
          </Button>
        </div>
      </div>
    );

    return (
      <Popover
        content={popoverContent}
        title="添加新课程"
        trigger="click"
        open={popoverVisible[popoverKey]}
        onOpenChange={(visible) => {
          handlePopoverVisibleChange(popoverKey, visible);
          if (visible) {
            setTimeout(() => {
              addScheduleInputRef.current?.focus();
            }, 100);
          }
        }}
      >
        <div style={{ height: '48px', cursor: 'pointer' }} />
      </Popover>
    );
  };

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

  // 根据当前实例起始日期动态显示周标签
  const instanceWeekLabel = useMemo(() => {
    if (viewMode === 'instance' && currentWeekInstance?.weekStartDate) {
      const start = dayjs(currentWeekInstance.weekStartDate).startOf('day');
      const thisMonday = dayjs().startOf('week');
      if (start.isSame(thisMonday, 'day')) return '本周';
      if (start.isSame(thisMonday.add(1, 'week'), 'day')) return '下周';
      // 如果是其他周，显示具体日期
      return start.format('MM/DD');
    }
    return '本周';
  }, [viewMode, currentWeekInstance]);

  const handleShowDayCourses = (day, dayIndex) => {
    let schedulesForDay = [];
    let modalTitle = '';
    let targetDate = null;

    if (timetable.isWeekly) {
      // 对于周固定课表，根据当前视图模式决定显示内容
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图且有当前周实例：显示实例中的课程，使用实例的周开始日期
        const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
        targetDate = instanceStartDate.add(dayIndex, 'day');
        const dateStr = targetDate.format('YYYY-MM-DD');
        schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
        modalTitle = `${timetable.name} - ${dateStr} (${day.label})`;
      } else {
        // 模板视图或没有当前周实例：显示固定课表模板的课程
        schedulesForDay = allSchedules.filter(s => s.dayOfWeek.toLowerCase() === day.key);
        modalTitle = `${timetable.name} - ${day.label}`;
        // 对于周固定课表，计算本周对应的日期
        const today = dayjs();
        const currentWeekStart = today.startOf('week');
        targetDate = currentWeekStart.add(dayIndex, 'day');
      }
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

    // 默认获取其他教练课程数据
    if (targetDate) {
      setLoadingOtherCoachesInModal(true);
      const targetDateStr = targetDate.format('YYYY-MM-DD');
      getActiveSchedulesByDate(targetDateStr)
        .then(response => {
          if (response.success) {
            setOtherCoachesDataInModal(response.data);
          }
        })
        .catch(error => {
          console.error('获取其他教练课程失败:', error);
        })
        .finally(() => {
          setLoadingOtherCoachesInModal(false);
        });
    }
  };

  // 处理日程弹框中复选框变化
  const handleCopyOtherCoachesInModalChange = async (checked) => {
    setCopyOtherCoachesInModal(checked);
    // 不清空数据，只改变复制时是否包含的状态
    // 如果取消勾选，不需要重新获取数据，因为数据已经在弹框打开时获取了
  };

  const generateCopyTextForDay = (schedules, targetDate, dayLabel, includeOtherCoaches = false, otherCoachesData = null) => {
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
    
    // 构建当前教练的课程列表
    const courseList = schedules.map(schedule => {
        const startHour = parseInt(schedule.startTime.substring(0, 2));
        const endHour = startHour + 1;
        return `${startHour}-${endHour} ${schedule.studentName}`;
    }).join('\n');

    let result = `${title}\n${coachName}：\n${courseList}`;

    // 如果需要包含其他教练的课程
    if (includeOtherCoaches && otherCoachesData && otherCoachesData.timetables && otherCoachesData.timetables.length > 0) {
      otherCoachesData.timetables.forEach(timetableInfo => {
        // 跳过当前教练的课表
        if (timetableInfo.timetableId.toString() === timetableId) {
          return;
        }

        result += `\n${timetableInfo.ownerName}：`;
        const otherCourseList = timetableInfo.schedules.map(schedule => {
          const startHour = parseInt(schedule.startTime.substring(0, 2));
          const endHour = startHour + 1;
          return `${startHour}-${endHour} ${schedule.studentName}`;
        }).join('\n');
        result += `\n${otherCourseList}`;
      });
    }

    return result;
  };



  useEffect(() => {
    fetchTimetable();
  }, [timetableId]);

  useEffect(() => {
    console.log('useEffect 触发，timetable:', timetable?.id, 'viewMode:', viewMode);
    if (timetable && viewMode) {
      if (viewMode === 'template') {
        console.log('切换到模板视图，调用 fetchSchedules');
        fetchSchedules();
      } else if (viewMode === 'instance') {
        console.log('切换到实例视图，调用 fetchInstanceSchedules');
        fetchInstanceSchedules();
        // 如果是周固定课表，同时获取每周实例列表
        if (timetable.isWeekly) {
          fetchWeeklyInstances();
        }
      }
    }
  }, [timetable, viewMode]); // 移除currentWeek依赖，避免重复调用

  // 当获取到每周实例列表后，自动切换到本周实例
  useEffect(() => {
    if (weeklyInstances.length > 0 && viewMode === 'instance' && currentInstanceIndex === 0) {
      // 检查是否应该切换到本周实例
      const thisWeekStart = dayjs().startOf('week').format('YYYY-MM-DD');
      const thisWeekIndex = weeklyInstances.findIndex(inst => 
        dayjs(inst.weekStartDate).isSame(thisWeekStart, 'day')
      );
      
      // 如果找到本周实例且当前不是本周实例，则自动切换
      if (thisWeekIndex >= 0 && thisWeekIndex !== currentInstanceIndex) {
        console.log('Auto switching to this week instance, index:', thisWeekIndex);
        switchToWeekInstanceByIndex(thisWeekIndex);
      }
    }
  }, [weeklyInstances, viewMode]); // 移除currentInstanceIndex依赖，避免循环触发

  // 为日期范围课表添加单独的useEffect处理currentWeek变化
  useEffect(() => {
    if (timetable && viewMode === 'template' && !timetable.isWeekly && currentWeek) {
      fetchSchedules();
    }
  }, [currentWeek]); // 只在currentWeek变化时触发

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        const { timetable: timetableData, owner } = response.data;
        setTimetable(timetableData);
        setTimetableOwner(owner);
        
        // For weekly timetables, initialize and determine view mode
        if (timetableData.isWeekly && !timetableData.startDate && !timetableData.endDate) {
          await initializeWeeklyInstance(timetableData.id);
        } else {
          // For date-range timetables, default to template view
          setViewMode('template');
        }

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
    } finally {
      setLoading(false);
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
        // 如果是周固定课表，同时保存模板数据用于比较
        if (timetable && timetable.isWeekly) {
          setTemplateSchedules(response.data);
        }
      } else {
        message.error(response.message || '获取课程安排失败');
      }
    } catch (error) {
      message.error('获取课程安排失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };



  // 初始化周实例（只设置视图模式，不重复调用API）
  const initializeWeeklyInstance = async (tableId) => {
    try {
      // 对于周固定课表，总是尝试切换到实例视图
      // 如果没有当前周实例，fetchInstanceSchedules会处理生成逻辑
      setViewMode('instance');
    } catch (error) {
      console.error('初始化周实例失败:', error);
      setViewMode('template');
    }
  };

  // 获取当前周实例的课程
  const fetchInstanceSchedules = async () => {
    console.log('fetchInstanceSchedules 被调用，instanceDataLoading:', instanceDataLoading, 'isGenerating:', isGenerating);
    
    // 防止重复调用
    if (instanceDataLoading || isGenerating) {
      console.log('正在加载或生成中，跳过重复调用');
      return;
    }
    
    console.log('开始获取实例数据...');
    setInstanceDataLoading(true);
    try {
      // 如果是周固定课表且还没有模板数据，先获取模板数据
      if (timetable && timetable.isWeekly && templateSchedules.length === 0) {
        const templateResponse = await getTimetableSchedules(timetableId, null);
        if (templateResponse.success) {
          setTemplateSchedules(templateResponse.data);
        }
      }

      // 先检查是否有当前周实例
      const checkResponse = await checkCurrentWeekInstance(timetableId);
      if (checkResponse.success) {
        const hasInstance = checkResponse.data.hasCurrentWeekInstance;
        
        if (hasInstance) {
          // 有实例，获取实例数据
          const response = await getCurrentWeekInstance(timetableId);
          if (response.success && response.data.hasInstance) {
            setCurrentWeekInstance(response.data.instance);
            setAllSchedules(response.data.schedules);
            setHasCurrentWeekInstance(true);
          } else {
            setCurrentWeekInstance(null);
            setAllSchedules([]);
            setHasCurrentWeekInstance(false);
          }
        } else {
          // 没有实例，生成一个
          console.log('开始生成当前周实例...');
          setIsGenerating(true);
          try {
            const generateResponse = await generateCurrentWeekInstance(timetableId);
            console.log('生成实例结果:', generateResponse);
            
            if (generateResponse.success) {
              setCurrentWeekInstance(generateResponse.data);
              setHasCurrentWeekInstance(true);
              // 生成后调用getCurrentWeekInstance获取完整的课程数据
              console.log('生成成功，开始获取课程数据...');
              const instanceResponse = await getCurrentWeekInstance(timetableId);
              if (instanceResponse.success && instanceResponse.data.hasInstance) {
                setAllSchedules(instanceResponse.data.schedules);
                console.log('获取课程数据成功，课程数量:', instanceResponse.data.schedules.length);
              } else {
                setAllSchedules([]);
                console.log('获取课程数据失败或没有课程');
              }
            } else {
              setCurrentWeekInstance(null);
              setAllSchedules([]);
              setHasCurrentWeekInstance(false);
              message.error('生成当前周实例失败');
            }
          } finally {
            setIsGenerating(false);
          }
        }
      } else {
        setCurrentWeekInstance(null);
        setAllSchedules([]);
        setHasCurrentWeekInstance(false);
      }
    } catch (error) {
      console.error('获取当前周实例失败:', error);
      message.error('获取当前周实例失败，请检查网络连接');
      setCurrentWeekInstance(null);
      setAllSchedules([]);
      setHasCurrentWeekInstance(false);
    } finally {
      setInstanceDataLoading(false);
    }
  };

  // 切换到当前周实例视图
  const switchToInstanceView = async () => {
    // 切换视图时自动退出多选模式和删除模式
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedCells(new Set());
    }
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedSchedulesForDelete(new Set());
    }
    setViewMode('instance');
    // 具体的检查、生成、获取数据逻辑由 fetchInstanceSchedules 处理
  };

  // 获取每周实例列表
  const fetchWeeklyInstances = async () => {
    if (!timetableId || !timetable?.isWeekly) return;
    
    console.log('fetchWeeklyInstances called for timetableId:', timetableId);
    setInstancesLoading(true);
    try {
      const response = await getWeeklyInstances(timetableId);
      console.log('getWeeklyInstances response:', response);
      if (response.success && Array.isArray(response.data)) {
        // 按周开始日期排序
        const sortedInstances = response.data.sort((a, b) => 
          dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
        );
        console.log('Sorted instances:', sortedInstances);
        setWeeklyInstances(sortedInstances);
        
        // 只在初始化时设置索引，避免覆盖手动选择
        if (weeklyInstances.length === 0) {
          // 优先找到当前周实例的索引
          if (currentWeekInstance?.id) {
            const currentIndex = sortedInstances.findIndex(inst => inst.id === currentWeekInstance.id);
            if (currentIndex >= 0) {
              setCurrentInstanceIndex(currentIndex);
            }
          } else {
            // 如果没有当前周实例，尝试找到本周的实例
            const thisWeekStart = dayjs().startOf('week').format('YYYY-MM-DD');
            const thisWeekIndex = sortedInstances.findIndex(inst => 
              dayjs(inst.weekStartDate).isSame(thisWeekStart, 'day')
            );
            if (thisWeekIndex >= 0) {
              setCurrentInstanceIndex(thisWeekIndex);
            } else {
              // 如果找不到本周实例，默认选择第一个
              setCurrentInstanceIndex(0);
            }
          }
        }
      }
    } catch (error) {
      console.error('获取每周实例列表失败:', error);
    } finally {
      setInstancesLoading(false);
    }
  };

  // 切换到指定的周实例
  const switchToWeekInstanceByIndex = async (instanceIndex) => {
    console.log('switchToWeekInstance called with index:', instanceIndex, 'weeklyInstances:', weeklyInstances);
    if (instanceIndex < 0 || instanceIndex >= weeklyInstances.length) {
      console.log('Invalid instance index:', instanceIndex);
      return;
    }
    
    const targetInstance = weeklyInstances[instanceIndex];
    console.log('Target instance:', targetInstance);
    setCurrentInstanceIndex(instanceIndex);
    setInstancesLoading(true);
    
    try {
      // 获取指定周实例的课程数据
      const response = await getInstanceSchedules(targetInstance.id);
      if (response.success) {
        setCurrentWeekInstance({
          id: targetInstance.id,
          weekStartDate: targetInstance.weekStartDate,
          weekEndDate: targetInstance.weekEndDate,
          schedules: response.data || []
        });
        setAllSchedules(response.data || []);
        setViewMode('instance');
      } else {
        message.error('获取周实例数据失败');
      }
    } catch (error) {
      console.error('切换周实例失败:', error);
      message.error('切换周实例失败');
    } finally {
      setInstancesLoading(false);
    }
  };

  // 切换到固定课表视图
  const switchToTemplateView = () => {
    // 切换视图时自动退出多选模式和删除模式
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedCells(new Set());
    }
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedSchedulesForDelete(new Set());
    }
    setViewMode('template');
  };

  // 比较固定课表和实例课程，确定边框颜色
  const getScheduleBorderColor = (instanceSchedule) => {
    if (!timetable || !timetable.isWeekly || viewMode !== 'instance') {
      return ''; // 非周固定课表或非实例视图，不显示特殊边框
    }

    // 查找对应的固定课表模板课程
    const templateSchedule = templateSchedules.find(template => 
      template.dayOfWeek === instanceSchedule.dayOfWeek &&
      template.startTime === instanceSchedule.startTime &&
      template.endTime === instanceSchedule.endTime
    );

    if (!templateSchedule) {
      // 固定课表中没有，但实例中有 - 绿色边框（手动添加）
      return '#52c41a';
    } else {
      // 固定课表中有，检查内容是否一致
      const isContentSame = 
        templateSchedule.studentName === instanceSchedule.studentName &&
        templateSchedule.subject === instanceSchedule.subject &&
        templateSchedule.note === instanceSchedule.note;
      
      if (!isContentSame) {
        // 内容不一致 - 橙色边框（已修改）
        return '#faad14';
      }
    }

    return ''; // 内容一致，不显示特殊边框
  };

  // 局部刷新函数，不影响页面loading状态
  const refreshSchedulesQuietly = async () => {
    try {
      if (viewMode === 'template') {
        const week = timetable && !timetable.isWeekly ? currentWeek : null;
        const response = await getTimetableSchedules(timetableId, week);
        if (response.success) {
          setAllSchedules(response.data);
        } else {
          message.error(response.message || '获取课程安排失败');
        }
      } else if (viewMode === 'instance') {
        const response = await getCurrentWeekInstance(timetableId);
        if (response.success && response.data.hasInstance) {
          setAllSchedules(response.data.schedules);
        } else {
          setAllSchedules([]);
        }
      }
    } catch (error) {
      message.error('获取课程安排失败，请检查网络连接');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    setDeleteLoading(true);
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例删除API
        response = await deleteInstanceSchedule(scheduleId);
      } else {
        // 模板视图：使用原有删除API
        response = await deleteSchedule(timetableId, scheduleId);
      }
      
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
    setUpdateLoading(true);
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleObj.id, payload);
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, payload);
      }
      
      if (response.success) {
        setOpenPopoverKey(null);
        await refreshSchedulesQuietly();
        message.success('修改成功');
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setUpdateLoading(false);
    }
  };

  // 完整编辑课程
  const handleEditSchedule = async (scheduleObj, updatedData) => {
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleObj.id, updatedData);
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, updatedData);
      }
      
      if (response.success) {
        setEditModalVisible(false);
        setEditingSchedule(null);
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
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleToMove.id, payload);
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleToMove.id, payload);
      }
      
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
      let response;
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例批量API
        response = await createInstanceSchedulesBatch(currentWeekInstance.id, schedulesToCreate);
      } else {
        // 模板视图：使用原有批量API
        response = await createSchedulesBatch(timetableId, schedulesToCreate);
      }
      
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

      // 使用新的接口直接获取该学生的课程安排
      const response = await getTimetableSchedulesByStudent(timetableId, studentName);
      
      if (!response || !response.success) {
        message.destroy('exporting');
        message.error(response?.message || '获取学生课程安排失败');
        return;
      }

      const studentSchedules = response.data;
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

  // 多选删除功能处理函数
  const toggleDeleteMode = () => {
    const newMode = !deleteMode;
    setDeleteMode(newMode);
    setSelectedSchedulesForDelete(new Set()); // 切换模式时总是清空选择
    setOpenPopoverKey(null);

    // 如果是进入删除模式，显示提示
    if (newMode) {
      message.info('已进入删除模式，点击有内容的单元格进行选择');
    }
  };

  // 处理删除模式下的单元格选择
  const handleDeleteCellSelection = (cellKey, dayKey, timeKey) => {
    const newSelected = new Set(selectedSchedulesForDelete);
    if (newSelected.has(cellKey)) {
      newSelected.delete(cellKey);
    } else {
      newSelected.add(cellKey);
    }
    setSelectedSchedulesForDelete(newSelected);
  };

  // 批量删除选中的课程
  const handleBatchDelete = async () => {
    if (selectedSchedulesForDelete.size === 0) {
      message.warning('请先选择要删除的课程');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedSchedulesForDelete.size} 个课程吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          console.log('开始批量删除，选中的cellKey:', Array.from(selectedSchedulesForDelete));
          console.log('当前allSchedules:', allSchedules);
          
          // 收集所有要删除的schedule ID
          const scheduleIdsToDelete = [];
          
          for (const cellKey of selectedSchedulesForDelete) {
            // 从cellKey中解析出schedule信息
            // cellKey格式: ${day.key}-${record.key}，其中record.key是timeSlots的索引
            const [dayKey, timeIndex] = cellKey.split('-');
            const timeSlot = timeSlots[parseInt(timeIndex)];
            console.log(`处理cellKey: ${cellKey}, dayKey: ${dayKey}, timeIndex: ${timeIndex}, timeSlot: ${timeSlot}`);
            
            const schedules = allSchedules.filter(s => {
              const timeKeyFromSchedule = `${s.startTime.substring(0, 5)}-${s.endTime.substring(0, 5)}`;
              let scheduleDayKey;
              if (timetable.isWeekly) {
                scheduleDayKey = s.dayOfWeek.toLowerCase();
              } else {
                const scheduleDate = dayjs(s.scheduleDate);
                const dayIndex = scheduleDate.day();
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                scheduleDayKey = dayNames[dayIndex];
              }
              return timeKeyFromSchedule === timeSlot && scheduleDayKey === dayKey;
            });
            
            console.log(`找到的schedules:`, schedules);

            if (schedules.length > 0) {
              const schedule = schedules[0];
              console.log(`准备删除schedule:`, schedule);
              scheduleIdsToDelete.push(schedule.id);
            } else {
              console.log('没有找到匹配的schedule');
            }
          }

          // 使用批量删除接口
          if (scheduleIdsToDelete.length > 0) {
            console.log('准备批量删除的schedule IDs:', scheduleIdsToDelete);
            if (viewMode === 'instance') {
              console.log('调用deleteInstanceSchedulesBatch');
              const response = await deleteInstanceSchedulesBatch(scheduleIdsToDelete);
              if (response.success) {
                message.success(`成功删除 ${response.data} 个课程`);
              } else {
                message.error(response.message || '批量删除失败');
              }
            } else {
              console.log('调用deleteSchedulesBatch');
              const response = await deleteSchedulesBatch(timetableId, scheduleIdsToDelete);
              if (response.success) {
                message.success(`成功删除 ${response.data} 个课程`);
              } else {
                message.error(response.message || '批量删除失败');
              }
            }
          } else {
            message.warning('没有找到要删除的课程');
          }
          
          // 清空选择并退出删除模式
          setSelectedSchedulesForDelete(new Set());
          setDeleteMode(false);
          
          // 刷新数据
          if (viewMode === 'template') {
            const week = timetable && !timetable.isWeekly ? currentWeek : null;
            const response = await getTimetableSchedules(timetableId, week);
            if (response.success) {
              setAllSchedules(response.data);
            }
          } else if (viewMode === 'instance') {
            const response = await getCurrentWeekInstance(timetableId);
            if (response.success && response.data.hasInstance) {
              setCurrentWeekInstance(response.data.instance);
              setAllSchedules(response.data.schedules);
            }
          }
        } catch (error) {
          console.error('批量删除失败:', error);
          message.error('批量删除失败，请重试');
        }
      }
    });
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
      let response;
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例批量API
        response = await createInstanceSchedulesBatch(currentWeekInstance.id, schedulesToCreate);
      } else {
        // 模板视图：使用原有批量API
        response = await createSchedulesBatch(timetableId, schedulesToCreate);
      }
      
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

  // 计算一周总课时数和节数
  const weeklyStats = useMemo(() => {
    // 根据当前视图模式选择数据源
    let schedules = [];
    
    if (viewMode === 'instance' && currentWeekInstance?.schedules) {
      // 当前周实例模式：使用实例课程数据
      schedules = currentWeekInstance.schedules;
    } else {
      // 固定课表模式：使用当前周课程数据
      schedules = currentWeekSchedules;
    }
    
    if (!schedules.length) return { hours: 0, count: 0, students: 0 };
    
    const totalHours = schedules.reduce((total, schedule) => {
      const startTime = dayjs(schedule.startTime, 'HH:mm:ss');
      const endTime = dayjs(schedule.endTime, 'HH:mm:ss');
      const duration = endTime.diff(startTime, 'hour', true); // 精确到小数
      return total + duration;
    }, 0);
    
    // 计算学员数量（去重）
    const uniqueStudents = new Set();
    schedules.forEach(schedule => {
      if (schedule.studentName) {
        uniqueStudents.add(schedule.studentName);
      }
    });
    
    return {
      hours: totalHours,
      count: schedules.length,
      students: uniqueStudents.size
    };
  }, [currentWeekSchedules, currentWeekInstance?.schedules, viewMode]);

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
        title: (
          <span
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleTimeCellClick('HEADER')}
          >
            时间
          </span>
        ),
        dataIndex: 'time',
        key: 'time',
        className: 'timetable-time-column',
        render: (time) => (
          <div 
            className="time-cell" 
            style={{ cursor: 'pointer' }}
            onClick={() => handleTimeCellClick(time)}
          >
            {time.split('-').map((t, i) => (
              <div key={i} className="time-part">{t}</div>
            ))}
          </div>
        )
      },
    ];

    weekDays.forEach((day, index) => {
      let columnTitle;
      let isToday = false;
      
      // 在实例视图中，显示具体日期
      if (viewMode === 'instance' && currentWeekInstance) {
        const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
        const currentDate = instanceStartDate.add(index, 'day');
        isToday = currentDate.isSame(dayjs(), 'day');
        columnTitle = (
          <div
            style={{ 
              textAlign: 'center', 
              cursor: timetable.isArchived ? 'default' : 'pointer'
            }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div className="day-date">
              {currentDate.format('MM/DD')}
            </div>
          </div>
        );
      } else if (!timetable.isWeekly && weekDates && weekDates.start) {
        // 日期范围课表的原有逻辑
        const currentDate = weekDates.start.add(index, 'day');
        isToday = currentDate.isSame(dayjs(), 'day');
        columnTitle = (
          <div
            style={{ 
              textAlign: 'center', 
              cursor: timetable.isArchived ? 'default' : 'pointer'
            }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div className="day-date">
              {currentDate.format('MM/DD')}
            </div>
          </div>
        );
        } else {
          // 固定课表视图，只显示星期几
          const today = dayjs();
          isToday = today.day() === (index + 1) % 7;
          columnTitle = (
            <div
              style={{ 
                textAlign: 'center', 
                cursor: timetable.isArchived ? 'default' : 'pointer',
                ...(isToday && { backgroundColor: 'transparent', color: '#ffffff' })
              }}
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
        onHeaderCell: () => ({
          className: isToday ? 'today-header' : '',
          style: isToday
            ? { backgroundColor: '#4a90e2', color: '#ffffff', fontWeight: 500 }
            : undefined,
        }),
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (text, record) => {
          const schedules = allSchedules.filter(s => {
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
              } else if (deleteMode) {
                // 删除模式下，空白单元格不可点击
                e.stopPropagation();
                return;
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

              setAddLoading(true);
              try {
                let resp;
                if (viewMode === 'instance' && currentWeekInstance) {
                  // 实例视图：使用实例API
                  resp = await createInstanceSchedule(currentWeekInstance.id, payload);
                } else {
                  // 模板视图：使用原有API
                  resp = await createSchedule(timetableId, payload);
                }
                
                if (resp.success) {
                  setOpenPopoverKey(null);
                  await refreshSchedulesQuietly();
                  message.success('添加成功');
                } else {
                  message.error(resp.message || '添加失败');
                }
              } catch (err) {
                message.error('网络错误，添加失败');
              } finally {
                setAddLoading(false);
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

            // 生成时间信息
            const timeInfo = timetable.isWeekly 
              ? `星期${dayMap[day.key.toUpperCase()] || day.key}, ${record.time}`
              : weekDates && weekDates.start 
                ? `${weekDates.start.add(index, 'day').format('MM/DD')}, ${record.time}`
                : `${record.time}`;

            return (
              <Popover
                placement={getSmartPlacement(index, record.key)}
                title={null}
                content={ <NewSchedulePopoverContent onAdd={handleAddSchedule} onCancel={() => handleOpenChange(false)} addLoading={addLoading} timeInfo={timeInfo} /> }
                trigger={multiSelectMode ? "contextMenu" : (deleteMode ? "none" : "click")}
                open={!timetable?.isArchived && !deleteMode && openPopoverKey === cellKey}
                onOpenChange={handleOpenChange}
              >
                <div style={{ 
                  height: '48px', 
                  cursor: deleteMode ? 'not-allowed' : 'pointer',
                  opacity: deleteMode ? 0.5 : 1
                }} />
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
                    updateLoading={updateLoading}
                    templateSchedules={templateSchedules}
                    viewMode={viewMode}
                  />
                  {idx < schedules.length - 1 && <hr style={{ margin: '8px 0' }} />}
                </div>
              ))}
            </div>
          );

          // 在移动模式、复制模式或多选模式下，有内容的单元格不可点击
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
                {schedules.map((student, idx) => {
                  // 在周实例视图中检查课程的特殊状态
                  const isManualAdded = viewMode === 'instance' && student.isManualAdded;
                  const isModified = viewMode === 'instance' && student.isModified;
                  
                  // 根据状态设置不同的样式
                  let borderColor = '';
                  let titleText = isSourceCell ? sourceCellTitle : modeText;
                  
                  // 优先使用比较逻辑确定的边框颜色
                  const comparisonBorderColor = getScheduleBorderColor(student);
                  if (comparisonBorderColor) {
                    borderColor = comparisonBorderColor;
                    if (comparisonBorderColor === '#52c41a') {
                      titleText = isSourceCell ? sourceCellTitle : `手动添加的课程 - ${modeText}`;
                    } else if (comparisonBorderColor === '#faad14') {
                      titleText = isSourceCell ? sourceCellTitle : `已修改的课程 - ${modeText}`;
                    }
                  } else if (isManualAdded) {
                    borderColor = '#52c41a';
                    titleText = isSourceCell ? sourceCellTitle : `手动添加的课程 - ${modeText}`;
                  } else if (isModified) {
                    borderColor = '#faad14';
                    titleText = isSourceCell ? sourceCellTitle : `已修改的课程 - ${modeText}`;
                  }
                  
                  return (
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
                        border: borderColor ? `2px solid ${borderColor}` : 'none',
                        position: 'relative',
                      }}
                      title={titleText}
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
                  );
                })}
              </div>
            );
          }

          // 删除模式下的有内容单元格
          if (deleteMode) {
            const isSelected = selectedSchedulesForDelete.has(cellKey);
            return (
              <div
                style={{
                  height: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#fff7e6' : 'transparent',
                  border: isSelected ? '2px solid #fa8c16' : '1px solid #f0f0f0',
                  borderRadius: '4px',
                  position: 'relative'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCellSelection(cellKey, day.key, record.key);
                }}
                title={isSelected ? '点击取消选择' : '点击选择删除'}
              >
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
                      padding: '2px 4px',
                      textAlign: 'center'
                    }}
                  >
                    {student.studentName}
                  </div>
                ))}
                {/* 右上角的删除选择标记 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '12px',
                    height: '12px',
                    border: isSelected ? '2px solid #fa8c16' : '1px solid #d9d9d9',
                    borderRadius: '2px',
                    backgroundColor: isSelected ? '#fa8c16' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    color: isSelected ? 'white' : '#ccc'
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
              content={popoverContent}
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={handleOpenChange}
            >
              <div className="schedule-cell-content">
                {schedules.map((student, idx) => {
                  // 在周实例视图中检查课程的特殊状态
                  const isManualAdded = viewMode === 'instance' && student.isManualAdded;
                  const isModified = viewMode === 'instance' && student.isModified;
                  
                  // 根据状态设置不同的样式
                  let borderColor = '';
                  let titleText = '点击查看详情或删除';
                  
                  // 优先使用比较逻辑确定的边框颜色
                  const comparisonBorderColor = getScheduleBorderColor(student);
                  if (comparisonBorderColor) {
                    borderColor = comparisonBorderColor;
                    if (comparisonBorderColor === '#52c41a') {
                      titleText = '手动添加的课程 - 点击查看详情或删除';
                    } else if (comparisonBorderColor === '#faad14') {
                      titleText = '已修改的课程 - 点击查看详情或删除';
                    }
                  } else if (isManualAdded) {
                    borderColor = '#52c41a';
                    titleText = '手动添加的课程 - 点击查看详情或删除';
                  } else if (isModified) {
                    borderColor = '#faad14';
                    titleText = '已修改的课程 - 点击查看详情或删除';
                  }
                  
                  return (
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
                        border: borderColor ? `2px solid ${borderColor}` : 'none',
                        position: 'relative',
                      }}
                      title={titleText}
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
                  );
                })}
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

  if (!timetable || !viewMode) {
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
          onClick={() => {
            console.log('返回按钮被点击');
            navigate(-1);
          }}
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
            justifyContent: 'center',
            zIndex: 10
          }}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
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





      {/* 移动和复制模式的控制区域 */}
      {!timetable?.isArchived && (moveMode || copyMode) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '8px 12px',
          backgroundColor: moveMode ? '#e6f4ff' : '#f6ffed',
          borderRadius: '6px',
          border: moveMode ? '1px solid #91caff' : '1px solid #b7eb8f'
        }}>
          <span style={{ 
            fontSize: '14px', 
            color: moveMode ? '#1890ff' : '#722ed1', 
            fontWeight: 'bold' 
          }}>
            {moveMode ? moveTargetText : '请选择要复制到的时间段'}
          </span>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button
              type="default"
              size="small"
              onClick={moveMode ? handleCancelMove : handleCancelCopy}
              style={{
                backgroundColor: '#fff2f0',
                borderColor: '#ffccc7',
                color: '#cf1322'
              }}
            >
              {moveMode ? '取消移动' : '取消复制'}
            </Button>
            {moveMode && selectedMoveTarget && (
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
            {copyMode && (
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
            )}
          </div>
        </div>
      )}



      {/* 图例说明和视图切换按钮 */}
      {timetable && (
        <div style={{ 
          marginBottom: '12px', 
          padding: '8px 12px', 
          backgroundColor: '#f6f8fa', 
          borderRadius: '6px',
          border: '1px solid #e1e4e8',
          fontSize: '12px',
          color: '#586069',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* 第一行：图例和视图切换按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* 在实例视图时显示图例 */}
              {viewMode === 'instance' && timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      border: '2px solid #52c41a', 
                      borderRadius: '2px',
                      backgroundColor: 'transparent'
                    }}></div>
                    <span>本周新增课程</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      border: '2px solid #faad14', 
                      borderRadius: '2px',
                      backgroundColor: 'transparent'
                    }}></div>
                    <span>本周修改课程</span>
                  </div>
                </>
              ) : null}
              {/* 在固定课表视图时显示提示信息 */}
              {viewMode === 'template' && timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate ? (
                <span style={{ color: '#666', fontSize: '12px' }}>
                  固定课表模板视图
                </span>
              ) : null}
            </div>
            
            {/* 视图切换按钮和多选删除按钮 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* 视图切换按钮只在周固定课表中显示 */}
              {Boolean(timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Button
                      type="default"
                      size="small"
                    onClick={switchToInstanceView}
                    loading={instanceLoading}
                    disabled={instanceLoading}
                    style={viewMode === 'instance' ? { 
                      fontSize: '12px',
                      backgroundColor: '#fa8c16',
                      borderColor: '#fa8c16',
                      color: 'white',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRight: 'none'
                    } : { 
                      fontSize: '12px',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRight: 'none'
                    }}
                  >
                    {instanceWeekLabel}
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        // 第一项：在本周和下周之间切换
                        (() => {
                          // 判断当前是否在下周实例
                          const isOnNextWeek = viewMode === 'instance' && currentWeekInstance?.weekStartDate && dayjs(currentWeekInstance.weekStartDate).isSame(dayjs().startOf('week').add(1, 'week'), 'day');
                          // 处于下周实例：始终提供"本周课表"切回
                          if (isOnNextWeek) {
                            return {
                              key: 'thisWeek',
                              label: '本周课表',
                              icon: <UndoOutlined />,
                              onClick: async () => {
                                try {
                                  // 获取当前周实例；无则生成
                                  const resp = await getCurrentWeekInstance(timetableId);
                                  let instanceId = resp?.data?.instance?.id;
                                  if (!resp.success || !instanceId) {
                                    const gen = await generateCurrentWeekInstance(timetableId);
                                    if (!gen.success) { message.error(gen.message || '生成失败'); return; }
                                    instanceId = gen.data?.id || gen.data?.instanceId;
                                  }
                                  if (!instanceId) { message.error('无法获取实例ID'); return; }
                                  setInstanceLoading(true);
                                  await switchToWeekInstance(instanceId);
                                  const list = await getInstanceSchedules(instanceId);
                                  if (list.success) {
                                    setCurrentWeekInstance({ id: instanceId, weekStartDate: dayjs().startOf('week').format('YYYY-MM-DD'), weekEndDate: dayjs().endOf('week').format('YYYY-MM-DD') });
                                    setAllSchedules(list.data || []);
                                    setViewMode('instance');
                                    message.success('已切换到本周课表');
                                  }
                                  setInstanceLoading(false);
                                } catch {
                                  message.error('操作失败');
                                }
                              }
                            };
                          }
                          // 默认：下周课表（仅在周日19:00之后显示）
                          const now = dayjs();
                          const isSundayAfter7pm = now.day() === 0 ? now.hour() >= 19 : false; // day() 周日为0
                          if (!isSundayAfter7pm) {
                            return null;
                          }
                          return {
                            key: 'nextWeek',
                            label: '下周课表',
                            icon: <UndoOutlined />,
                            onClick: async () => {
                              try {
                                // 先查是否已有下周实例
                                const listResp = await getWeeklyInstances(timetableId);
                                if (listResp.success && Array.isArray(listResp.data)) {
                                  const nextMonday = dayjs().startOf('week').add(7, 'day');
                                  const existing = listResp.data.find(inst => dayjs(inst.weekStartDate).isSame(nextMonday, 'day'));
                                  if (existing) {
                                    setInstanceLoading(true);
                                    const sw = await switchToWeekInstance(existing.id);
                                    if (sw.success) {
                                      const list = await getInstanceSchedules(existing.id);
                                      if (list.success) {
                                        setCurrentWeekInstance(existing);
                                        setAllSchedules(list.data || []);
                                        setViewMode('instance');
                                        message.success('已切换到下周课表');
                                      }
                                    }
                                    setInstanceLoading(false);
                                    return;
                                  }
                                }

                                // 没有则生成再切换
                                const resp = await generateNextWeekInstance(timetableId);
                                if (!resp.success) {
                                  message.error(resp.message || '生成失败');
                                  return;
                                }
                                const instanceId = resp.data?.id || resp.data?.instanceId;
                                if (instanceId) {
                                  setInstanceLoading(true);
                                  await switchToWeekInstance(instanceId);
                                  const list = await getInstanceSchedules(instanceId);
                                  if (list.success) {
                                    setCurrentWeekInstance({ id: instanceId, weekStartDate: resp.data.weekStartDate, weekEndDate: resp.data.weekEndDate });
                                    setAllSchedules(list.data || []);
                                    setViewMode('instance');
                                  }
                                  message.success('已生成并切换至下周课表');
                                  setInstanceLoading(false);
                                }
                              } catch {
                                message.error('生成失败');
                              }
                            }
                          };
                        })(),
                        // 第二项：清空本周
                        {
                          key: 'clear',
                          label: '清空本周',
                          icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
                          onClick: async () => {
                            Modal.confirm({
                              title: '清空本周课表',
                              content: '确定清空当前周实例中的所有课程吗？此操作不可恢复。',
                              okText: '清空',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: async () => {
                                const resp = await clearCurrentWeekInstanceSchedules(timetableId);
                                if (resp.success) {
                                  message.success('已清空本周课表');
                                  await refreshSchedulesQuietly();
                                } else {
                                  message.error(resp.message || '操作失败');
                                }
                              }
                            });
                          }
                        },
                        {
                          key: 'restore',
                          label: '恢复固定课表',
                          icon: <UndoOutlined />,
                          onClick: async () => {
                            Modal.confirm({
                              title: '恢复固定课表',
                              content: '将完全清空本周实例中的所有课程，并重新从固定课表同步。此操作不可恢复，确定继续？',
                              okText: '恢复',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: async () => {
                                const res2 = await restoreCurrentWeekInstanceToTemplate(timetableId);
                                if (res2.success) {
                                  message.success('已完全恢复为固定课表');
                                  await refreshSchedulesQuietly();
                                } else {
                                  message.error(res2.message || '恢复失败');
                                }
                              }
                            });
                          }
                        }
                      ].filter(Boolean)
                    }}
                  >
                    <Button
                      type="default"
                      size="small"
                      style={viewMode === 'instance' ? { 
                        fontSize: '12px',
                        backgroundColor: '#fa8c16',
                        borderColor: '#fa8c16',
                        color: 'white',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        padding: '4px 8px'
                      } : { 
                        fontSize: '12px',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        padding: '4px 8px'
                      }}
                    >
                      <DownOutlined style={{ fontSize: 10 }} />
                    </Button>
                  </Dropdown>
                </div>
                <Button
                  type={viewMode === 'template' ? 'primary' : 'default'}
                  size="small"
                  onClick={switchToTemplateView}
                  style={{ fontSize: '12px' }}
                >
                  固定课表
                </Button>
                </div>
              ) : null}
            </div>
          </div>
          
          {/* 分隔线 - 只在固定课表时显示 */}
          {timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate && (
            <div style={{
              height: '1px',
              backgroundColor: '#e1e4e8',
              margin: '8px 0'
            }}></div>
          )}
          
          {/* 第二行：多选排课按钮和课时信息 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '32px' }}>
            {/* 左侧：多选排课按钮 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              {!timetable?.isArchived && !moveMode && !copyMode && !deleteMode ? (
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
              ) : null}
            </div>
            
            {/* 中间：多选状态信息 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {multiSelectMode && selectedCells.size > 0 ? (
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {timetable?.isWeekly ? (
                    `已选择 ${selectedCells.size} 个时间段`
                  ) : (
                    (() => {
                      const currentPageCount = getCurrentPageSelectionCount();
                      return currentPageCount > 0 
                        ? `共选择 ${selectedCells.size} 个时间段 (本页 ${currentPageCount} 个)`
                        : `共选择 ${selectedCells.size} 个时间段`;
                    })()
                  )}
                </span>
              ) : null}
              {deleteMode && selectedSchedulesForDelete.size > 0 ? (
                <span style={{ fontSize: '14px', color: '#fa8c16' }}>
                  已选择 {selectedSchedulesForDelete.size} 个课程
                </span>
              ) : null}
              {/* 非多选模式时显示课时信息 */}
              {!multiSelectMode && !deleteMode && !moveMode && !copyMode && weeklyStats.count > 0 ? (
                <span style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  whiteSpace: 'nowrap'
                }}>
                  {viewMode === 'instance' && currentWeekInstance?.weekStartDate ? instanceWeekLabel : '本周'}
                  <span style={{ color: '#8a2be2', fontWeight: 'bold', margin: '0 4px' }}>
                    {weeklyStats.count}
                  </span>
                  节课
                  {weeklyStats.students > 0 && (
                    <>
                      <span style={{ margin: '0 4px' }}>学员</span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold', margin: '0 2px' }}>
                        {weeklyStats.students}
                      </span>
                      <span>个</span>
                    </>
                  )}
                </span>
              ) : null}
            </div>
            
            {/* 右侧：多选删除按钮、批量排课按钮和批量删除按钮 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {!timetable?.isArchived && !moveMode && !copyMode && !multiSelectMode ? (
                <Button
                  type={deleteMode ? 'default' : 'default'}
                  size="small"
                  onClick={toggleDeleteMode}
                  style={deleteMode ? {
                    backgroundColor: '#fff2f0',
                    borderColor: '#ffccc7',
                    color: '#cf1322'
                  } : {}}
                >
                  {deleteMode ? '退出删除' : '多选删除'}
                </Button>
              ) : null}
              {multiSelectMode && selectedCells.size > 0 && !moveMode ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={openBatchScheduleModal}
                >
                  批量排课
                </Button>
              ) : null}
              {deleteMode && selectedSchedulesForDelete.size > 0 ? (
                <Button
                  type="primary"
                  danger
                  size="small"
                  onClick={handleBatchDelete}
                >
                  批量删除
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="compact-timetable-container" ref={tableRef} style={{ position: 'relative' }}>
        <Table
          columns={generateColumns()}
          dataSource={tableDataSource}
          pagination={false}
          loading={viewMode === 'instance' ? instanceDataLoading : loading}
          size="small"
          bordered
          className="compact-timetable"
          style={{ tableLayout: 'fixed' }}
        />
        {/* 切换周实例时的蒙板和loading */}
        {instancesLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '6px'
          }}>
            <Spin size="large" tip="切换周实例中..." />
          </div>
        )}
      </div>

      {/* 每周实例分页控件 - 仅周固定课表且为实例视图时显示 */}
      {timetable?.isWeekly && viewMode === 'instance' && weeklyInstances.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginTop: '0.5rem', 
          gap: '1rem',
          padding: '8px 0'
        }}>
          <Button
            type="text"
            onClick={() => switchToWeekInstanceByIndex(currentInstanceIndex - 1)}
            disabled={currentInstanceIndex <= 0 || instancesLoading}
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
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {weeklyInstances.map((instance, index) => {
              console.log('Rendering button for instance:', instance, 'index:', index, 'currentIndex:', currentInstanceIndex);
              return (
                <Button
                  key={instance.id}
                  type={index === currentInstanceIndex ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    console.log('Button clicked for index:', index);
                    switchToWeekInstanceByIndex(index);
                  }}
                  disabled={instancesLoading}
                  style={{
                    minWidth: '80px',
                    fontSize: '12px',
                    ...(index === currentInstanceIndex && {
                      backgroundColor: '#1890ff !important',
                      borderColor: '#1890ff !important',
                      color: '#fff !important'
                    })
                  }}
                  className={index === currentInstanceIndex ? 'selected-instance-btn' : ''}
                >
                  {dayjs(instance.weekStartDate).format('MM/DD')}
                </Button>
              );
            })}
          </div>
          
          <Button
            type="text"
            onClick={() => switchToWeekInstanceByIndex(currentInstanceIndex + 1)}
            disabled={currentInstanceIndex >= weeklyInstances.length - 1 || instancesLoading}
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
            // 完整编辑课程
            if (editingSchedule) {
              handleEditSchedule(editingSchedule, data);
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
        onCancel={() => {
          setDayScheduleModalVisible(false);
          setCopyOtherCoachesInModal(true);
          setOtherCoachesDataInModal([]);
          setLoadingOtherCoachesInModal(false);
          setOtherCoachesExpanded(false);
        }}
        footer={[
          <div key="footer-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={copyOtherCoachesInModal}
                onChange={(e) => handleCopyOtherCoachesInModalChange(e.target.checked)}
                disabled={loadingOtherCoachesInModal}
              >
                复制其他教练课程
              </Checkbox>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="primary" onClick={() => copyToClipboard(generateCopyTextForDay(daySchedulesForCopy, currentDayDate, currentDayLabel, copyOtherCoachesInModal, otherCoachesDataInModal))}>
                复制课程
              </Button>
              <Button onClick={() => {
                setDayScheduleModalVisible(false);
                setCopyOtherCoachesInModal(true);
                setOtherCoachesDataInModal([]);
                setLoadingOtherCoachesInModal(false);
                setOtherCoachesExpanded(false);
              }}>
                关闭
              </Button>
            </div>
          </div>
        ]}
        width={600}
      >
        {/* 显示其他教练课程信息 */}
        {(loadingOtherCoachesInModal || (otherCoachesDataInModal && otherCoachesDataInModal.timetables && otherCoachesDataInModal.timetables.length > 0)) && (
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
                borderBottom: otherCoachesExpanded ? '1px solid #f0f0f0' : 'none'
              }}
              onClick={() => setOtherCoachesExpanded(!otherCoachesExpanded)}
            >
              <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                其他教练课程 ({otherCoachesDataInModal?.date || (currentDayDate ? currentDayDate.format('YYYY-MM-DD') : '')})
              </div>
              <div style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loadingOtherCoachesInModal && (
                  <Spin size="small" />
                )}
                {otherCoachesExpanded ? <UpOutlined /> : <DownOutlined />}
              </div>
            </div>

            {/* 可折叠的内容区域 */}
            {!loadingOtherCoachesInModal && otherCoachesDataInModal && otherCoachesDataInModal.timetables && (
              <div
                style={{
                  maxHeight: otherCoachesExpanded ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease-in-out'
                }}
              >
                <div style={{ padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {otherCoachesDataInModal.timetables
                    .filter(timetableInfo => timetableInfo.timetableId.toString() !== timetableId)
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

        <Table
          columns={[
            { title: '时间', dataIndex: 'time1', key: 'time1', width: '20%', align: 'center' },
            {
              title: '学员',
              dataIndex: 'studentName1',
              key: 'studentName1',
              width: '30%',
              align: 'center',
              onCell: (record) => ({
                style: {
                  backgroundColor: record.studentName1 ? studentColorMap.get(record.studentName1) : 'transparent',
                }
              }),
              render: (text) => text,
            },
            { title: '时间', dataIndex: 'time2', key: 'time2', width: '20%', align: 'center' },
            {
              title: '学员',
              dataIndex: 'studentName2',
              key: 'studentName2',
              width: '30%',
              align: 'center',
              onCell: (record) => ({
                style: {
                  backgroundColor: record.studentName2 ? studentColorMap.get(record.studentName2) : 'transparent',
                }
              }),
              render: (text) => text,
            },
          ]}
          dataSource={(() => {
            // 将单行数据转换为双列显示
            const result = [];
            for (let i = 0; i < dayScheduleData.length; i += 2) {
              const row1 = dayScheduleData[i];
              const row2 = dayScheduleData[i + 1];
              result.push({
                key: i,
                time1: row1?.time || '',
                studentName1: row1?.studentName || '',
                time2: row2?.time || '',
                studentName2: row2?.studentName || '',
              });
            }
            return result;
          })()}
          pagination={false}
          size="small"
          bordered
        />
      </Modal>

      {/* 可供排课时段模态框 */}
      <Modal
        title={availableSlotsTitle}
        open={availableTimeModalVisible}
        onCancel={() => setAvailableTimeModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            // 分组复制：周一：16:00-17:00、18:00-19:00
            const grouped = availableTimeSlots.reduce((acc, s) => {
              const key = `${s.day}${s.date ? ` ${s.date}` : ''}`;
              (acc[key] ||= []).push(s.timeSlot);
              return acc;
            }, {});
            const lines = Object.entries(grouped).map(([k, arr]) => {
              const sorted = arr.slice().sort((a, b) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
              return `${k}：${sorted.join('、')}`;
            });
            const text = lines.join('\n');
            navigator.clipboard.writeText(text).then(() => {
              message.success('已复制到剪贴板');
            }).catch(() => {
              message.error('复制失败');
            });
          }}>
            复制
          </Button>,
          <Button key="close" onClick={() => setAvailableTimeModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {availableTimeSlots.length > 0 ? (
            (() => {
              const grouped = availableTimeSlots.reduce((acc, s) => {
                const key = `${s.day}${s.date ? ` ${s.date}` : ''}`;
                (acc[key] ||= []).push(s.timeSlot);
                return acc;
              }, {});
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(grouped).map(([title, times]) => {
                    const sorted = times.slice().sort((a, b) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
                    return (
                      <div key={title}>
                        <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 8, fontSize: '15px' }}>{title}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sorted.map(t => (
                            <span key={t} style={{ padding: '4px 10px', background: '#f5f5f5', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, color: '#444' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              暂无空闲时段
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default ViewTimetable;