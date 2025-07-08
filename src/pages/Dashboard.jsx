import React, { useState, useEffect } from 'react';
import { Button, List, Avatar, message, Empty, Spin, Modal, Table, Divider, Tag, Popover, Input, Dropdown, Menu } from 'antd';
import { PlusOutlined, CalendarOutlined, CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimetables, deleteTimetable, getTimetableSchedules, createSchedule, updateSchedule, deleteSchedule, updateTimetable } from '../services/timetable';
import dayjs from 'dayjs';
import EditScheduleModal from '../components/EditScheduleModal';
import './Dashboard.css';

// 新增的组件，用于添加新课程
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

// 新增的组件，用于修改现有课程
const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onCancel, timetable }) => {
  const [name, setName] = React.useState(schedule.studentName);

  return (
    <div style={{ width: '200px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', textAlign: 'left', gap: 4 }}>
        <strong>学生:</strong>
        <Input
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1 }}
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
        <Button size="small" onClick={onCancel}>取消</Button>
        <Button type="primary" danger size="small" onClick={onDelete}>删除</Button>
        <Button size="small" onClick={() => onUpdateName(name)} style={{ backgroundColor: '#faad14', borderColor: '#faad14', color: 'white' }}>修改</Button>
      </div>
    </div>
  );
};

// 活动课表标识组件
const ActiveBadge = () => (
  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', zIndex: 2 }}>
    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#52c41a', display: 'inline-block', marginRight: 4, boxShadow: '0 0 4px #52c41a' }} />
    <span style={{ color: '#52c41a', fontWeight: 600, fontSize: 13 }}>活动</span>
  </div>
);

const Dashboard = ({ user }) => {
  const [timetables, setTimetables] = useState([]);
  const [archivedTimetables, setArchivedTimetables] = useState([]);
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
  
  // 新增状态用于管理弹窗功能
  const [currentTimetable, setCurrentTimetable] = useState(null);
  const [allSchedulesData, setAllSchedulesData] = useState([]);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  
  // 编辑课表名称相关状态
  const [editingTimetableId, setEditingTimetableId] = useState(null);
  const [editingTimetableName, setEditingTimetableName] = useState('');
  
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
        // 假设后端返回的课表有 isArchived 字段
        setTimetables(response.data.filter(t => !t.isArchived));
        setArchivedTimetables(response.data.filter(t => t.isArchived));
      } catch (error) {
        message.error('获取课表列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetables();
  }, []);

  // 设为活动课表
  const handleSetActiveTimetable = (id) => {
    Modal.confirm({
      title: '设为活动课表',
      content: '每个用户只能有一个活动课表，设为活动课表后，原有活动课表将被取消。确定要继续吗？',
      okText: '设为活动课表',
      cancelText: '取消',
      onOk: async () => {
        // TODO: 调用后端接口设为活动课表
        message.success('已设为活动课表');
      },
    });
  };

  // 归档课表
  const handleArchiveTimetable = (id) => {
    Modal.confirm({
      title: '归档课表',
      content: '归档后该课表将从列表中隐藏，可在右上角头像菜单“归档课表”中查看和恢复。确定要归档吗？',
      okText: '归档',
      cancelText: '取消',
      onOk: async () => {
        // TODO: 调用后端接口归档课表
        setTimetables(timetables.filter(t => t.id !== id));
        setArchivedTimetables([...archivedTimetables, timetables.find(t => t.id === id)]);
        message.success('课表已归档');
      },
    });
  };

  // 删除课表
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

  // 操作菜单
  const getActionMenu = (item) => {
    // 假设课表有 isActive 字段
    const isOnlyOne = timetables.length === 1;
    const isActive = item.isActive;
    return (
      <Menu>
        <Menu.Item key="active" disabled={isOnlyOne || isActive} onClick={() => handleSetActiveTimetable(item.id)}>
          设为活动课表
        </Menu.Item>
        <Menu.Item key="archive" onClick={() => handleArchiveTimetable(item.id)}>
          归档
        </Menu.Item>
        <Menu.Item key="delete" danger onClick={() => handleDeleteTimetable(item.id)}>
          删除课表
        </Menu.Item>
      </Menu>
    );
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

  // 开始编辑课表名称
  const handleStartEditTimetableName = (timetableId, currentName) => {
    setEditingTimetableId(timetableId);
    setEditingTimetableName(currentName);
  };

  // 保存课表名称
  const handleSaveTimetableName = async (timetableId) => {
    if (!editingTimetableName.trim()) {
      message.warning('课表名称不能为空');
      return;
    }
    
    try {
      // 获取当前课表的完整信息
      const currentTimetable = timetables.find(t => t.id === timetableId);
      if (!currentTimetable) {
        message.error('找不到对应的课表');
        return;
      }
      
      // 构造完整的更新请求，保持其他字段不变，只修改name
      const updateData = {
        name: editingTimetableName.trim(),
        description: currentTimetable.description || '',
        type: currentTimetable.isWeekly ? 'WEEKLY' : 'DATE_RANGE',
        startDate: currentTimetable.startDate || null,
        endDate: currentTimetable.endDate || null
      };
      
      const response = await updateTimetable(timetableId, updateData);
      
      if (response.success) {
        message.success('课表名称修改成功');
        // 更新本地数据
        setTimetables(timetables.map(item => 
          item.id === timetableId 
            ? { ...item, name: editingTimetableName.trim() }
            : item
        ));
        // 重置编辑状态
        setEditingTimetableId(null);
        setEditingTimetableName('');
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('修改失败，请检查网络连接');
    }
  };

  // 取消编辑课表名称
  const handleCancelEditTimetableName = () => {
    setEditingTimetableId(null);
    setEditingTimetableName('');
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
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `today-1-${record.key}`;
        const targetDate = dayjs();
        
        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time1)}
                  onCancel={() => setOpenPopoverKey(null)}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule1}
                  onDelete={() => handleDeleteSchedule(record.schedule1.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
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
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `today-2-${record.key}`;
        const targetDate = dayjs();
        
        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time2)}
                  onCancel={() => setOpenPopoverKey(null)}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule2}
                  onDelete={() => handleDeleteSchedule(record.schedule2.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
  ];

  const getColumnsForTomorrow = (colorMap) => [
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
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `tomorrow-1-${record.key}`;
        const targetDate = dayjs().add(1, 'day');
        
        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time1)}
                  onCancel={() => setOpenPopoverKey(null)}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule1}
                  onDelete={() => handleDeleteSchedule(record.schedule1.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule1, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
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
          padding: '1px',
          cursor: 'pointer'
        }
      }),
      render: (text, record) => {
        const cellKey = `tomorrow-2-${record.key}`;
        const targetDate = dayjs().add(1, 'day');
        
        if (!text) {
          // 空白单元格 - 添加功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <NewSchedulePopoverContent
                  onAdd={(studentName) => handleAddSchedule(studentName, targetDate, record.time2)}
                  onCancel={() => setOpenPopoverKey(null)}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ height: '32px', width: '100%', cursor: 'pointer' }} />
            </Popover>
          );
        } else {
          // 非空白单元格 - 修改功能
          return (
            <Popover
              placement="top"
              title={null}
              content={
                <SchedulePopoverContent
                  schedule={record.schedule2}
                  onDelete={() => handleDeleteSchedule(record.schedule2.id)}
                  onUpdateName={(newName) => handleUpdateSchedule(record.schedule2, newName)}
                  onCancel={() => setOpenPopoverKey(null)}
                  timetable={currentTimetable}
                />
              }
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={(open) => setOpenPopoverKey(open ? cellKey : null)}
            >
              <div style={{ cursor: 'pointer', padding: '8px 4px' }}>
                {text}
              </div>
            </Popover>
          );
        }
      },
    },
  ];

  // 新增处理函数
  const handleAddSchedule = async (studentName, targetDate, displayTime) => {
    if (!studentName || !studentName.trim()) {
      message.warning('学生姓名不能为空');
      return;
    }

    const [startHour, endHour] = displayTime.split('-');
    const startTime = `${startHour.padStart(2, '0')}:00:00`;
    const endTime = `${endHour.padStart(2, '0')}:00:00`;

    let payload = {
      studentName: studentName.trim(),
      startTime,
      endTime,
      note: '手动添加',
    };

    if (currentTimetable.isWeekly) {
      const weekDayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dayOfWeek = weekDayMap[targetDate.day()];
      payload.dayOfWeek = dayOfWeek;
    } else {
      payload.scheduleDate = targetDate.format('YYYY-MM-DD');
      // 为日期范围课表计算星期几
      const weekDayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      payload.dayOfWeek = weekDayMap[targetDate.day()];
    }

    try {
      const response = await createSchedule(currentTimetable.id, payload);
      if (response.success) {
        message.success('添加成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
      } else {
        message.error(response.message || '添加失败');
      }
    } catch (error) {
      message.error('网络错误，添加失败');
    }
  };

  const handleUpdateSchedule = async (schedule, newName) => {
    if (!newName || newName.trim() === '') {
      message.warning('学生姓名不能为空');
      return;
    }

    try {
      const response = await updateSchedule(currentTimetable.id, schedule.id, {
        studentName: newName.trim(),
      });
      if (response.success) {
        message.success('修改成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
      } else {
        message.error(response.message || '修改失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const response = await deleteSchedule(currentTimetable.id, scheduleId);
      if (response.success) {
        message.success('删除成功');
        setOpenPopoverKey(null);
        // 重新获取课程数据
        handleShowTodaysCourses(currentTimetable);
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  // 颜色组：主色和浅色背景
  const colorPairs = [
    { main: '#722ED1', bg: '#f9f0ff' }, // 紫
    { main: '#1890ff', bg: '#e6f7ff' }, // 蓝
    { main: '#52c41a', bg: '#f6ffed' }, // 绿
    { main: '#faad14', bg: '#fffbe6' }, // 橙
    { main: '#eb2f96', bg: '#fff0f6' }, // 粉
    { main: '#fa541c', bg: '#fff7e6' }, // 橘
    { main: '#13c2c2', bg: '#e6fffb' }, // 青
    { main: '#531dab', bg: '#f4f0ff' }, // 深紫
  ];
  // 图标主色循环
  const iconColors = ['#722ED1','#1890ff','#52c41a','#faad14','#eb2f96','#fa541c','#13c2c2','#531dab'];
  const getIconColor = (id) => iconColors[id % iconColors.length];

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
              style={{ position: 'relative' }}
              actions={[
                <Button type="link" onClick={() => handleShowTodaysCourses(item)}>今明课程</Button>,
                <Button type="link" onClick={() => handleInputTimetable(item)}>录入</Button>,
                <Button type="link" onClick={() => handleViewTimetable(item.id)}>查看</Button>,
                <Dropdown overlay={getActionMenu(item)} trigger={["click"]} placement="bottomRight">
                  <Button type="link">操作</Button>
                </Dropdown>
              ]}
            >
              {item.isActive && <ActiveBadge />}
              <List.Item.Meta
                className="timetable-item-meta"
                avatar={
                  <div style={{ margin: 12 }}>
                  <Avatar
                    shape="square"
                    size={48}
                    icon={<CalendarOutlined />}
                    style={{
                      backgroundColor: '#f9f0ff',
                      color: getIconColor(item.id),
                      border: '1px solid #e0d7f7',
                      borderRadius: '8px'
                    }}
                  />
                  </div>
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {editingTimetableId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Input
                            size="small"
                            value={editingTimetableName}
                            onChange={(e) => setEditingTimetableName(e.target.value)}
                            onPressEnter={() => handleSaveTimetableName(item.id)}
                            style={{ width: '200px' }}
                            autoFocus
                          />
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<CheckOutlined />}
                            onClick={() => handleSaveTimetableName(item.id)}
                            style={{ color: '#52c41a' }}
                          />
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<CloseOutlined />}
                            onClick={handleCancelEditTimetableName}
                            style={{ color: '#ff4d4f' }}
                          />
                        </div>
                      ) : (
                        <>
                          <a onClick={() => handleViewTimetable(item.id)} style={{ fontWeight: 600, fontSize: 17 }}>{item.name}</a>
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<EditOutlined />}
                            onClick={() => handleStartEditTimetableName(item.id, item.name)}
                            style={{ color: '#8c8c8c', padding: '0 4px', marginLeft: 2 }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                }
                description={
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888', fontSize: '12px' }}>
                      {item.isWeekly ? (
                        <div>星期一至星期日</div>
                      ) : (
                        <div>{`${item.startDate} 至 ${item.endDate}`}</div>
                      )}
                       <Tag
                         style={item.isWeekly
                           ? { backgroundColor: '#e6f7ff', borderColor: 'transparent', color: '#1890ff' }
                           : { backgroundColor: '#f9f0ff', borderColor: 'transparent', color: '#722ED1' }
                         }
                       >
                          {item.isWeekly ? '周固定课表' : '日期范围课表'}
                        </Tag>
                    </div>
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      创建于: {dayjs(item.createdAt).format('YYYY-MM-DD')}
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
        onCancel={() => {
          setTodaysCoursesModalVisible(false);
          setCurrentTimetable(null);
          setAllSchedulesData([]);
          setOpenPopoverKey(null);
        }}
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
              columns={getColumnsForTomorrow(studentColorMap)}
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
            onClick={() => {
              setTodaysCoursesModalVisible(false);
              setCurrentTimetable(null);
              setAllSchedulesData([]);
              setOpenPopoverKey(null);
            }}
            style={{ minWidth: '100px' }}
          >
            关闭
          </Button>
        </div>
      </Modal>

      {/* 编辑课程模态框 */}
      {editingSchedule && (
        <EditScheduleModal
          visible={editModalVisible}
          schedule={editingSchedule}
          timetable={currentTimetable}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSchedule(null);
          }}
          onOk={(data) => {
            if (editingSchedule) {
              handleUpdateSchedule(editingSchedule, data.studentName);
              setEditModalVisible(false);
              setEditingSchedule(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default Dashboard; 