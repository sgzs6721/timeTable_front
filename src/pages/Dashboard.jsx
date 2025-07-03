import React, { useState, useEffect } from 'react';
import { Card, Button, List, Avatar, message, Empty, Spin, Tag } from 'antd';
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

  const handleInputTimetable = (timetable) => {
    navigate(`/input-timetable/${timetable.id}`, { state: { timetable } });
  };

  const handleViewTimetable = (timetableId) => {
    navigate(`/view-timetable/${timetableId}`);
  };

  return (
    <div className="content-container" style={{ maxWidth: '900px' }}>
      <div className="dashboard-header">
        <h1 className="page-title" style={{ marginLeft: '36px' }}>我的课表</h1>
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={handleCreateTimetable}
          style={{ textDecoration: 'none' }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
        >
          创建课表
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
                style={{ marginBottom: '16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '16px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item.isWeekly
                        ? 'linear-gradient(135deg, #40a9ff 0%, #1890ff 100%)'
                        : 'linear-gradient(135deg, #73d13d 0%, #52c41a 100%)'
                    }}
                  >
                    <CalendarOutlined style={{ fontSize: '20px', color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="timetable-title" style={{ fontSize: '14px', marginBottom: '4px' }}>{item.name}</div>
                    <div className="timetable-description" style={{ fontSize: '12px', color: '#888' }}>
                      类型: {item.isWeekly ? '周固定课表' : '日期范围课表'}<br />
                      {!item.isWeekly && `时间: ${item.startDate} 至 ${item.endDate}`}<br />
                      创建时间: {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Button
                      type="text"
                      onClick={() => handleInputTimetable(item)}
                      style={{ color: '#237804' }}
                    >
                      录入课表
                    </Button>
                    <Button
                      type="text"
                      onClick={() => handleViewTimetable(item.id)}
                      style={{ color: '#ad6800' }}
                    >
                      查看课表
                    </Button>
                  </div>
                </div>
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