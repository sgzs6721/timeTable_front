import React, { useState, useEffect } from 'react';
import { Button, message, Space, Tag, Spin, Modal, Table, List } from 'antd';
import { LeftOutlined, UnorderedListOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import { getWeeklyInstances, deleteWeeklyInstance, getInstanceSchedules } from '../services/weeklyInstance';
import Footer from '../components/Footer';
import './AdminPanel.css';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const WeeklyInstancesList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const timetable = location.state?.timetable;
  
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedInstanceId, setExpandedInstanceId] = useState(null);
  const [instanceSchedules, setInstanceSchedules] = useState({});

  useEffect(() => {
    if (!timetable) {
      message.error('课表信息不存在');
      navigate(-1);
      return;
    }
    fetchInstances();
  }, [timetable]);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const response = await getWeeklyInstances(timetable.id);
      if (response.success) {
        const sortedInstances = (response.data || []).sort((a, b) => 
          dayjs(b.weekStartDate).diff(dayjs(a.weekStartDate))
        );
        setInstances(sortedInstances);
      } else {
        message.error(response.message || '获取实例列表失败');
      }
    } catch (error) {
      message.error('获取实例列表失败');
      console.error('获取实例列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInstance = async (instanceId) => {
    if (expandedInstanceId === instanceId) {
      setExpandedInstanceId(null);
      return;
    }
    
    setExpandedInstanceId(instanceId);
    
    if (!instanceSchedules[instanceId]) {
      try {
        const response = await getInstanceSchedules(instanceId);
        if (response.success) {
          setInstanceSchedules(prev => ({
            ...prev,
            [instanceId]: response.data || []
          }));
        }
      } catch (error) {
        message.error('获取实例课程失败');
        console.error('获取实例课程失败:', error);
      }
    }
  };

  const handleDeleteInstance = async (instanceId) => {
    Modal.confirm({
      title: '删除周实例',
      content: '确定删除该周实例及其所有课程吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await deleteWeeklyInstance(instanceId);
          if (response.success) {
            message.success('删除成功');
            await fetchInstances();
          } else {
            message.error(response.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
          console.error('删除实例失败:', error);
        }
      }
    });
  };

  const DesktopHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
      <Button
        onClick={() => navigate(-1)}
        icon={<LeftOutlined />}
        shape="circle"
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Space align="center" size="large">
          <UnorderedListOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <h1 style={{ margin: 0 }}>{timetable?.name} - 实例列表</h1>
        </Space>
      </div>
    </div>
  );

  return (
    <div className={isMobile ? "page-container-mobile-admin" : "page-container"}>
      {!isMobile && <DesktopHeader />}
      <div className={isMobile ? "mobile-tabs-container with-gradient-border" : "desktop-tabs with-gradient-border"}>
        <Spin spinning={loading}>
          {instances.length === 0 && !loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              backgroundColor: '#fff',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#999', fontSize: '14px' }}>暂无实例</div>
            </div>
          ) : (
            <List
              dataSource={instances}
              renderItem={(instance) => {
                const isExpanded = expandedInstanceId === instance.id;
                const schedules = instanceSchedules[instance.id] || [];
                const weekStart = dayjs(instance.weekStartDate);
                const weekEnd = dayjs(instance.weekEndDate);
                const isCurrentWeek = dayjs().isBetween(weekStart, weekEnd, 'day', '[]');
                
                return (
                  <List.Item
                    key={instance.id}
                    style={{ 
                      border: '1px solid #f0f0f0',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      padding: '16px',
                      backgroundColor: isCurrentWeek ? '#f6ffed' : '#fff'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      {/* 实例标题行 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: '12px' 
                      }}>
                        <Space>
                          <Tag color={isCurrentWeek ? 'green' : 'blue'}>
                            {isCurrentWeek ? '本周' : weekStart.format('YYYY-MM-DD')}
                          </Tag>
                          <span style={{ fontWeight: 500, fontSize: '15px' }}>
                            {weekStart.format('MM/DD')} ~ {weekEnd.format('MM/DD')}
                          </span>
                          <span style={{ color: '#999', fontSize: '13px' }}>
                            ({instance.yearWeek})
                          </span>
                        </Space>
                        <Space>
                          <Button 
                            type="link" 
                            size="small"
                            onClick={() => handleToggleInstance(instance.id)}
                          >
                            {isExpanded ? '收起' : '查看课程'}
                          </Button>
                          <Button 
                            type="link" 
                            size="small"
                            danger
                            onClick={() => handleDeleteInstance(instance.id)}
                          >
                            删除
                          </Button>
                        </Space>
                      </div>
                      
                      {/* 展开的课程列表 */}
                      {isExpanded && (
                        <div style={{ 
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#fafafa',
                          borderRadius: '6px'
                        }}>
                          {schedules.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                              无课程
                            </div>
                          ) : (
                            <Table
                              dataSource={schedules}
                              columns={[
                                {
                                  title: '星期',
                                  dataIndex: 'dayOfWeek',
                                  key: 'dayOfWeek',
                                  width: 80,
                                  render: (day) => {
                                    const dayMap = {
                                      MONDAY: '周一',
                                      TUESDAY: '周二',
                                      WEDNESDAY: '周三',
                                      THURSDAY: '周四',
                                      FRIDAY: '周五',
                                      SATURDAY: '周六',
                                      SUNDAY: '周日'
                                    };
                                    return dayMap[day] || day;
                                  }
                                },
                                {
                                  title: '时间',
                                  key: 'time',
                                  width: 140,
                                  render: (_, record) => 
                                    `${record.startTime?.substring(0, 5)} - ${record.endTime?.substring(0, 5)}`
                                },
                                {
                                  title: '学员',
                                  dataIndex: 'studentName',
                                  key: 'studentName',
                                  width: 100
                                },
                                {
                                  title: '备注',
                                  dataIndex: 'note',
                                  key: 'note',
                                  ellipsis: true
                                }
                              ]}
                              pagination={false}
                              size="small"
                              rowKey="id"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          )}
        </Spin>
      </div>
      <Footer />
    </div>
  );
};

export default WeeklyInstancesList;
