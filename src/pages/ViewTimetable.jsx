import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Table, message, Pagination, Space, Tag, Popover, Spin, Input, Modal } from 'antd';
import { LeftOutlined, CalendarOutlined, RightOutlined, ExportOutlined, CopyOutlined, LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, deleteSchedule, updateSchedule, createSchedule, createSchedulesBatch } from '../services/timetable';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import EditScheduleModal from '../components/EditScheduleModal';
import './ViewTimetable.css';

dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.locale({ ...dayjs.Ls.en, weekStart: 1 });

const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onExport, timetable }) => {
  const [name, setName] = React.useState(schedule.studentName);

  return (
    <div style={{ width: '180px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ margin: '4px 0', textAlign: 'left' }}>
        <strong>学生:</strong>
        <Input
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginTop: 4 }}
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
        <Button
            type="primary"
            size="small"
            onClick={() => onExport(schedule.studentName)}
        >
            导出
        </Button>
        <Button
          size="small"
          onClick={() => onUpdateName(name)}
          style={{ backgroundColor: '#faad14', borderColor: '#faad14', color: 'white' }}
        >
          修改
        </Button>
        <Button
          type="primary"
          danger
          onClick={onDelete}
          size="small"
        >
          删除
        </Button>
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
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportContent, setExportContent] = useState('');
  
  // 多选功能状态
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [batchScheduleModalVisible, setBatchScheduleModalVisible] = useState(false);
  const [batchStudentName, setBatchStudentName] = useState('');

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
        const timetableData = response.data;
        setTimetable(timetableData);
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

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const response = await deleteSchedule(timetableId, scheduleId);
      if (response.success) {
        message.success('删除成功');
        setOpenPopoverKey(null);
        fetchSchedules();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
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
        message.success('修改成功');
        setOpenPopoverKey(null);
        fetchSchedules();
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  const handleExportStudentSchedule = async (studentName) => {
    try {
      message.loading({ content: '正在导出全部课时...', key: 'exporting' });
      
      let schedulesToExport;
      if (timetable && !timetable.isWeekly) {
        const response = await getTimetableSchedules(timetableId);
        if (response.success) {
          schedulesToExport = response.data;
        } else {
          message.destroy('exporting');
          message.error(response.message || '获取全部课程安排失败');
          return;
        }
      } else {
        schedulesToExport = allSchedules;
      }

      const studentSchedules = schedulesToExport.filter(s => s.studentName === studentName);
      message.destroy('exporting');

      if (studentSchedules.length === 0) {
        message.info('该学生在整个课表中没有排课');
        return;
      }

      let content = '';
      if (timetable.isWeekly) {
        content = `${studentName} 的周课表安排如下：\n`;
        const sortedSchedules = [...studentSchedules].sort((a, b) => {
          const dayA = weekDays.findIndex(d => d.label === a.dayOfWeek);
          const dayB = weekDays.findIndex(d => d.label === b.dayOfWeek);
          if (dayA !== dayB) return dayA - dayB;
          return a.startTime.localeCompare(b.startTime);
        });
        content += sortedSchedules.map(s => `${s.dayOfWeek} ${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`).join('\n');
      } else {
        content = `${studentName} 的课表安排如下：\n`;
        const sortedSchedules = [...studentSchedules].sort((a, b) => {
          if (a.scheduleDate !== b.scheduleDate) return dayjs(a.scheduleDate).diff(dayjs(b.scheduleDate));
          return a.startTime.localeCompare(b.startTime);
        });
        content += sortedSchedules.map(s => `${s.scheduleDate} ${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`).join('\n');
      }
      setExportContent(content);
      setExportModalVisible(true);
    } catch (error) {
      message.destroy('exporting');
      message.error('导出失败，请检查网络连接');
    }
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
        message.success(`成功添加 ${schedulesToCreate.length} 个课程安排`);
        setBatchScheduleModalVisible(false);
        setBatchStudentName('');
        setSelectedCells(new Set());
        setMultiSelectMode(false);
        fetchSchedules();
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
      let title = day.label;
      if (weekDates && weekDates.start) {
        const currentDate = weekDates.start.add(index, 'day');
        title = (
          <div className="day-header">
            <div className="day-name">{day.label}</div>
            <div className="day-date">
              {currentDate.format('MM-DD')}
            </div>
          </div>
        );
      }

      columns.push({
        title,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (students, record) => {
          if (!students || students.length === 0) {
            // 空单元格：提供插入排课功能或多选功能
            const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
            const cellKey = `${pagePrefix}-${day.key}-${record.key}`;
            const isSelected = selectedCells.has(cellKey);

            const handleCellClick = (e) => {
              if (multiSelectMode) {
                e.stopPropagation();
                handleCellSelection(cellKey, index, record.key);
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
                  message.success('添加成功');
                  setOpenPopoverKey(null);
                  fetchSchedules();
                } else {
                  message.error(resp.message || '添加失败');
                }
              } catch (err) {
                message.error('网络错误，添加失败');
              }
            };

            if (multiSelectMode) {
              // 多选模式下的空白单元格
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

            // 普通模式下的空白单元格
            return (
              <Popover
                placement="rightTop"
                title={null}
                content={
                  <NewSchedulePopoverContent
                    onAdd={(studentName) => handleAddSchedule(studentName, day, time)}
                    onCancel={() => handleOpenChange(false)}
                  />
                }
                trigger={multiSelectMode ? "contextMenu" : "click"}
                open={openPopoverKey === cellKey}
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
              {students.map((student, idx) => (
                <div key={student.id}>
                  <SchedulePopoverContent
                    schedule={student}
                    onDelete={() => handleDeleteSchedule(student.id)}
                    onUpdateName={(newName) => handleSaveStudentName(student, newName)}
                    onExport={handleExportStudentSchedule}
                    timetable={timetable}
                  />
                  {idx < students.length - 1 && <hr style={{ margin: '8px 0' }} />}
                </div>
              ))}
            </div>
          );

          return (
            <Popover
              placement="rightTop"
              title={null}
              content={popoverContent}
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={handleOpenChange}
            >
              <div style={{
                height: '100%',
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                cursor: 'pointer'
              }}>
                {students.map((student, idx) => (
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
                    {student.studentName.length > 4 ?
                      student.studentName.substring(0, 3) + '…' :
                      student.studentName
                    }
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

  const generateTableData = () => {
    const data = [];
    const groupedSchedules = {};

    currentWeekSchedules.forEach(schedule => {
      const timeKey = `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`;

      let dayKey;
      if (timetable.isWeekly) {
        dayKey = schedule.dayOfWeek.toLowerCase();
      } else {
        // 对于日期范围课表，根据日期计算星期几
        const scheduleDate = dayjs(schedule.scheduleDate);
        const dayIndex = scheduleDate.day(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        dayKey = dayNames[dayIndex];
      }

      if (!groupedSchedules[timeKey]) {
        groupedSchedules[timeKey] = {};
      }
      if (!groupedSchedules[timeKey][dayKey]) {
        groupedSchedules[timeKey][dayKey] = [];
      }
      groupedSchedules[timeKey][dayKey].push(schedule);
    });

    timeSlots.forEach((timeSlot, index) => {
      const rowData = {
        key: index,
        time: timeSlot,
      };

      weekDays.forEach((day, dayIndex) => {
        const daySchedules = groupedSchedules[timeSlot]?.[day.key] || [];
        rowData[day.key] = daySchedules;
      });

      data.push(rowData);
    });

    return data;
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
  };

  const colorPalette = [
    '#E6F7FF', '#F0F5FF', '#F6FFED', '#FFFBE6', '#FFF1F0', '#FCF4FF',
    '#FFF0F6', '#F9F0FF', '#FFF7E6', '#FFFAE6', '#D9F7BE', '#B5F5EC',
    '#ADC6FF', '#D3ADF7', '#FFADD2', '#FFD8BF'
  ];

  const studentColorMap = new Map();
  const allStudentNames = [...new Set(allSchedules.map(s => s.studentName).filter(Boolean))];
  allStudentNames.forEach((name, index) => {
    studentColorMap.set(name, colorPalette[index % colorPalette.length]);
  });

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
      </div>

      {/* 多选功能控制区域 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        padding: '8px 12px',
        backgroundColor: multiSelectMode ? '#f0f9ff' : '#fafafa',
        borderRadius: '6px',
        border: multiSelectMode ? '1px solid #bae7ff' : '1px solid #f0f0f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        {multiSelectMode && selectedCells.size > 0 && (
          <Button 
            type="primary"
            size="small"
            onClick={openBatchScheduleModal}
          >
            批量排课
          </Button>
        )}
      </div>
      
      <div className="compact-timetable-container">
        <Table
          columns={generateColumns()}
          dataSource={generateTableData()}
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
        title="导出学生课时"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(exportContent)}
          >
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
    </div>
  );
};

export default ViewTimetable;