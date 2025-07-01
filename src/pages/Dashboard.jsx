import React, { useState, useEffect } from 'react';
import { Card, Button, List, Avatar, message, Empty, Spin } from 'antd';
import { PlusOutlined, CalendarOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimetables } from '../services/timetable';

const Dashboard = ({ user }) => {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTimetables();
  }, []);

  const fetchTimetables = async () => {
    try {
      const response = await getTimetables();
      if (response.success) {
        setTimetables(response.data);
      } else {
        message.error(response.message || '获取课表失败');
      }
    } catch (error) {
      message.error('获取课表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimetable = () => {
    navigate('/create-timetable');
  };

  const handleInputTimetable = (timetableId) => {
    navigate(`/input-timetable/${timetableId}`);
  };

  const handleViewTimetable = (timetableId) => {
    navigate(`/view-timetable/${timetableId}`);
  };

  return (
    <div className="content-container">
      <div className="dashboard-header">
        <h1 className="page-title">我的课表</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={handleCreateTimetable}
          className="create-button"
        >
          <span className="create-button-text">创建新课表</span>
        </Button>
      </div>

      <Card className="timetable-card">
        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
          </div>
        ) : timetables.length === 0 ? (
          <Empty
            description="暂无课表"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className="empty-state"
          >
            <Button type="primary" onClick={handleCreateTimetable}>
              创建第一个课表
            </Button>
          </Empty>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={timetables}
            className="timetable-list"
            renderItem={(item) => (
              <List.Item
                className="timetable-item"
                actions={[
                  <Button 
                    type="text" 
                    icon={<EditOutlined />}
                    onClick={() => handleInputTimetable(item.id)}
                    className="action-button"
                  >
                    <span className="action-text">录入</span>
                  </Button>,
                  <Button 
                    type="text" 
                    icon={<EyeOutlined />}
                    onClick={() => handleViewTimetable(item.id)}
                    className="action-button"
                  >
                    <span className="action-text">查看</span>
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<CalendarOutlined />} className="timetable-avatar" />}
                  title={<div className="timetable-title">{item.name}</div>}
                  description={
                    <div className="timetable-description">
                      <div className="timetable-type">类型: {item.isWeekly ? '周固定课表' : '日期范围课表'}</div>
                      {!item.isWeekly && item.startDate && item.endDate && (
                        <div className="timetable-time">时间: {item.startDate} 至 {item.endDate}</div>
                      )}
                      <div className="timetable-created">创建时间: {new Date(item.createdAt).toLocaleDateString()}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {user?.role === 'admin' && (
        <Card className="admin-card" title="管理员功能">
          <Button 
            type="primary" 
            onClick={() => navigate('/admin')}
          >
            进入管理面板
          </Button>
        </Card>
      )}
    </div>
  );
};

export default Dashboard; 