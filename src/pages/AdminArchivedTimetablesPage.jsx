import React, { useEffect, useState } from 'react';
import { List, Button, Tag, Modal, message, Empty, Checkbox, Space, Spin } from 'antd';
import { CalendarOutlined, LeftOutlined, UserOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getArchivedTimetables,
  restoreTimetableApi,
  deleteTimetable,
  bulkRestoreTimetables,
  bulkDeleteTimetables,
  getTimetableSchedules
} from '../services/timetable';

const AdminArchivedTimetablesPage = () => {
  const navigate = useNavigate();
  const [archived, setArchived] = useState([]);
  const [selectedTimetables, setSelectedTimetables] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleCount, setScheduleCount] = useState({});

  useEffect(() => {
    fetchArchived();
  }, []);

  useEffect(() => {
    if (batchMode && archived.length === 0) {
      setBatchMode(false);
    }
  }, [archived, batchMode]);

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const res = await getArchivedTimetables();
      if (res.success) {
        const archivedList = res.data.archivedList;
        setArchived(archivedList);
        
        // 获取每个课表的课程数量
        const counts = {};
        await Promise.all(
          archivedList.map(async (timetable) => {
            try {
              const scheduleResponse = await getTimetableSchedules(timetable.id);
              if (scheduleResponse.success && scheduleResponse.data) {
                counts[timetable.id] = scheduleResponse.data.length;
              } else {
                counts[timetable.id] = 0;
              }
            } catch (error) {
              console.error(`获取课表 ${timetable.id} 的课程数量失败:`, error);
              counts[timetable.id] = 0;
            }
          })
        );
        setScheduleCount(counts);
      } else {
        message.error(res.message || '获取归档课表失败');
      }
    } catch (e) {
      message.error('获取归档课表失败');
      console.error('获取归档课表失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRestore = () => {
    if (selectedTimetables.length === 0) {
      message.warning('请选择要恢复的课表');
      return;
    }

    Modal.confirm({
      title: '批量恢复课表',
      content: `确定要恢复选中的 ${selectedTimetables.length} 个课表吗？`,
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await bulkRestoreTimetables(selectedTimetables);
          if (res.success) {
            message.success(`成功恢复 ${res.data} 个课表`);
            setSelectedTimetables([]);
            setBatchMode(false);
            fetchArchived();
          } else {
            message.error(res.message || '恢复失败');
          }
        } catch (error) {
          message.error('恢复失败，请重试');
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedTimetables.length === 0) {
      message.warning('请选择要删除的课表');
      return;
    }

    Modal.confirm({
      title: '批量删除课表',
      content: `确定要永久删除选中的 ${selectedTimetables.length} 个课表吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await bulkDeleteTimetables(selectedTimetables);
          if (res.success) {
            message.success(`成功删除 ${res.data} 个课表`);
            setSelectedTimetables([]);
            setBatchMode(false);
            fetchArchived();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败，请重试');
        }
      },
    });
  };

  const handleRestore = (id) => {
    Modal.confirm({
      title: '恢复课表',
      content: '确定要恢复这个课表吗？',
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await restoreTimetableApi(id);
          if (res.success) {
            message.success('课表恢复成功');
            fetchArchived();
          } else {
            message.error(res.message || '恢复失败');
          }
        } catch (error) {
          message.error('恢复失败，请重试');
        }
      },
    });
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '删除课表',
      content: '确定要永久删除这个课表吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTimetable(id);
          if (res.success) {
            message.success('课表删除成功');
            fetchArchived();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败，请重试');
        }
      },
    });
  };

  // 生成名称颜色
  const getNameColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#722ED1', '#1890ff', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#531dab'];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button 
          type="default" 
          shape="circle" 
          icon={<LeftOutlined />} 
          onClick={() => navigate('/admin')} 
        />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <InboxOutlined />
            所有用户归档课表
          </h2>
        </div>
        {!batchMode && (
          <Button
            type="primary"
            onClick={() => setBatchMode(true)}
            disabled={archived.length === 0}
          >
            批量操作
          </Button>
        )}
      </div>

      {batchMode && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <Button onClick={() => { setBatchMode(false); setSelectedTimetables([]); }}>取消批量</Button>
            <span style={{ marginLeft: 16 }}>已选择 {selectedTimetables.length} 个课表</span>
          </div>
          <Space>
            <Button
              type="primary"
              onClick={handleBulkRestore}
              disabled={selectedTimetables.length === 0}
            >
              批量恢复
            </Button>
            <Button
              type="primary"
              danger
              onClick={handleBulkDelete}
              disabled={selectedTimetables.length === 0}
            >
              批量删除
            </Button>
          </Space>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <List
          dataSource={archived}
          locale={{ emptyText: <Empty description="暂无归档课表" /> }}
          renderItem={item => {
            const checked = selectedTimetables.includes(item.id);
            return (
              <List.Item
                style={{ 
                  border: '1px solid #f0f0f0', 
                  borderRadius: 10, 
                  marginBottom: 16, 
                  padding: 18, 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: '#fff' 
                }}
              >
                {batchMode && (
                  <Checkbox
                    checked={checked}
                    onChange={e => {
                      if (e.target.checked) { 
                        setSelectedTimetables([...selectedTimetables, item.id]); 
                      } else { 
                        setSelectedTimetables(selectedTimetables.filter(id => id !== item.id)); 
                      }
                    }}
                    style={{ marginRight: 16 }}
                  />
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <a 
                      style={{ color: getNameColor(item.name), fontWeight: 600, fontSize: 17 }} 
                      onClick={() => window.open(`/view-timetable/${item.id}`, '_blank')}
                    >
                      {item.name}
                    </a>
                    <Tag style={{ backgroundColor: '#f9f0ff', borderColor: 'transparent', color: '#722ED1' }}>
                      {item.isWeekly ? '周固定课表' : '日期范围课表'}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <Space size={16} style={{ color: '#888', fontSize: 13 }}>
                        <span><UserOutlined /> {item.nickname || item.username || '未知用户'}</span>
                        {item.isWeekly && <span>每周重复</span>}
                        <span>共{scheduleCount[item.id] || 0}课程</span>
                      </Space>
                    </div>
                    {!item.isWeekly && (
                      <div style={{ color: '#888', fontSize: 13 }}>
                        <CalendarOutlined /> {item.startDate || ''} 至 {item.endDate || ''}
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>
                    创建于 {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '未知时间'}
                  </div>
                </div>
                {!batchMode && (
                  <Space>
                    <Button size="small" onClick={() => handleRestore(item.id)}>
                      恢复
                    </Button>
                    <Button size="small" danger onClick={() => handleDelete(item.id)}>
                      删除
                    </Button>
                  </Space>
                )}
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};

export default AdminArchivedTimetablesPage;
