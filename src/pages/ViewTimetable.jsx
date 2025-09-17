import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Table, message, Space, Tag, Popover, Spin, Input, Modal, Checkbox, Collapse, Dropdown } from 'antd';
import { LeftOutlined, CalendarOutlined, RightOutlined, CopyOutlined, CloseOutlined, CheckOutlined, DownOutlined, UpOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, getTimetableSchedulesByStudent, deleteSchedule, updateSchedule, createSchedule, createSchedulesBatch, getActiveSchedulesByDate, deleteSchedulesBatch, getTodaySchedulesOnce, getTomorrowSchedulesOnce, invalidateTimetableCache, getActiveSchedulesByDateMerged, getTemplateSchedules, getThisWeekSchedules } from '../services/timetable';
import { invalidateWeeklyTemplatesCache, getInstanceSchedulesByDate } from '../services/admin';
import { getThisWeekSchedulesSessionOnce } from '../services/timetable';
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

// 移除了全局的 useRef，将在组件内部定义

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
  // 本页采用"每区块一次"的策略：各区块调用 *Once 方法（带合并+缓存）
  const [templateSchedules, setTemplateSchedules] = useState([]); // 存储固定课表模板数据用于比较
  const [loading, setLoading] = useState(true);
  
  // 移除了 viewModeRef，简化渲染逻辑
  
  // 周实例相关状态
  const [viewMode, setViewMode] = useState('instance'); // 'template' | 'instance' | 'today' | 'tomorrow'
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

  // 防抖/竞态控制：视图切换时只接受最后一次请求结果
  const latestRequestIdRef = useRef(0);

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
  
  // 视图切换loading状态
  const [switchToInstanceLoading, setSwitchToInstanceLoading] = useState(false);
  const [switchToTemplateLoading, setSwitchToTemplateLoading] = useState(false);
  
  // 视图切换时的临时数据保存
  const [tempSchedules, setTempSchedules] = useState([]);
  const [tempViewMode, setTempViewMode] = useState(null);
  const [tempWeeklyStats, setTempWeeklyStats] = useState(null);

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
      const scheduledTimes = displaySchedules
        .filter(schedule => {
          if (displayViewMode === 'instance') {
            // 优先按日期过滤（实例课程带有 scheduleDate）
            if (schedule.scheduleDate) {
              const base = currentWeekInstance?.weekStartDate 
                ? dayjs(currentWeekInstance.weekStartDate) 
                : dayjs().startOf('week');
              const currentDate = base.add(dayIndex, 'day');
              return schedule.scheduleDate === currentDate.format('YYYY-MM-DD');
            }
            // 回退：没有日期字段时按星期几过滤
            return (schedule.dayOfWeek || '').toLowerCase() === day.key;
          }
          // 模板视图：按星期几过滤
          return (schedule.dayOfWeek || '').toLowerCase() === day.key;
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
              date: displayViewMode === 'instance' && currentWeekInstance 
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
    // 统一规则（修正）：
    // - 周固定课表：新增应写入“固定课表模板”，不带具体日期（scheduleDate=null）
    // - 日期范围课表：使用当前周计算具体日期
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
        // 实例视图：直接在实例中创建课程
        resp = await createInstanceSchedule(currentWeekInstance.id, payload);
      } else {
        // 模板视图：在固定课表中创建模板课程
        resp = await createSchedule(timetableId, payload);
      }
      
      if (resp.success) {
        handlePopoverVisibleChange(`popover-${dayKey}-${timeIndex}`, false);
        
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        
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
      // 其它周：按“MMDD”显示（例：0901）
      return start.format('MMDD');
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
      
      // 优先使用普通用户可访问的API
      getInstanceSchedulesByDate(targetDateStr)
        .then(response => {
          if (response.success) {
            // 转换数据格式以匹配原有结构
            const convertedData = {
              date: targetDateStr,
              timetables: response.data.timetableSchedules || []
            };
            if (convertedData.timetables) {
              convertedData.timetables.forEach(timetable => {
                if (timetable.schedules) {
                  timetable.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
                }
              });
            }
            setOtherCoachesDataInModal(convertedData);
          }
        })
        .catch(error => {
          console.error('获取其他教练课程失败，尝试管理员API:', error);
          // 如果普通用户API失败，尝试管理员API（管理员用户）
          getActiveSchedulesByDateMerged(targetDateStr)
            .then(response => {
              if (response.success) {
                if (response.data && response.data.timetables) {
                  response.data.timetables.forEach(timetable => {
                    if (timetable.schedules) {
                      timetable.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
                    }
                  });
                }
                setOtherCoachesDataInModal(response.data);
              }
            })
            .catch(adminError => {
              console.error('获取其他教练课程失败:', adminError);
            });
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
        const otherCourseList = [...timetableInfo.schedules]
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map(schedule => {
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

  // 移除自动触发的useEffect，改为按钮点击时手动调用
  // 这样避免了无限循环调用API的问题

  // 当获取到每周实例列表后，自动切换到本周实例（仅在用户操作后触发，不在初始加载时触发）
  useEffect(() => {
    if (weeklyInstances.length > 0 && viewMode === 'instance' && currentInstanceIndex === 0 && !loading) {
      // 检查是否应该切换到本周实例
      const today = dayjs();
      const thisWeekStart = today.startOf('week').add(1, 'day'); // 周一
      const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
      
      const thisWeekIndex = weeklyInstances.findIndex(inst => {
        const start = dayjs(inst.weekStartDate);
        const end = dayjs(inst.weekEndDate);
        return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
      });
      
      // 如果找到本周实例且当前不是本周实例，则自动切换
      if (thisWeekIndex >= 0 && thisWeekIndex !== currentInstanceIndex) {
        console.log('Auto switching to this week instance, index:', thisWeekIndex);
        switchToWeekInstanceByIndex(thisWeekIndex);
      }
    }
  }, [weeklyInstances, viewMode, loading]); // 添加loading依赖，避免初始加载时触发

  // 注释掉旧的fetchTemplateSchedules调用，避免重复请求
  // useEffect(() => {
  //   if (timetable && viewMode === 'template' && !timetable.isWeekly && currentWeek) {
  //     fetchTemplateSchedules();
  //   }
  // }, [currentWeek]);

  // 删除旧的 viewMode 监听，避免与新的统一视图切换逻辑重复
  // useEffect(() => {
  //   if (!timetable || loading) return;
  //   if (viewMode === 'instance' && timetable.isWeekly) {
  //     fetchWeekInstanceSchedules();
  //   } else if (viewMode === 'template') {
  //     if (templateSchedules.length > 0) {
  //       setAllSchedules(templateSchedules);
  //     }
  //   } else if (viewMode === 'today') {
  //     fetchTodaySchedules();
  //   } else if (viewMode === 'tomorrow') {
  //     fetchTomorrowSchedules();
  //   }
  // }, [viewMode, timetable, loading]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        const { timetable: timetableData, owner } = response.data;
        setTimetable(timetableData);
        setTimetableOwner(owner);
        
        // For weekly timetables, initialize and determine view mode
        // 默认展示：周固定 -> 本周；日期范围 -> 固定
        if (timetableData.isWeekly && !timetableData.startDate && !timetableData.endDate) {
          // 一次性获取所有需要的数据，避免多次状态更新导致闪烁
          const [templateResponse, instancesResponse, currentWeekResponse] = await Promise.all([
            getTemplateSchedules(timetableId),
            getWeeklyInstances(timetableId),
            getCurrentWeekInstance(timetableId)
          ]);
          
          // 处理模板数据
          if (templateResponse && templateResponse.success) {
            setTemplateSchedules(templateResponse.data || []);
          }
          
          // 处理周实例列表
          if (instancesResponse && instancesResponse.success && Array.isArray(instancesResponse.data)) {
            const sortedInstances = instancesResponse.data.sort((a, b) => 
              dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
            );
            setWeeklyInstances(sortedInstances);
            
            // 处理当前周实例
            if (currentWeekResponse && currentWeekResponse.success && currentWeekResponse.data?.hasInstance) {
              const instance = currentWeekResponse.data.instance;
              const schedules = currentWeekResponse.data.schedules || [];
              
              // 找到当前实例在列表中的索引
              const targetIndex = sortedInstances.findIndex(inst => inst.id === instance.id);
              const finalIndex = targetIndex >= 0 ? targetIndex : sortedInstances.length - 1;
              
              // 一次性设置所有状态，避免闪烁
              setViewMode('instance');
              setCurrentWeekInstance(instance);
              setAllSchedules(schedules);
              setCurrentInstanceIndex(finalIndex);
            } else {
              // 没有当前周实例，生成一个
              const generateResponse = await generateCurrentWeekInstance(timetableId);
              if (generateResponse && generateResponse.success) {
                const newCurrentWeekResponse = await getCurrentWeekInstance(timetableId);
                if (newCurrentWeekResponse && newCurrentWeekResponse.success && newCurrentWeekResponse.data?.hasInstance) {
                  const instance = newCurrentWeekResponse.data.instance;
                  const schedules = newCurrentWeekResponse.data.schedules || [];
                  
                  const targetIndex = sortedInstances.findIndex(inst => inst.id === instance.id);
                  const finalIndex = targetIndex >= 0 ? targetIndex : sortedInstances.length - 1;
                  
                  setViewMode('instance');
                  setCurrentWeekInstance(instance);
                  setAllSchedules(schedules);
                  setCurrentInstanceIndex(finalIndex);
                }
              }
            }
          }
        } else {
          setViewMode('template');
          const tpl = await getTemplateSchedules(timetableId);
          if (tpl && tpl.success) setAllSchedules(tpl.data || []);
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

  // 1. 获取固定课表模板数据（每区块一次）
  const fetchTemplateSchedules = async (requestId) => {
    const currentId = requestId ?? latestRequestIdRef.current;
    // 修复：使用正确的API直接获取指定课表的模板数据，而不是从admin接口获取所有数据再过滤
    const response = await getTemplateSchedules(timetableId);
    if (response && response.success) {
      // 只有当本次请求仍是最新时才更新UI，避免切换过程中数据错乱
      if (latestRequestIdRef.current === currentId) {
        setAllSchedules(response.data || []);
        setTemplateSchedules(response.data || []);
      }
    }
  };

  // 2. 获取今日课程数据（每区块一次）
  const fetchTodaySchedules = async () => {
    // 周固定课表：必须从实例获取
    if (timetable?.isWeekly) {
      let resp = await getCurrentWeekInstance(timetableId);
      if (!(resp && resp.success && resp.data?.hasInstance)) {
        const gen = await generateCurrentWeekInstance(timetableId);
        if (gen && gen.success) resp = await getCurrentWeekInstance(timetableId);
      }
      if (resp && resp.success && resp.data?.hasInstance) {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const list = (resp.data.schedules || []).filter(s => s.scheduleDate === todayStr);
        setCurrentWeekInstance(resp.data.instance);
        setAllSchedules(list);
        return;
      }
      setAllSchedules([]);
      return;
    }
    // 日期范围课表：用按日接口
    const response = await getTodaySchedulesOnce(timetableId);
    if (response && response.success) setAllSchedules(response.data || []);
  };

  // 3. 获取明日课程数据（每区块一次）
  const fetchTomorrowSchedules = async () => {
    if (timetable?.isWeekly) {
      let resp = await getCurrentWeekInstance(timetableId);
      if (!(resp && resp.success && resp.data?.hasInstance)) {
        const gen = await generateCurrentWeekInstance(timetableId);
        if (gen && gen.success) resp = await getCurrentWeekInstance(timetableId);
      }
      if (resp && resp.success && resp.data?.hasInstance) {
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const list = (resp.data.schedules || []).filter(s => s.scheduleDate === tomorrowStr);
        setCurrentWeekInstance(resp.data.instance);
        setAllSchedules(list);
        return;
      }
      setAllSchedules([]);
      return;
    }
    const response = await getTomorrowSchedulesOnce(timetableId);
    if (response && response.success) setAllSchedules(response.data || []);
  };

  // 4. 获取本周数据（每区块一次）- 统一走聚合接口
  const fetchWeekInstanceSchedules = async (requestId) => {
    console.log('fetchWeekInstanceSchedules called for timetableId:', timetableId);
    const response = await getThisWeekSchedulesSessionOnce(timetableId);
    console.log('fetchWeekInstanceSchedules response:', response);
    if (response && response.success) {
      console.log('Setting allSchedules to:', response.data || []);
      if (latestRequestIdRef.current === (requestId ?? latestRequestIdRef.current)) {
        setAllSchedules(response.data || []);
      }
    } else {
      console.log('Failed to fetch week instance schedules');
      setAllSchedules([]);
    }
  };



  // 移除initializeWeeklyInstance函数，避免重复调用

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
      // 如果是周固定课表且还没有模板数据，先获取模板数据用于比较
      if (timetable && timetable.isWeekly && templateSchedules.length === 0) {
        console.log('获取模板数据用于比较...');
        const templateResponse = await getTemplateSchedules(timetableId);
        if (templateResponse.success) {
          setTemplateSchedules(templateResponse.data);
          console.log('模板数据获取完成，数量:', templateResponse.data.length);
        }
      }

      // 先检查是否有当前周实例
      const checkResponse = await checkCurrentWeekInstance(timetableId);
      if (checkResponse.success) {
        const hasInstance = checkResponse.data.hasCurrentWeekInstance;
        
        if (hasInstance) {
          // 有实例，获取实例数据
          console.log('检测到有实例，开始获取实例数据...');
          const response = await getCurrentWeekInstance(timetableId);
          console.log('getCurrentWeekInstance 响应:', response);
          
          if (response.success && response.data.hasInstance) {
            setCurrentWeekInstance(response.data.instance);
            setAllSchedules(response.data.schedules);
            setHasCurrentWeekInstance(true);
            console.log('实例数据设置完成 - 实例:', response.data.instance);
            console.log('实例数据设置完成 - 课程数量:', response.data.schedules?.length || 0);
            console.log('实例课程详情:', response.data.schedules);
          } else {
            console.log('获取实例数据失败或没有实例数据');
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

  // 删除旧的 switchToInstanceView 方法，避免重复调用 fetchWeeklyInstances
  // 现在统一使用 handleThisWeekClick 方法

  // 获取每周实例列表
  const fetchWeeklyInstances = async () => {
    // 仅依赖timetableId，避免因timetable状态尚未set而提前return
    if (!timetableId) return;
    
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
        
        // 总是更新索引，确保状态一致性
        // 优先找到当前周实例的索引
        if (currentWeekInstance?.id) {
          const currentIndex = sortedInstances.findIndex(inst => inst.id === currentWeekInstance.id);
          if (currentIndex >= 0) {
            setCurrentInstanceIndex(currentIndex);
            return;
          }
        }
        
        // 如果没有当前周实例，尝试找到本周的实例
        const today = dayjs();
        // 与后端保持一致：周一为一周的开始
        const thisWeekStart = today.startOf('week').add(1, 'day'); // 周一
        const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
        
        const thisWeekIndex = sortedInstances.findIndex(inst => {
          const start = dayjs(inst.weekStartDate);
          const end = dayjs(inst.weekEndDate);
          // 精确匹配：实例的周开始和结束日期与当前周一致
          return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
        });
        if (thisWeekIndex >= 0) {
          setCurrentInstanceIndex(thisWeekIndex);
        } else {
          // 如果找不到本周实例，默认选择最后一个（最新的）实例
          setCurrentInstanceIndex(sortedInstances.length - 1);
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
    
    // 如果点击的是当前选中的实例，不做任何操作
    if (instanceIndex === currentInstanceIndex) {
      console.log('Clicked current instance, no action needed');
      return;
    }
    
    // 保存当前的统计信息，避免loading期间显示错误数据
    setTempWeeklyStats(weeklyStats);
    setTempViewMode('instance');
    setSwitchToInstanceLoading(true);
    
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
      setSwitchToInstanceLoading(false);
      setTempWeeklyStats(null);
      setTempViewMode(null);
    }
  };

  // 按钮点击处理函数 - 直接调用对应API，避免useEffect循环
  const handleTodayClick = async () => {
    console.log('点击今日按钮');
    clearModes();
    setViewMode('today');
    await fetchTodaySchedules();
  };

  const handleTomorrowClick = async () => {
    console.log('点击明日按钮');
    clearModes();
    setViewMode('tomorrow');
    await fetchTomorrowSchedules();
  };

  // 切换到当前周实例的函数
  const switchToCurrentWeekInstance = async () => {
    console.log('尝试切换到本周实例');
    
    // 确保有周实例列表
    if (weeklyInstances.length === 0) {
      console.log('没有周实例列表，先获取...');
      await fetchWeeklyInstances();
    }
    
    // 重新获取更新后的周实例列表
    const instances = weeklyInstances.length > 0 ? weeklyInstances : await fetchWeeklyInstances() || [];
    
    // 计算本周的开始和结束日期
    const today = dayjs();
    const thisWeekStart = today.startOf('week').add(1, 'day'); // 周一
    const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
    
    // 查找本周实例
    const thisWeekIndex = instances.findIndex(inst => {
      const start = dayjs(inst.weekStartDate);
      const end = dayjs(inst.weekEndDate);
      return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
    });
    
    if (thisWeekIndex >= 0) {
      console.log('找到本周实例，索引:', thisWeekIndex);
      await switchToWeekInstanceByIndex(thisWeekIndex);
    } else {
      console.log('没有找到本周实例，尝试生成本周实例...');
      // 尝试生成本周实例
      try {
        const generateResponse = await generateCurrentWeekInstance(timetableId);
        if (generateResponse && generateResponse.success) {
          // 重新获取实例列表
          await fetchWeeklyInstances();
          // 再次查找本周实例
          const newThisWeekIndex = weeklyInstances.findIndex(inst => {
            const start = dayjs(inst.weekStartDate);
            const end = dayjs(inst.weekEndDate);
            return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
          });
          if (newThisWeekIndex >= 0) {
            await switchToWeekInstanceByIndex(newThisWeekIndex);
            return;
          }
        }
      } catch (error) {
        console.error('生成本周实例失败:', error);
      }
      
      // 如果还是找不到，设置为实例视图模式，但清空currentWeekInstance确保按钮显示"本周"
      setCurrentWeekInstance(null);
      setViewMode('instance');
    }
  };

  const handleThisWeekClick = async () => {
    console.log('点击本周按钮');
    clearModes();
    
    // 检查当前是否已经是本周实例
    if (viewMode === 'instance' && currentWeekInstance?.weekStartDate) {
      const today = dayjs();
      const thisWeekStart = today.startOf('week').add(1, 'day'); // 周一
      const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
      
      const currentStart = dayjs(currentWeekInstance.weekStartDate);
      const currentEnd = dayjs(currentWeekInstance.weekEndDate);
      
      // 如果当前实例就是本周实例，不做任何操作
      if (currentStart.isSame(thisWeekStart, 'day') && currentEnd.isSame(thisWeekEnd, 'day')) {
        console.log('当前已经是本周实例，无需切换');
        return;
      }
    }
    
    // 确保切换到真正的本周实例
    await switchToCurrentWeekInstance();
  };

  // 上方按钮点击处理函数 - 如果当前已经是实例视图，不做任何操作
  const handleTopButtonClick = async () => {
    console.log('点击上方按钮');
    
    // 如果当前已经是实例视图，不做任何操作
    if (viewMode === 'instance') {
      console.log('当前已经是实例视图，不做任何操作');
      return;
    }
    
    // 否则切换到本周实例
    clearModes();
    
    // 保存当前的统计信息，避免loading期间显示错误数据
    setTempWeeklyStats(weeklyStats);
    setTempViewMode('instance');
    setSwitchToInstanceLoading(true);
    
    await switchToCurrentWeekInstance();
  };

  const handleTemplateClick = async () => {
    console.log('点击固定按钮');
    clearModes();
    
    // 保存当前的统计信息，避免loading期间显示错误数据
    setTempWeeklyStats(weeklyStats);
    setTempViewMode('template');
    setSwitchToTemplateLoading(true);
    
    // 重置实例相关状态，确保按钮显示正确
    setCurrentWeekInstance(null);
    setCurrentInstanceIndex(0);
    
    // 直接设置视图模式，由统一的 useEffect 处理数据加载
    setViewMode('template');
  };

  // 清除多选和删除模式
  const clearModes = () => {
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedCells(new Set());
    }
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedSchedulesForDelete(new Set());
    }
  };

  // 兼容旧函数名
  const switchToTemplateView = handleTemplateClick;

  // 比较固定课表和实例课程，确定边框颜色
  const getScheduleBorderColor = (instanceSchedule) => {
    if (!timetable || !timetable.isWeekly) {
      return ''; // 非周固定课表，不显示特殊边框
    }
    
    // 在实例视图或loading状态下从实例切换到模板时，都显示边框
    if (viewMode !== 'instance' && !loading) {
      return ''; // 非实例视图且非loading状态，不显示特殊边框
    }

    // 统一比较口径：星期大小写无关；时间以 HH:mm 比较
    const toDay = (v) => (v ? String(v).toUpperCase() : '');
    const toHm = (v) => (v ? String(v).slice(0, 5) : '');

    const iDay = toDay(instanceSchedule.dayOfWeek);
    const iStart = toHm(instanceSchedule.startTime);
    const iEnd = toHm(instanceSchedule.endTime);

    // 查找对应的固定课表模板课程（忽略秒）
    const templateSchedule = templateSchedules.find(template => {
      const tDay = toDay(template.dayOfWeek);
      const tStart = toHm(template.startTime);
      const tEnd = toHm(template.endTime);
      return tDay === iDay && tStart === iStart && tEnd === iEnd;
    });

    if (!templateSchedule) {
      // 固定课表中没有，但实例中有 - 绿色边框（手动添加）
      return '#52c41a';
    } else {
      // 固定课表中有，检查内容是否一致
      const isContentSame = 
        (templateSchedule.studentName || '') === (instanceSchedule.studentName || '') &&
        (templateSchedule.subject || '') === (instanceSchedule.subject || '') &&
        (templateSchedule.note || '') === (instanceSchedule.note || '');
      
      if (!isContentSame) {
        // 内容不一致 - 橙色边框（已修改）
        return '#faad14';
      }
    }

    return ''; // 内容一致，不显示特殊边框
  };

  // 简化的刷新函数，直接按当前视图类型刷新
  const refreshSchedulesQuietly = async () => {
    try {
      if (viewMode === 'template') {
        // 模板视图：清除模板缓存并刷新模板数据
        invalidateTimetableCache(timetableId);
        const r = await getTimetableSchedules(timetableId, null, true);
        if (r && r.success) {
          setAllSchedules(r.data || []);
          setTemplateSchedules(r.data || []);
        }
      } else if (viewMode === 'instance') {
        // 实例视图：只刷新实例数据，不清除模板缓存
        if (currentWeekInstance && currentWeekInstance.id) {
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            // 更新currentWeekInstance中的schedules数据
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 回退到本周数据
          const r = await getThisWeekSchedules(timetableId);
          if (r && r.success) {
            setAllSchedules(r.data || []);
          }
        }
      } else if (viewMode === 'today') {
        const r = await getTodaySchedulesOnce(timetableId);
        if (r && r.success) setAllSchedules(r.data || []);
      } else if (viewMode === 'tomorrow') {
        const r = await getTomorrowSchedulesOnce(timetableId);
        if (r && r.success) setAllSchedules(r.data || []);
      }
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };

  // 简化视图切换数据加载，保持原有数据直到新数据加载完成
  React.useEffect(() => {
    if (!timetableId || !timetable) return;

    const loadViewData = async () => {
      try {
        // 显示加载状态，但保持原有表格数据
        setLoading(true);
        
        let response;
        
        if (viewMode === 'instance' && timetable.isWeekly) {
          // 本周实例：直接用聚合接口
          response = await getThisWeekSchedules(timetableId);
        } else if (viewMode === 'template') {
          // 模板视图
          response = await getTemplateSchedules(timetableId);
        } else if (viewMode === 'today') {
          // 今日课程
          response = await getTodaySchedulesOnce(timetableId);
        } else if (viewMode === 'tomorrow') {
          // 明日课程
          response = await getTomorrowSchedulesOnce(timetableId);
        } else {
          // 默认：普通课表数据
          response = await getTimetableSchedules(timetableId);
        }

        if (response && response.success) {
          const scheduleData = response.data || [];
          // 数据加载完成后直接更新表格
          setAllSchedules(scheduleData);
          setLoading(false);
          
          // 清理临时状态
          setSwitchToInstanceLoading(false);
          setSwitchToTemplateLoading(false);
          setTempWeeklyStats(null);
          setTempViewMode(null);
        } else {
          setLoading(false);
          // 清理临时状态
          setSwitchToInstanceLoading(false);
          setSwitchToTemplateLoading(false);
          setTempWeeklyStats(null);
          setTempViewMode(null);
        }
      } catch (error) {
        console.error('加载视图数据失败:', error);
        setLoading(false);
        // 清理临时状态
        setSwitchToInstanceLoading(false);
        setSwitchToTemplateLoading(false);
        setTempWeeklyStats(null);
        setTempViewMode(null);
      }
    };

    loadViewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, timetableId]);

  const handleDeleteSchedule = async (scheduleId) => {
    setDeleteLoading(true);
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：直接删除实例中的课程
        response = await deleteInstanceSchedule(scheduleId);
        if (response.success) {
          setOpenPopoverKey(null);
          // 直接从当前显示的数据中移除，避免重新请求
          setAllSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
          message.success('删除成功');
        } else {
          message.error(response.message || '删除失败');
        }
      } else {
        // 模板视图：使用原有删除API
        response = await deleteSchedule(timetableId, scheduleId);
        if (response.success) {
          setOpenPopoverKey(null);
          // 删除后刷新数据
          await refreshSchedulesQuietly();
          message.success('删除成功');
        } else {
          message.error(response.message || '删除失败');
        }
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
        if (response.success) {
          setOpenPopoverKey(null);
          // 直接更新本地状态，避免影响固定课表
          setAllSchedules(prev => prev.map(schedule => 
            schedule.id === scheduleObj.id 
              ? { ...schedule, studentName: newName.trim() }
              : schedule
          ));
          // 同时更新currentWeekInstance中的schedules数据
          setCurrentWeekInstance(prev => ({
            ...prev,
            schedules: (prev.schedules || []).map(schedule => 
              schedule.id === scheduleObj.id 
                ? { ...schedule, studentName: newName.trim() }
                : schedule
            )
          }));
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, payload);
        if (response.success) {
          setOpenPopoverKey(null);
          // 模板视图需要刷新数据
          await refreshSchedulesQuietly();
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
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
        if (response.success) {
          setEditModalVisible(false);
          setEditingSchedule(null);
          // 直接更新本地状态，避免影响固定课表
          setAllSchedules(prev => prev.map(schedule => 
            schedule.id === scheduleObj.id 
              ? { ...schedule, ...updatedData }
              : schedule
          ));
          // 同时更新currentWeekInstance中的schedules数据
          setCurrentWeekInstance(prev => ({
            ...prev,
            schedules: (prev.schedules || []).map(schedule => 
              schedule.id === scheduleObj.id 
                ? { ...schedule, ...updatedData }
                : schedule
            )
          }));
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, updatedData);
        if (response.success) {
          setEditModalVisible(false);
          setEditingSchedule(null);
          // 模板视图需要刷新数据
          await refreshSchedulesQuietly();
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
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

    // 为实例视图和日期范围课表计算目标日期
    if (viewMode === 'instance' && currentWeekInstance) {
      // 实例视图：基于实例的周开始日期计算目标日期
      const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
      const dayIndex = weekDays.findIndex(day => day.key === targetDayKey);
      const targetDate = instanceStartDate.clone().add(dayIndex, 'day');
      payload.scheduleDate = targetDate.format('YYYY-MM-DD');
    } else if (!timetable.isWeekly) {
      // 日期范围课表：使用getCurrentWeekDates计算目标日期
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        const dayIndex = weekDays.findIndex(day => day.key === targetDayKey);
        const targetDate = weekDates.start.clone().add(dayIndex, 'day');
        payload.scheduleDate = targetDate.format('YYYY-MM-DD');
      }
    }

    console.log('移动操作payload:', payload);
    
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        console.log('使用实例API更新，scheduleId:', scheduleToMove.id);
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
        
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        
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
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
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
            
            const schedules = displaySchedules.filter(s => {
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
          if (viewMode === 'instance' && currentWeekInstance) {
            // 实例视图：直接刷新实例数据，避免影响固定课表
            const r = await getInstanceSchedules(currentWeekInstance.id);
            if (r && r.success) {
              setAllSchedules(r.data || []);
              setCurrentWeekInstance(prev => ({
                ...prev,
                schedules: r.data || []
              }));
            }
          } else {
            // 模板视图：需要刷新数据
            await refreshSchedulesQuietly();
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
        
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        
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
    } else if (viewMode === 'instance') {
      // 实例模式但没有schedules数据时，使用allSchedules
      schedules = allSchedules || [];
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
    'rgba(255,183,197,0.45)', // pink
    'rgba(255,223,186,0.45)', // peach
    'rgba(255,255,186,0.45)', // lemon
    'rgba(186,255,201,0.45)', // mint
    'rgba(186,225,255,0.45)', // sky
    'rgba(218,198,255,0.45)', // lavender
    'rgba(255,200,221,0.45)', // rose
    'rgba(255,236,179,0.45)', // apricot
    'rgba(197,225,165,0.45)', // light green
    'rgba(179,229,252,0.45)', // light blue
    'rgba(248,209,215,0.45)', // blush
    'rgba(204,236,239,0.45)', // pale aqua
    'rgba(220,210,255,0.45)', // pale violet
    'rgba(255,214,214,0.45)', // light coral
    'rgba(255,242,204,0.45)', // cream
    'rgba(210,245,228,0.45)'  // aqua mint
  ];

  const textColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];

  const studentColorMap = new Map();
  const studentTextColorMap = new Map();

  // 如果课表信息未加载，显示完整页面布局但数据为空
  const isInitialLoading = !timetable;
  
  // 在切换过程中使用临时数据，否则使用当前数据
  const displaySchedules = (switchToInstanceLoading || switchToTemplateLoading) && tempSchedules.length > 0 
    ? tempSchedules 
    : allSchedules;
  
  const displayViewMode = (switchToInstanceLoading || switchToTemplateLoading) && tempViewMode 
    ? tempViewMode 
    : viewMode;

  const allStudentNames = [...new Set(displaySchedules.map(s => s.studentName).filter(Boolean))];
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
      
      // 根据不同的视图模式显示列头
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例的开始日期
        const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
        const currentDate = instanceStartDate.clone().add(index, 'day');
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
        // 日期范围课表
        const currentDate = weekDates.start.clone().add(index, 'day');
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
        // 固定课表视图，显示星期几和当前周日期
        const today = dayjs();
        const dayOfWeek = today.day();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayOfThisWeek = today.clone().subtract(daysFromMonday, 'day');
        const currentDate = mondayOfThisWeek.clone().add(index, 'day');
        isToday = currentDate.isSame(today, 'day');
        
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
            {viewMode !== 'template' && (
              <div className="day-date">
                {currentDate.format('MM/DD')}
              </div>
            )}
          </div>
        );
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
          const schedules = displaySchedules.filter(s => {
            const timeKey = `${s.startTime.substring(0, 5)}-${s.endTime.substring(0, 5)}`;
            
            // 时间不匹配，直接过滤掉
            if (timeKey !== record.time) return false;
            
            // 根据视图模式进行不同的过滤
            if (displayViewMode === 'instance') {
              // 实例视图：优先按具体日期过滤
              if (s.scheduleDate && currentWeekInstance) {
                const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
                const currentDate = instanceStartDate.add(index, 'day');
                return s.scheduleDate === currentDate.format('YYYY-MM-DD');
              }
              // 回退到按星期几过滤（兼容性）
              return (s.dayOfWeek || '').toLowerCase() === day.key;
            } else {
              // 模板视图：按星期几过滤
              if (timetable.isWeekly) {
                return (s.dayOfWeek || '').toLowerCase() === day.key;
              } else {
                // 日期范围课表按日期过滤
                const scheduleDate = dayjs(s.scheduleDate);
                const dayIndex = scheduleDate.day();
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const scheduleDayKey = dayNames[dayIndex];
                return scheduleDayKey === day.key;
              }
            }
          });

          if (!schedules || schedules.length === 0) {
            const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
            const cellKey = `${pagePrefix}-${day.key}-${record.key}`;
            const isSelected = selectedCells.has(cellKey);

            if (timetable?.isArchived) {
              return <div style={{ height: '48px' }} />;
            }

            const templateScheduleExists = displayViewMode === 'instance' &&
              Array.isArray(templateSchedules) &&
              templateSchedules.some(template => {
                const timeKey = record.time;
                const dayKey = day.key;
                const templateTimeKey = `${template.startTime.substring(0, 5)}-${template.endTime.substring(0, 5)}`;
                return template.dayOfWeek.toLowerCase() === dayKey && templateTimeKey === timeKey;
              });

            const emptyCellStyle = {
              height: '48px',
              cursor: 'pointer',
              border: templateScheduleExists ? '1px dashed #ff4d4f' : undefined,
            };

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
              if (timetable.isWeekly && currentWeekInstance) {
                const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
                const targetDate = instanceStartDate.add(index, 'day');
                scheduleDate = targetDate.format('YYYY-MM-DD');
              } else if (!timetable.isWeekly && weekDates && weekDates.start) {
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
                  // 实例视图：直接在实例中创建课程
                  resp = await createInstanceSchedule(currentWeekInstance.id, payload);
                } else {
                  // 模板视图：在固定课表中创建模板课程
                  resp = await createSchedule(timetableId, payload);
                }
                
                if (resp.success) {
                  setOpenPopoverKey(null);
                  
                  if (viewMode === 'instance' && currentWeekInstance) {
                    // 实例视图：直接刷新实例数据，避免影响固定课表
                    const r = await getInstanceSchedules(currentWeekInstance.id);
                    if (r && r.success) {
                      setAllSchedules(r.data || []);
                      setCurrentWeekInstance(prev => ({
                        ...prev,
                        schedules: r.data || []
                      }));
                    }
                  } else {
                    // 模板视图：需要清除缓存并刷新数据
                    invalidateTimetableCache(timetableId);
                    await refreshSchedulesQuietly();
                  }
                  
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
                    ...emptyCellStyle,
                    backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                    border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border,
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
                      ...emptyCellStyle,
                      backgroundColor: isSelected ? '#e6f4ff' : 'transparent',
                      border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border || '1px solid #f0f0f0',
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
                    ...emptyCellStyle,
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border || '1px solid #f0f0f0',
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
                  ...emptyCellStyle,
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

  // 为初始加载状态准备空数据
  const displayTimetable = timetable || { name: '课表加载中...', isWeekly: true };
  const displayTableDataSource = isInitialLoading ? 
    // 生成空的时间表格结构
    Array.from({ length: 11 }, (_, i) => {
      const hour = 9 + i;
      return {
        key: i,
        time: `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`
      };
    }) : tableDataSource;
  
  // 为初始加载生成与实际列结构一致的列头
  const generateInitialColumns = () => {
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
      }
    ];

    // 生成一周的列头，确保与实际数据加载后的结构一致
    weekDays.forEach((day, index) => {
      let columnTitle;
      let isToday = false;
      
      // 初始加载时，始终显示周几和当前周日期（类似固定课表但带日期）
      const today = dayjs();
      // 手动计算本周周一（更可靠的方法）
      const dayOfWeek = today.day(); // 0=周日, 1=周一, ..., 6=周六
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 距离周一的天数
      const mondayOfThisWeek = today.clone().subtract(daysFromMonday, 'day');
      const currentDate = mondayOfThisWeek.clone().add(index, 'day');
      isToday = currentDate.isSame(today, 'day');
      
      columnTitle = (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {day.label}
          </div>
          <div className="day-date">
            {currentDate.format('MM/DD')}
          </div>
        </div>
      );

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
        render: () => null // 初始加载时不渲染内容
      });
    });

    return columns;
  };

  const displayColumns = isInitialLoading ? generateInitialColumns() : generateColumns();
  
  // 为初始加载提供默认值
  const displayWeeklyInstances = isInitialLoading ? [] : weeklyInstances;
  const displayWeeklyStats = isInitialLoading 
    ? { count: 0, students: 0 } 
    : (switchToInstanceLoading || switchToTemplateLoading) && tempWeeklyStats 
      ? tempWeeklyStats 
      : weeklyStats;
  const displayTotalWeeks = isInitialLoading ? 1 : totalWeeks;
  const displayCurrentWeek = isInitialLoading ? 1 : currentWeek;

  return (
    <div className="page-container" onTouchStart={isInitialLoading ? undefined : handleTouchStart} onTouchEnd={isInitialLoading ? undefined : handleTouchEnd}>
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
            <h1 style={{ margin: 0 }}>{displayTimetable?.name}</h1>
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
      {(!timetable?.isArchived || isInitialLoading) && (moveMode || copyMode) && (
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
      {(timetable || isInitialLoading) && (
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
              {/* 在周固定课表中显示图例和提示信息 */}
              {(timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) || isInitialLoading ? (
                <>
                  {/* 图例说明 */}
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
            </div>
            
            {/* 视图切换按钮和多选删除按钮 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* 视图切换按钮只在周固定课表中显示 */}
              {Boolean((timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) || (isInitialLoading && displayTimetable?.isWeekly)) ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Button
                      type="default"
                      size="small"
                    onClick={handleTopButtonClick}
                    disabled={switchToInstanceLoading || switchToTemplateLoading || instanceLoading}
                    style={displayViewMode === 'instance' ? { 
                      fontSize: '12px',
                      backgroundColor: '#fa8c16',
                      borderColor: '#fa8c16',
                      color: 'white',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRightStyle: 'none'
                    } : { 
                      fontSize: '12px',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRightStyle: 'none'
                    }}
                  >
                    {instanceWeekLabel}
                  </Button>
                  <Dropdown
                    disabled={switchToInstanceLoading || switchToTemplateLoading}
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
                                // 确保切换到真正的本周实例
                                await switchToCurrentWeekInstance();
                                message.success('已切换到本周课表');
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
                                  // 直接刷新实例数据，避免影响固定课表
                                  if (currentWeekInstance && currentWeekInstance.id) {
                                    const r = await getInstanceSchedules(currentWeekInstance.id);
                                    if (r && r.success) {
                                      setAllSchedules(r.data || []);
                                      setCurrentWeekInstance(prev => ({
                                        ...prev,
                                        schedules: r.data || []
                                      }));
                                    }
                                  }
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
                                  // 直接刷新实例数据，避免影响固定课表
                                  if (currentWeekInstance && currentWeekInstance.id) {
                                    const r = await getInstanceSchedules(currentWeekInstance.id);
                                    if (r && r.success) {
                                      setAllSchedules(r.data || []);
                                      setCurrentWeekInstance(prev => ({
                                        ...prev,
                                        schedules: r.data || []
                                      }));
                                    }
                                  }
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
                      disabled={switchToInstanceLoading || switchToTemplateLoading}
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
                  type={displayViewMode === 'template' ? 'primary' : 'default'}
                  size="small"
                  onClick={switchToTemplateView}
                  disabled={switchToInstanceLoading || switchToTemplateLoading}
                  style={{ fontSize: '12px' }}
                >
                  固定课表
                </Button>
                </div>
              ) : null}
            </div>
          </div>
          
          {/* 分隔线 - 只在固定课表时显示 */}
          {((timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) || (isInitialLoading && displayTimetable?.isWeekly)) && (
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
              {(!timetable?.isArchived || isInitialLoading) && !moveMode && !copyMode && !deleteMode ? (
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
              {!multiSelectMode && !deleteMode && !moveMode && !copyMode ? (
                <span style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  whiteSpace: 'nowrap'
                }}>
                  {displayViewMode === 'instance' ? '本周' : '每周'}
                  <span style={{ color: '#8a2be2', fontWeight: 'bold', margin: '0 4px' }}>
                    {isInitialLoading ? '0' : displayWeeklyStats.count}
                  </span>
                  节课
                  <span style={{ margin: '0 4px' }}>学员</span>
                  <span style={{ color: '#52c41a', fontWeight: 'bold', margin: '0 2px' }}>
                    {isInitialLoading ? '0' : displayWeeklyStats.students}
                  </span>
                  <span>个</span>
                </span>
              ) : null}
            </div>
            
            {/* 右侧：多选删除按钮、批量排课按钮和批量删除按钮 */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {(!timetable?.isArchived || isInitialLoading) && !moveMode && !copyMode && !multiSelectMode ? (
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
          columns={displayColumns}
          dataSource={displayTableDataSource}
          pagination={false}
          size="small"
          bordered
          className="compact-timetable"
          style={{ tableLayout: 'fixed' }}
        />
        {/* 统一的loading蒙板 */}
        {(loading || isInitialLoading || instancesLoading || switchToInstanceLoading || switchToTemplateLoading) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '6px'
          }}>
            <Spin size="small" tip={
              loading ? "正在加载课表..." :
              isInitialLoading ? "正在初始化..." :
              instancesLoading ? "切换周实例中..." : 
              switchToInstanceLoading ? "切换到本周..." :
              switchToTemplateLoading ? "切换到固定课表..." :
              "正在加载课表数据..."
            } />
          </div>
        )}
      </div>

      {/* 每周实例分页控件 - 仅周固定课表且为实例视图时显示 */}
      {(timetable?.isWeekly && displayViewMode === 'instance' && displayWeeklyInstances.length > 0 && !isInitialLoading) && (
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
            onClick={() => !isInitialLoading && switchToWeekInstanceByIndex(currentInstanceIndex - 1)}
            disabled={isInitialLoading || currentInstanceIndex <= 0 || instancesLoading}
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
            {(isInitialLoading ? [{ id: 'loading', weekStartDate: dayjs().format('YYYY-MM-DD') }] : displayWeeklyInstances).map((instance, index) => {
              console.log('Rendering button for instance:', instance, 'index:', index, 'currentIndex:', currentInstanceIndex);
              return (
                <Button
                  key={instance.id}
                  type="default"
                  size="small"
                  onClick={() => {
                    // 如果点击的是当前选中的实例，不做任何操作
                    if (index === currentInstanceIndex) {
                      console.log('Clicked current instance, no action needed');
                      return;
                    }
                    console.log('Button clicked for index:', index);
                    switchToWeekInstanceByIndex(index);
                  }}
                  disabled={instancesLoading}
                  style={{
                    minWidth: '80px',
                    fontSize: '12px',
                    ...(index === currentInstanceIndex && {
                      backgroundColor: '#fa8c16 !important',
                      borderColor: '#fa8c16 !important',
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
            onClick={() => !isInitialLoading && switchToWeekInstanceByIndex(currentInstanceIndex + 1)}
            disabled={isInitialLoading || currentInstanceIndex >= displayWeeklyInstances.length - 1 || instancesLoading}
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

      {(!timetable?.isWeekly && totalWeeks > 1 && !isInitialLoading) && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem', gap: '1rem' }}>
          <Button
            type="text"
            onClick={() => !isInitialLoading && displayCurrentWeek > 1 && handleWeekChange(displayCurrentWeek - 1)}
            disabled={isInitialLoading || displayCurrentWeek <= 1}
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
            第 {displayCurrentWeek} 周 / 共 {displayTotalWeeks} 周
          </Tag>
          <Button
            type="text"
            onClick={() => !isInitialLoading && displayCurrentWeek < displayTotalWeeks && handleWeekChange(displayCurrentWeek + 1)}
            disabled={isInitialLoading || displayCurrentWeek >= displayTotalWeeks}
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
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{availableSlotsTitle}</span>
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>
              （合计 {availableTimeSlots.length} 课时）
            </span>
          </div>
        }
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
            const text = `${availableSlotsTitle} (合计${availableTimeSlots.length}课时)\n\n${lines.join('\n')}`;
            
            // 兼容的复制方法，支持手机浏览器
            const copyToClipboard = (text) => {
              // 方法1：使用现代 Clipboard API
              if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
              } else {
                // 方法2：使用传统的 execCommand 方法（兼容手机）
                return new Promise((resolve, reject) => {
                  const textArea = document.createElement('textarea');
                  textArea.value = text;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  textArea.style.top = '-999999px';
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                      resolve();
                    } else {
                      reject(new Error('execCommand failed'));
                    }
                  } catch (err) {
                    reject(err);
                  } finally {
                    document.body.removeChild(textArea);
                  }
                });
              }
            };
            
            copyToClipboard(text).then(() => {
              message.success('已复制到剪贴板');
            }).catch(() => {
              message.error('复制失败，请手动复制');
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