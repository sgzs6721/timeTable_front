import React, { useState, useEffect, useMemo } from 'react';
import { Button, Table, message, Space, Tag, Spin } from 'antd';
import { LeftOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules } from '../services/timetable';
import dayjs from 'dayjs';
import './ViewTimetable.css';

const MergePreview = ({ user }) => {
  const [mergedTimetable, setMergedTimetable] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timetableNames, setTimetableNames] = useState([]);

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

  useEffect(() => {
    if (!idsParam) {
      message.error('缺少课表ID参数');
      navigate(-1);
      return;
    }
    fetchMergedData();
  }, [idsParam]);

  const fetchMergedData = async () => {
    try {
      const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length === 0) {
        message.error('无效的课表ID');
        navigate(-1);
        return;
      }

      // 并行获取所有课表信息和排课数据
      const timetablePromises = ids.map(id => getTimetable(id));
      const schedulePromises = ids.map(id => getTimetableSchedules(id));

      const [timetableResults, scheduleResults] = await Promise.all([
        Promise.all(timetablePromises),
        Promise.all(schedulePromises)
      ]);

      // 检查所有请求是否成功
      const failedTimetables = timetableResults.filter(result => !result.success);
      const failedSchedules = scheduleResults.filter(result => !result.success);

      if (failedTimetables.length > 0 || failedSchedules.length > 0) {
        message.error('获取课表数据失败');
        navigate(-1);
        return;
      }

      const timetables = timetableResults.map(result => result.data);
      const schedules = scheduleResults.map(result => result.data);

      // 合并所有排课数据
      const mergedSchedules = schedules.flat();

      // 使用第一个课表作为基础信息，修改名称
      const baseTimetable = { ...timetables[0] };
      const names = timetables.map(t => t.name);
      baseTimetable.name = `合并预览: ${names.join(' + ')}`;

      setMergedTimetable(baseTimetable);
      setAllSchedules(mergedSchedules);
      setTimetableNames(names);
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

    weekDays.forEach((day) => {
      columns.push({
        title: day.label,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (students) => {
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
                  }}
                  title={`${student.studentName} (来自: ${student.sourceTimetable || '未知'})`}
                >
                  {student.studentName.length > 4 ?
                    student.studentName.substring(0, 3) + '…' :
                    student.studentName
                  }
                </div>
              ))}
            </div>
          );
        },
      });
    });

    return columns;
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

    schedulesWithSource.forEach(schedule => {
      const timeKey = `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`;

      let dayKey;
      if (mergedTimetable?.isWeekly) {
        dayKey = schedule.dayOfWeek.toLowerCase();
      } else {
        // 对于日期范围课表，根据日期计算星期几
        const scheduleDate = dayjs(schedule.scheduleDate);
        const dayIndex = scheduleDate.day();
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
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Button
          type="text"
          onClick={() => navigate(-1)}
          icon={<LeftOutlined style={{ fontSize: 24 }} />}
          style={{ marginRight: '1rem' }}
        />
        <Space align="center" size="large">
          <CalendarOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
          <h1 style={{ margin: 0 }}>{mergedTimetable?.name}</h1>
          <Tag color="orange">预览模式</Tag>
          <Tag color={mergedTimetable?.isWeekly ? 'blue' : 'green'}>
            {mergedTimetable?.isWeekly ? '周固定课表' : '日期范围课表'}
          </Tag>
        </Space>
      </div>

      <div style={{ marginBottom: '1rem', padding: '12px', background: '#f6f8fa', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          <strong>合并来源：</strong>{timetableNames.join('、')}
        </div>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
          此为预览模式，不会保存到数据库。包含 {allSchedules.length} 个课程安排。
        </div>
      </div>
      
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