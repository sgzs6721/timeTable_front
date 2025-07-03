import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message, Pagination, Space, Tag, Popover } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, deleteSchedule } from '../services/timetable';
import dayjs from 'dayjs';

const SchedulePopoverContent = ({ schedule, onDelete, timetable }) => (
  <div style={{ width: '160px', display: 'flex', flexDirection: 'column' }}>
    <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>学生:</strong> {schedule.studentName}</p>
    
    {timetable.isWeekly ? (
      <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>星期:</strong> {schedule.dayOfWeek}</p>
    ) : (
      <p style={{ margin: '4px 0', textAlign: 'left' }}><strong>日期:</strong> {schedule.scheduleDate}</p>
    )}

    <p style={{ margin: '4px 0', textAlign: 'left' }}>
      <strong>时间:</strong> {schedule.startTime.substring(0,5)} - {schedule.endTime.substring(0,5)}
    </p>
    <Button 
      type="primary" 
      danger 
      onClick={onDelete} 
      style={{ marginTop: '12px', alignSelf: 'center' }}
      size="small"
    >
      删除
    </Button>
  </div>
);

const ViewTimetable = ({ user }) => {
  const [timetable, setTimetable] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  
  const navigate = useNavigate();
  const { timetableId } = useParams();
  const location = useLocation();

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

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const response = await deleteSchedule(timetableId, scheduleId);
      if (response.success) {
        message.success('删除成功');
        setOpenPopoverKey(null);
        fetchSchedules(); // Refresh the view
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
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
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (students, record) => {
          if (!students || students.length === 0) {
            return null;
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

  // 生成表格数据
  const generateTableData = () => {
    return timeSlots.map((timeSlot, index) => {
      const rowData = {
        key: index,
        time: timeSlot,
      };

      weekDays.forEach((day, dayIndex) => {
        // 过滤出当前时间段和星期的课程
        const daySchedules = schedules.filter(schedule => {
          const scheduleTime = `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`;
          if (scheduleTime !== timeSlot) return false;

          if (timetable.isWeekly) {
            // For weekly timetables, match by dayOfWeek
            return schedule.dayOfWeek && schedule.dayOfWeek.toLowerCase() === day.key;
          } else {
            // For date-range timetables, match by the actual date
            if (!schedule.scheduleDate) return false;
            const scheduleDay = dayjs(schedule.scheduleDate).day(); // Sunday is 0, Monday is 1...
            const targetDay = (dayIndex + 1) % 7; // Our weekDays array starts with Monday as 0. Let's align.
            return scheduleDay === targetDay;
          }
        });

        rowData[day.key] = daySchedules;
      });

      return rowData;
    });
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
  const allStudentNames = [...new Set(schedules.map(s => s.studentName).filter(Boolean))];
  allStudentNames.forEach((name, index) => {
    studentColorMap.set(name, colorPalette[index % colorPalette.length]);
  });

  if (loading && !timetable) {
    return <div>加载中...</div>;
  }

  return (
    <div className="content-container">
      <Card
        className="timetable-view-card"
        title={
          <div className="card-header-simple" style={{ display: 'flex', alignItems: 'center' }}>
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
          <Space>
            <Button
              type="link"
              onClick={() => navigate('/dashboard')}
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              返回
            </Button>
          </Space>
        }
        headStyle={{ borderBottom: 'none' }}
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