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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title">我的课表</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={handleCreateTimetable}
        >
          创建新课表
        </Button>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
          </div>
        ) : timetables.length === 0 ? (
          <Empty
            description="暂无课表"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleCreateTimetable}>
              创建第一个课表
            </Button>
          </Empty>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={timetables}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button 
                    type="text" 
                    icon={<EditOutlined />}
                    onClick={() => handleInputTimetable(item.id)}
                  >
                    录入
                  </Button>,
                  <Button 
                    type="text" 
                    icon={<EyeOutlined />}
                    onClick={() => handleViewTimetable(item.id)}
                  >
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<CalendarOutlined />} />}
                  title={item.name}
                  description={
                    <div>
                      <div>类型: {item.isWeekly ? '周固定课表' : '日期范围课表'}</div>
                      {!item.isWeekly && item.startDate && item.endDate && (
                        <div>时间: {item.startDate} 至 {item.endDate}</div>
                      )}
                      <div>创建时间: {new Date(item.createdAt).toLocaleDateString()}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {user?.role === 'admin' && (
        <Card style={{ marginTop: 24 }} title="管理员功能">
          <Button 
            type="primary" 
            onClick={() => navigate('/admin')}
            style={{ marginRight: 16 }}
          >
            进入管理面板
          </Button>
        </Card>
      )}
    </div>
  );
};

export default Dashboard; 