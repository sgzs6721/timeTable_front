import React, { useState, useEffect, useRef } from 'react';
import { Button, Table, message, Space, Tag, Spin } from 'antd';
import { LeftOutlined, CalendarOutlined, LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTimetableSchedules, getBatchTimetablesInfo } from '../services/timetable';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import localeData from 'dayjs/plugin/localeData';
import html2canvas from 'html2canvas';
import { isWeChatBrowser } from '../utils/browserDetect';
import './ViewTimetable.css';

// 扩展 dayjs 插件
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.extend(localeData);

// 设置周一为一周的开始
dayjs.locale({
  ...dayjs.Ls.en,
  weekStart: 1
});

const sourceNameColors = ['#10239e','#ad6800','#006d75','#237804','#9e1068','#a8071a','#391085','#0050b3'];

const MergePreview = ({ user }) => {
  const [mergedTimetable, setMergedTimetable] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timetableNames, setTimetableNames] = useState([]);
  const [timetablesData, setTimetablesData] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [weeksList, setWeeksList] = useState([]);
  const [timetableColorMap, setTimetableColorMap] = useState({});
  const tableRef = useRef(null);



  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');

  // 兼容移动端的复制函数
  const copyToClipboard = async (text) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
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

      if (!successful) {
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

  // 星期定义 - 确保顺序和dayjs的映射一致
  const weekDays = [
    { key: 'monday', label: '周一' },
    { key: 'tuesday', label: '周二' },
    { key: 'wednesday', label: '周三' },
    { key: 'thursday', label: '周四' },
    { key: 'friday', label: '周五' },
    { key: 'saturday', label: '周六' },
    { key: 'sunday', label: '周日' },
  ];

  const handleShowDayCourses = (day, dayIndex) => {
    let schedulesForDay = [];
    let targetDate = null;

    if (mergedTimetable.isWeekly) {
      schedulesForDay = allSchedules.filter(s => s.dayOfWeek.toLowerCase() === day.key);
      // 对于周固定课表，计算本周对应的日期
      const today = dayjs();
      const currentWeekStart = today.startOf('week');
      targetDate = currentWeekStart.add(dayIndex, 'day');
    } else {
      const currentWeek = weeksList[currentWeekIndex];
      if (currentWeek) {
        const weekStart = dayjs(currentWeek.start);
        targetDate = weekStart.add(dayIndex, 'day');
        const dateStr = targetDate.format('YYYY-MM-DD');
        
        // 过滤当前周的课程
        const weekEnd = dayjs(currentWeek.end);
        const weekSchedules = allSchedules.filter(schedule => {
          if (schedule.scheduleDate) {
            const scheduleDate = dayjs(schedule.scheduleDate);
            return scheduleDate.isSameOrAfter(weekStart) && scheduleDate.isSameOrBefore(weekEnd);
          }
          return false;
        });
        
        schedulesForDay = weekSchedules.filter(s => s.scheduleDate === dateStr);
      }
    }

    const sortedSchedules = schedulesForDay.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (sortedSchedules.length === 0) {
      message.info('当天没有课程');
      return;
    }

    // 直接复制课程信息
    const copyText = generateCopyTextForDay(sortedSchedules, targetDate, day.label);
    copyToClipboard(copyText);
    message.success('已复制合并课程信息');
  };

  const generateCopyTextForDay = (schedules, targetDate, dayLabel) => {
    if (!schedules || schedules.length === 0) return '没有可复制的课程';
    
    // 格式化日期为：2025年07月14日
    let formattedDate = '';
    if (targetDate) {
      formattedDate = targetDate.format('YYYY年MM月DD日');
    }
    
    // 构建标题
    const title = formattedDate ? `${formattedDate} ${dayLabel}课程安排` : `${dayLabel}课程安排`;
    
    // 按课表ID分组课程，然后按教练输出
    const schedulesByTimetable = {};
    schedules.forEach(schedule => {
      const timetableId = schedule.timetableId;
      if (!schedulesByTimetable[timetableId]) {
        schedulesByTimetable[timetableId] = [];
      }
      schedulesByTimetable[timetableId].push(schedule);
    });
    
    // 构建每个教练的课程列表
    const coachSections = [];
    Object.keys(schedulesByTimetable).forEach(timetableId => {
      const timetableSchedules = schedulesByTimetable[timetableId];
      const timetableInfo = timetablesData.find(t => t.id === parseInt(timetableId));
      const coachName = timetableInfo ? (timetableInfo.nickname || timetableInfo.username) : '教练';
      
      // 按时间排序
      const sortedSchedules = timetableSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      // 构建课程列表
      const courseList = sortedSchedules.map(schedule => {
        const startHour = parseInt(schedule.startTime.substring(0, 2));
        const endHour = startHour + 1;
        return `${startHour}-${endHour} ${schedule.studentName}`;
      }).join('\n');
      
      coachSections.push(`${coachName}：\n${courseList}`);
    });
    
    return `${title}\n${coachSections.join('\n\n')}`;
  };

  const handleExport = () => {
    const tableNode = tableRef.current;
    if (!tableNode) {
      message.error('无法导出，未找到表格元素');
      return;
    }

    message.loading({ content: '正在生成图片...', key: 'exporting' });

    // 1. 克隆节点
    const clonedNode = tableNode.cloneNode(true);

    // 2. 在克隆体上修改
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
      link.download = `合并课表预览-${new Date().toLocaleString()}.png`;
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

  useEffect(() => {
    if (!idsParam) {
      message.error('缺少课表ID参数');
      navigate(-1);
      return;
    }
    fetchMergedData();
  }, [idsParam]);

  // 生成周列表
  const generateWeeksList = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const weeks = [];

    // 找到开始日期所在周的周一
    let currentWeekStart = start.startOf('week'); // 现在已经设置了weekStart: 1，所以这里会正确找到周一

    while (currentWeekStart.isBefore(end) || currentWeekStart.isSame(end)) {
      const weekEnd = currentWeekStart.add(6, 'day');
      weeks.push({
        start: currentWeekStart.format('YYYY-MM-DD'),
        end: weekEnd.format('YYYY-MM-DD'),
        label: `${currentWeekStart.format('MM/DD')} - ${weekEnd.format('MM/DD')}`
      });
      currentWeekStart = currentWeekStart.add(1, 'week');
    }

    return weeks;
  };

  const fetchMergedData = async () => {
    try {
      const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length === 0) {
        message.error('无效的课表ID');
        navigate(-1);
        return;
      }

      // 并行获取课表信息（包含用户信息）和排课数据
      const timetableInfoPromise = getBatchTimetablesInfo(ids);
      const schedulePromises = ids.map(id => getTimetableSchedules(id));

      const [timetableInfoResult, scheduleResults] = await Promise.all([
        timetableInfoPromise,
        Promise.all(schedulePromises)
      ]);

      // 检查请求是否成功
      if (!timetableInfoResult.success) {
        message.error('获取课表信息失败');
        navigate(-1);
        return;
      }

      const failedSchedules = scheduleResults.filter(result => !result.success);
      if (failedSchedules.length > 0) {
        message.error('获取课表数据失败');
        navigate(-1);
        return;
      }

      const timetables = timetableInfoResult.data;
      const schedules = scheduleResults.map(result => result.data);

      // 检查课表类型是否一致
      const firstType = timetables[0]?.isWeekly;
      const allSameType = timetables.every(table => table.isWeekly === firstType);

      if (!allSameType) {
        message.error('只能合并相同类型的课表');
        navigate(-1);
        return;
      }

      // 合并所有排课数据
      const mergedSchedules = schedules.flat();

      // 创建合并后的课表信息
      const baseTimetable = { ...timetables[0] };
      const names = timetables.map(t => t.name);
      baseTimetable.name = `合并预览`; // 修改标题

      const colorMap = {};
      timetables.forEach((t, index) => {
        colorMap[t.id] = sourceNameColors[index % sourceNameColors.length];
      });
      setTimetableColorMap(colorMap);

      // 如果是日期范围课表，合并日期范围并生成周列表
      if (!baseTimetable.isWeekly) {
        const allStartDates = timetables
          .map(t => t.startDate)
          .filter(date => date)
          .map(date => dayjs(date));

        const allEndDates = timetables
          .map(t => t.endDate)
          .filter(date => date)
          .map(date => dayjs(date));

        if (allStartDates.length > 0 && allEndDates.length > 0) {
          const mergedStartDate = allStartDates.reduce((min, date) =>
            date.isBefore(min) ? date : min
          ).format('YYYY-MM-DD');

          const mergedEndDate = allEndDates.reduce((max, date) =>
            date.isAfter(max) ? date : max
          ).format('YYYY-MM-DD');

          baseTimetable.startDate = mergedStartDate;
          baseTimetable.endDate = mergedEndDate;

          // 生成周列表
          const weeks = generateWeeksList(mergedStartDate, mergedEndDate);
          setWeeksList(weeks);

          // --- 新增：定位到当天所在的周 ---
          const today = dayjs();
          if (today.isSameOrAfter(mergedStartDate) && today.isSameOrBefore(mergedEndDate)) {
            const currentWeekIndex = weeks.findIndex(week => 
              today.isSameOrAfter(dayjs(week.start)) && today.isSameOrBefore(dayjs(week.end))
            );
            if (currentWeekIndex !== -1) {
              setCurrentWeekIndex(currentWeekIndex);
            }
          }
          // --- 新增结束 ---
        }
      } else {
        setWeeksList([]); // 周固定课表则清空周列表
      }

      setMergedTimetable(baseTimetable);
      setAllSchedules(mergedSchedules);
      setTimetableNames(names);
      setTimetablesData(timetables); // 现在包含了username字段
    } catch (error) {
      message.error('获取数据失败，请检查网络连接');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const generateColumns = () => {
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

    // 统一按星期几显示
    weekDays.forEach((day, index) => {
      const currentWeek = weeksList[currentWeekIndex];
      let columnTitle = day.label;

      // 如果是日期范围课表，在星期几下方显示具体日期
      if (!mergedTimetable?.isWeekly && currentWeek) {
        const weekStart = dayjs(currentWeek.start);
        // 直接使用 index，因为 weekDays 的顺序就是周一(0)到周日(6)
        const currentDate = weekStart.add(index, 'day');

        columnTitle = (
          <div 
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => handleShowDayCourses(day, index)}
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
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => handleShowDayCourses(day, index)}
          >
            {day.label}
          </div>
        );
      }

      columns.push({
        title: columnTitle,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (students) => renderStudentCell(students),
      });
    });

    return columns;
  };

  // 渲染学生单元格
  const renderStudentCell = (students) => {
    if (!students || students.length === 0) {
      return <div style={{ height: '48px' }} />;
    }

    return (
      <div style={{
        height: '100%',
        minHeight: '48px',
        display: 'flex',
        flexDirection: 'column',
        width: '100%'
      }}>
        {students.map((student, idx) => (
          <div
            key={`${student.id}-${idx}`}
            style={{
              backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: timetableColorMap[student.timetableId] || '#333',
              fontSize: '12px',
              wordBreak: 'break-word',
              lineHeight: '1.2',
              borderTop: idx > 0 ? '1px solid #fff' : 'none',
              padding: '2px',
            }}
            title={`${student.studentName} (来自: ${student.sourceTimetable || '未知'})${
              student.scheduleDate ? ` - ${student.scheduleDate}` : ''
            }`}
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
  };

  const generateTableData = () => {
    const data = [];
    const groupedSchedules = {};

    // 为每个排课添加来源课表信息
    const timetableIdToNameMap = new Map();
    timetablesData.forEach(t => {
      timetableIdToNameMap.set(t.id, t.name);
    });

    // 从URL参数解析课表ID，按顺序对应timetableNames
    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    ids.forEach((id, index) => {
      if (index < timetableNames.length) {
        timetableIdToNameMap.set(id, timetableNames[index]);
      }
    });

    const schedulesWithSource = allSchedules.map(schedule => ({
      ...schedule,
      sourceTimetable: timetableIdToNameMap.get(schedule.timetableId) || '未知'
    }));

    // 过滤当前周的课程
    let filteredSchedules = schedulesWithSource;
    if (!mergedTimetable?.isWeekly && weeksList[currentWeekIndex]) {
      const currentWeek = weeksList[currentWeekIndex];
      const weekStart = dayjs(currentWeek.start);
      const weekEnd = dayjs(currentWeek.end);

      filteredSchedules = schedulesWithSource.filter(schedule => {
        if (schedule.scheduleDate) {
          const scheduleDate = dayjs(schedule.scheduleDate);
          return scheduleDate.isSameOrAfter(weekStart) && scheduleDate.isSameOrBefore(weekEnd);
        }
        return false;
      });
    }

    filteredSchedules.forEach(schedule => {
      const timeKey = `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`;

      let dayKey;
      if (mergedTimetable?.isWeekly) {
        // 周固定课表：使用dayOfWeek字段
        dayKey = schedule.dayOfWeek.toLowerCase();
      } else {
        // 日期范围课表：根据scheduleDate计算星期几
        if (schedule.scheduleDate) {
          const scheduleDate = dayjs(schedule.scheduleDate);
          const dayIndex = scheduleDate.day(); // 0=Sunday, 1=Monday, ... 6=Saturday
          // 映射到我们的星期几key
          const dayKeyMapping = {
            0: 'sunday',    // 周日
            1: 'monday',    // 周一
            2: 'tuesday',   // 周二
            3: 'wednesday', // 周三
            4: 'thursday',  // 周四
            5: 'friday',    // 周五
            6: 'saturday'   // 周六
          };
          dayKey = dayKeyMapping[dayIndex];
        } else {
          return;
        }
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

      weekDays.forEach((day) => {
        const daySchedules = groupedSchedules[timeSlot]?.[day.key] || [];
        rowData[day.key] = daySchedules;
      });

      data.push(rowData);
    });

    return data;
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

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => navigate(-1)}
          icon={<LeftOutlined style={{ fontSize: 20 }} />}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: 0
          }}
        />
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Space align="center" size="large">
            <CalendarOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
            <h1 style={{ margin: 0 }}>{mergedTimetable?.name}</h1>
          </Space>
        </div>

      </div>

      <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: '8px', marginBottom: '0.5rem' }}>
        <div style={{ marginBottom: 8, color: '#666' }}>
          <strong>合并来源：</strong>
          {timetablesData.map((table, index) => (
            <span key={table.id}>
              <span style={{ color: timetableColorMap[table.id] }}>
                {table.name}
              </span>
              {(table.nickname || table.username) && (
                <span style={{ color: timetableColorMap[table.id] }}>
                  ({table.nickname || table.username})
                </span>
              )}
              {index < timetablesData.length - 1 && '、'}
            </span>
          ))}
        </div>
        {!mergedTimetable?.isWeekly && mergedTimetable?.startDate && mergedTimetable?.endDate && (
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            日期范围：{mergedTimetable.startDate} 至 {mergedTimetable.endDate}，包含 {allSchedules.length} 个课程
            {!isWeChatBrowser() && (
              <a
                onClick={handleExport}
                style={{
                  color: '#1890ff',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  fontSize: '12px'
                }}
              >
                导出
              </a>
            )}
          </div>
        )}
        {mergedTimetable?.isWeekly && (
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            包含 {allSchedules.length} 个课程安排
            {!isWeChatBrowser() && (
              <a
                onClick={handleExport}
                style={{
                  color: '#1890ff',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  fontSize: '12px'
                }}
              >
                导出
              </a>
            )}
          </div>
        )}
      </div>

      <div className="compact-timetable-container" ref={tableRef} style={{ marginTop: '1rem' }}>
        <Table
          columns={generateColumns()}
          dataSource={generateTableData()}
          pagination={false}
          size="small"
          bordered
          className="compact-timetable"
        />
      </div>

      {/* 日期范围课表的周导航 - 移到表格下方 */}
      {!mergedTimetable?.isWeekly && weeksList.length > 0 && (
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px'
        }}>
          <Button
            type="text"
            icon={<LeftCircleOutlined />}
            disabled={currentWeekIndex === 0}
            onClick={() => setCurrentWeekIndex(currentWeekIndex - 1)}
          />
          <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
            第{currentWeekIndex + 1}周，共{weeksList.length}周: {weeksList[currentWeekIndex]?.label}
          </Tag>
          <Button
            type="text"
            icon={<RightCircleOutlined />}
            disabled={currentWeekIndex === weeksList.length - 1}
            onClick={() => setCurrentWeekIndex(currentWeekIndex + 1)}
          />
        </div>
      )}


    </div>
  );
};

export default MergePreview;