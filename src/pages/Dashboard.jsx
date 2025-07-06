import React, { useState, useEffect } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Tag, Modal } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules } from '../services/timetable';
import dayjs from 'dayjs';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todaysCoursesModalVisible, setTodaysCoursesModalVisible] = useState(false);
  const [todaysCoursesContent, setTodaysCoursesContent] = useState('');
  const navigate = useNavigate();

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
      message.loading({ content: '正在查询今日课程...', key: 'todays_courses' });
      const response = await getTimetableSchedules(timetable.id);
      
      if (!response.success) {
        message.destroy('todays_courses');
        message.error(response.message || '获取课程安排失败');
        return;
      }

      const allSchedules = response.data;
      let todaysSchedules = [];
      let header = '';

      if (timetable.isWeekly) {
        const weekDayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const todayDayOfWeek = weekDayMap[dayjs().day()];
        todaysSchedules = allSchedules.filter(s => s.dayOfWeek === todayDayOfWeek);
        header = `${timetable.name} - 今日课程 (${todayDayOfWeek}):\n`;
      } else {
        const todayDate = dayjs().format('YYYY-MM-DD');
        todaysSchedules = allSchedules.filter(s => s.scheduleDate === todayDate);
        header = `${timetable.name} - 今日课程 (${todayDate}):\n`;
      }

      message.destroy('todays_courses');

      if (todaysSchedules.length === 0) {
        message.info('今天没有安排课程');
        return;
      }

      const sortedSchedules = todaysSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
      const content = header + sortedSchedules.map(s => `${s.studentName} ${s.startTime.substring(0, 5)}-${s.endTime.substring(0, 5)}`).join('\n');
      
      setTodaysCoursesContent(content);
      setTodaysCoursesModalVisible(true);

    } catch (error) {
      message.destroy('todays_courses');
      message.error('查询失败，请检查网络连接');
    }
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
                <Button type="link" onClick={() => handleShowTodaysCourses(item)}>今日课程</Button>,
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
        title="今日课程安排"
        open={todaysCoursesModalVisible}
        onCancel={() => setTodaysCoursesModalVisible(false)}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(todaysCoursesContent);
              message.success('已复制到剪贴板');
            }}
          >
            复制
          </Button>,
          <Button key="close" onClick={() => setTodaysCoursesModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>{todaysCoursesContent}</pre>
      </Modal>
    </div>
  );
};

export default Dashboard; 