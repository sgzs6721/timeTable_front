import React, { useState, useEffect, useMemo } from 'react';
import { Button, Table, message, Space, Tag, Spin, Pagination } from 'antd';
import { LeftOutlined, CalendarOutlined, LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, getBatchTimetablesInfo } from '../services/timetable';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import localeData from 'dayjs/plugin/localeData';
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

const MergePreview = ({ user }) => {
  const [mergedTimetable, setMergedTimetable] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timetableNames, setTimetableNames] = useState([]);
  const [timetablesData, setTimetablesData] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [weeksList, setWeeksList] = useState([]);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');

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
          setCurrentWeekIndex(0);
        }
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
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {currentDate.format('MM/DD')}
            </div>
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
              color: '#333',
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
            {student.studentName.length > 4 ?
              student.studentName.substring(0, 3) + '…' :
              student.studentName
            }
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
    <div className="page-container">
      <div style={{ position: 'relative', marginBottom: '1.5rem', minHeight: 48, display: 'flex', alignItems: 'center' }}>
        <Button
          type="default"
          shape="circle"
          onClick={() => navigate(-1)}
          icon={<LeftOutlined style={{ fontSize: 20 }} />}
          style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }}
        />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarOutlined style={{ fontSize: '22px', color: '#8a2be2' }} />
          <h1 style={{ margin: 0, fontSize: 22, textAlign: 'center', whiteSpace: 'nowrap' }}>{mergedTimetable?.name}</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Tag color={mergedTimetable?.isWeekly ? 'blue' : 'green'}>
            {mergedTimetable?.isWeekly ? '周固定课表' : '日期范围课表'}
          </Tag>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', padding: '12px', background: '#f6f8fa', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          <strong>合并来源：</strong>
          {timetablesData.map((table, index) => (
            <span key={table.id}>
              {table.name}
              {table.username && (
                <span style={{ color: '#999' }}>
                  ({table.username})
                </span>
              )}
              {index < timetablesData.length - 1 && '、'}
            </span>
          ))}
        </div>
        {!mergedTimetable?.isWeekly && mergedTimetable?.startDate && mergedTimetable?.endDate && (
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            日期范围：{mergedTimetable.startDate} 至 {mergedTimetable.endDate}，包含 {allSchedules.length} 个课程
          </div>
        )}
        {mergedTimetable?.isWeekly && (
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            包含 {allSchedules.length} 个课程安排
          </div>
        )}
      </div>

      {/* 日期范围课表的周导航 */}
      {!mergedTimetable?.isWeekly && weeksList.length > 0 && (
        <div style={{ 
          marginBottom: '1rem', 
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
      
      <div className="compact-timetable-container">
        <Table
          columns={generateColumns()}
          dataSource={generateTableData()}
          pagination={false}
          size="small"
          bordered
          className="compact-timetable"
        />
      </div>
    </div>
  );
};

export default MergePreview; 