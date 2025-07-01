import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message, Pagination, Space, Tag, Popover } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules } from '../services/timetable';
import dayjs from 'dayjs';

const ViewTimetable = ({ user }) => {
  const [timetable, setTimetable] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  
  const navigate = useNavigate();
  const { timetableId } = useParams();

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
    fetchTimetable();
  }, [timetableId]);

  useEffect(() => {
    if (timetable) {
      fetchSchedules();
    }
  }, [timetable, currentWeek]);

  const fetchTimetable = async () => {
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        setTimetable(response.data);
        // 计算总周数
        if (!response.data.isWeekly && response.data.startDate && response.data.endDate) {
          const start = dayjs(response.data.startDate);
          const end = dayjs(response.data.endDate);
          const weeks = Math.ceil(end.diff(start, 'day') / 7);
          setTotalWeeks(weeks);
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
      const week = timetable?.isWeekly ? null : currentWeek;
      const response = await getTimetableSchedules(timetableId, week);
      if (response.success) {
        setSchedules(response.data);
      } else {
        message.error(response.message || '获取课程安排失败');
      }
    } catch (error) {
      message.error('获取课程安排失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 获取当前周的日期范围
  const getCurrentWeekDates = () => {
    if (!timetable || timetable.isWeekly) return null;
    
    const startDate = dayjs(timetable.startDate);
    const weekStart = startDate.add((currentWeek - 1) * 7, 'day');
    const weekEnd = weekStart.add(6, 'day');
    
    return { start: weekStart, end: weekEnd };
  };

  // 生成表格列
  const generateColumns = () => {
    const weekDates = getCurrentWeekDates();
    
    const columns = [
      {
        title: '时间',
        dataIndex: 'time',
        key: 'time',
        fixed: 'left',
        width: 60,
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
      if (weekDates) {
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
        width: 45,
        className: 'timetable-day-column',
        render: (students) => (
          <div className="time-slot-compact">
            {students && students.length > 0 ? (
              students.map((student, idx) => (
                <Popover
                  key={idx}
                  title="课程详情"
                  content={
                    <div className="course-detail">
                      <div><strong>学员：</strong>{student.studentName}</div>
                      <div><strong>科目：</strong>{student.subject || '未指定'}</div>
                      <div><strong>时间：</strong>{student.startTime} - {student.endTime}</div>
                      {student.note && <div><strong>备注：</strong>{student.note}</div>}
                    </div>
                  }
                  trigger="click"
                  placement="top"
                >
                  <div className="student-tag-compact">
                    {student.studentName.length > 3 ? 
                      student.studentName.substring(0, 3) : 
                      student.studentName
                    }
                  </div>
                </Popover>
              ))
            ) : null}
          </div>
        ),
      });
    });

    return columns;
  };

  // 生成表格数据
  const generateTableData = () => {
    return timeSlots.map((timeSlot, index) => {
      const rowData = {
        key: index,
        time: timeSlot,
      };

      weekDays.forEach((day) => {
        // 过滤出当前时间段和星期的课程
        const daySchedules = schedules.filter(schedule => {
          const scheduleTime = `${schedule.startTime}-${schedule.endTime}`;
          return schedule.dayOfWeek === day.key && scheduleTime === timeSlot;
        });

        rowData[day.key] = daySchedules;
      });

      return rowData;
    });
  };

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
  };

  if (loading && !timetable) {
    return <div>加载中...</div>;
  }

  return (
    <div className="content-container">
      <Card 
        className="timetable-view-card"
        title={
          <div className="card-header-simple" style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              style={{ marginRight: '16px' }}
            />
            <Space>
              <CalendarOutlined />
              <span>{timetable?.name}</span>
              {!timetable?.isWeekly && (
                <span className="week-info">
                  第 {currentWeek} 周 / 共 {totalWeeks} 周
                </span>
              )}
            </Space>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/input-timetable/${timetableId}`)}
            size="small"
          >
            录入课程
          </Button>
        }
        bodyStyle={{ padding: 0 }}
      >
        <div className="compact-timetable-container">
          <Table
            columns={generateColumns()}
            dataSource={generateTableData()}
            pagination={false}
            loading={loading}
            size="small"
            bordered
            className="compact-timetable"
            scroll={{ x: 'max-content' }}
          />
        </div>

        {!timetable?.isWeekly && totalWeeks > 1 && (
          <div className="week-pagination-container" style={{ padding: '16px' }}>
            <Pagination
              current={currentWeek}
              total={totalWeeks}
              pageSize={1}
              onChange={handleWeekChange}
              simple
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ViewTimetable; 