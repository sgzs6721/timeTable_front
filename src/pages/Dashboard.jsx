import React, { useState, useEffect } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Modal, Table, Divider, Tag } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules } from '../services/timetable';
import dayjs from 'dayjs';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todaysCoursesModalVisible, setTodaysCoursesModalVisible] = useState(false);
  const [todaysCoursesData, setTodaysCoursesData] = useState([]);
  const [modalMainTitle, setModalMainTitle] = useState('');
  const [modalSubTitle, setModalSubTitle] = useState('');
  const [todaysSchedulesForCopy, setTodaysSchedulesForCopy] = useState([]);
  const [tomorrowsCoursesData, setTomorrowsCoursesData] = useState([]);
  const [tomorrowsSchedulesForCopy, setTomorrowsSchedulesForCopy] = useState([]);
  const [modalSubTitleTomorrow, setModalSubTitleTomorrow] = useState('');
  const [studentColorMap, setStudentColorMap] = useState({});
  const navigate = useNavigate();

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
        setTimetables(response.data);
      } catch (error) {
        message.error('获取课表列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetables();
  }, []);

  const handleShowTodaysCourses = async (timetable) => {
    try {
      message.loading({ content: '正在查询课程安排...', key: 'courses' });
      const response = await getTimetableSchedules(timetable.id);

      if (!response.success) {
        message.destroy('courses');
        message.error(response.message || '获取课程安排失败');
        return;
      }
      const allSchedules = response.data;
      
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
          const weekDayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const dayOfWeek = weekDayMap[targetDate.day()];
          schedulesForDay = allSchedules.filter(s => s.dayOfWeek === dayOfWeek);
          subTitle = `${targetDate.isSame(dayjs(), 'day') ? '今日' : '明日'}课程 (${dayOfWeek})`;
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
            time2: rightSlot ? rightSlot.displayTime : '',
            studentName2: rightSchedule ? rightSchedule.studentName : '',
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

    } catch (error) {
      message.destroy('courses');
      message.error('查询失败，请检查网络连接');
    }
  };

  // 生成复制文本
  const generateCopyText = (schedules) => {
    if (!schedules || schedules.length === 0) return '没有可复制的课程';
    return schedules.map(schedule => {
        const startHour = parseInt(schedule.startTime.substring(0, 2));
        const displayTime = `${startHour}-${startHour + 1}`;
        return `${displayTime}, ${schedule.studentName}`;
    }).join('\n');
  };

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
          setTimetables(timetables.filter((item) => item.id !== id));
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
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

  const handleAdminPanel = () => {
    navigate('/admin');
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
          padding: '1px'
        }
      }),
      render: (text) => text || '',
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
          padding: '1px'
        }
      }),
      render: (text) => text || '',
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
        <h1 style={{ margin: 0, fontWeight: '700' }}>我的课表</h1>
        <Button 
          type="link" 
          icon={<PlusOutlined />} 
          onClick={handleCreateTimetable}
          style={{ position: 'absolute', right: 0 }}
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
              actions={[
                <Button type="link" onClick={() => handleShowTodaysCourses(item)}>今明课程</Button>,
                <Button type="link" onClick={() => handleInputTimetable(item)}>录入</Button>,
                <Button type="link" onClick={() => handleViewTimetable(item.id)}>查看</Button>,
                <Button type="link" danger onClick={() => handleDeleteTimetable(item.id)}>删除</Button>,
              ]}
            >
              <List.Item.Meta
                className="timetable-item-meta"
                avatar={
                  <Avatar
                    shape="square"
                    size={48}
                    icon={<CalendarOutlined />}
                    style={{
                      backgroundColor: item.isWeekly ? '#e6f7ff' : '#f6ffed',
                      color: item.isWeekly ? '#1890ff' : '#52c41a',
                      border: `1px solid ${item.isWeekly ? '#91d5ff' : '#b7eb8f'}`,
                      borderRadius: '8px'
                    }}
                  />
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <a onClick={() => handleViewTimetable(item.id)}>{item.name}</a>
                    <Tag color={item.isWeekly ? 'blue' : 'green'}>
                      {item.isWeekly ? '周固定课表' : '日期范围课表'}
                    </Tag>
                  </div>
                }
                description={
                  <>
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      {item.isWeekly ? (
                        <div>星期一至星期日</div>
                      ) : (
                        <div>{`${item.startDate} 至 ${item.endDate}`}</div>
                      )}
                      <div>创建于: {dayjs(item.createdAt).format('YYYY-MM-DD')}</div>
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
        onCancel={() => setTodaysCoursesModalVisible(false)}
        width={600}
        footer={null}
      >
        {todaysCoursesData.length > 0 && (
          <>
            <div style={{ textAlign: 'left', fontSize: '14px', color: '#8c8c8c', marginBottom: '8px' }}>{modalSubTitle}</div>
            <Table
              dataSource={todaysCoursesData}
              pagination={false}
              bordered
              size="small"
              columns={getColumns(studentColorMap)}
            />
            <div style={{ textAlign: 'right', marginTop: '10px' }}>
              <Button
                icon={<CopyOutlined />}
                type="primary"
                onClick={() => copyToClipboard(generateCopyText(todaysSchedulesForCopy))}
              >
                复制今日
              </Button>
            </div>
          </>
        )}

        {tomorrowsCoursesData.length > 0 && (
          <>
            <Divider />
            <div style={{ textAlign: 'left', fontSize: '14px', color: '#8c8c8c', marginBottom: '8px' }}>{modalSubTitleTomorrow}</div>
            <Table
              dataSource={tomorrowsCoursesData}
              pagination={false}
              bordered
              size="small"
              columns={getColumns(studentColorMap)}
            />
            <div style={{ textAlign: 'right', marginTop: '10px' }}>
              <Button
                icon={<CopyOutlined />}
                type="primary"
                onClick={() => copyToClipboard(generateCopyText(tomorrowsSchedulesForCopy))}
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
            onClick={() => setTodaysCoursesModalVisible(false)}
            style={{ minWidth: '100px' }}
          >
            关闭
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard; 