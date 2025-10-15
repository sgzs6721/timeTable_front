import React, { useEffect, useState } from 'react';
import { List, Button, Tag, Modal, message, Empty, Checkbox, Space, Spin } from 'antd';
import { CalendarOutlined, LeftOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getArchivedTimetables,
  restoreTimetableApi,
  deleteTimetable,
  bulkRestoreTimetables,
  bulkDeleteTimetables,
  getTimetableSchedules
} from '../services/timetable';
import Footer from '../components/Footer';

const ArchivedTimetables = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [archived, setArchived] = useState([]);
  const [selectedTimetables, setSelectedTimetables] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleCount, setScheduleCount] = useState({});
  // 从导航状态获取非归档课表数量，如果没有则默认为0
  const [nonArchivedCount, setNonArchivedCount] = useState(location.state?.nonArchivedCount || 0);


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
      const res = await getArchivedTimetables('self');
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
      } else message.error(res.message || '获取归档课表失败');
    } catch (e) {
      message.error('获取归档课表失败');
      console.error('获取归档课表失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRestore = () => {
    if (selectedTimetables.length === 0) {
      message.info('请先选择课表');
      return;
    }
    Modal.confirm({
      title: '批量恢复',
      content: `确定要恢复选中的 ${selectedTimetables.length} 个课表吗？`,
      okText: '恢复',
      onOk: async () => {
        if (nonArchivedCount + selectedTimetables.length > 5) {
          message.error('无法恢复，操作后非归档课表将超过数量上限 (5个)');
          return;
        }
        try {
          const res = await bulkRestoreTimetables(selectedTimetables);
          if (res.success) {
            message.success(res.message || '已恢复');
            // 更新本地状态：增加非归档数量，移除已恢复的课表
            setNonArchivedCount(prev => prev + selectedTimetables.length);
            setArchived(prev => prev.filter(item => !selectedTimetables.includes(item.id)));
            setSelectedTimetables([]);
          } else {
            message.error(res.message || '操作失败');
          }
        } catch (e) { message.error('操作失败'); }
      }
    })
  };

  const handleBulkDelete = () => {
    if (selectedTimetables.length === 0) {
      message.info('请先选择要删除的课表');
      return;
    }

    Modal.confirm({
      title: '批量彻底删除',
      content: `删除后无法恢复，确定要彻底删除选中的 ${selectedTimetables.length} 个课表吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await bulkDeleteTimetables(selectedTimetables);
          if (res.success) {
            message.success(res.message || '已批量删除');
            // 更新本地状态：移除已删除的课表
            setArchived(prev => prev.filter(item => !selectedTimetables.includes(item.id)));
            setSelectedTimetables([]);
          } else {
            message.error(res.message || '批量删除操作失败');
          }
        } catch (e) {
          message.error('批量删除操作失败');
        }
      }
    });
  };

  const handleRestore = (id) => {
    Modal.confirm({
      title: '恢复课表',
      content: '确定要将该课表恢复到“我的课表”吗？',
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await restoreTimetableApi(id);
          if (res.success) {
            // 更新本地状态：增加非归档数量，移除已恢复的课表
            setNonArchivedCount(prev => prev + 1);
            setArchived(prev => prev.filter(t => t.id !== id));
            message.success('课表已恢复');
          } else {
            message.error(res.message || '恢复失败');
          }
        } catch(e){message.error('恢复失败');}
      },
    });
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '彻底删除',
      content: '删除后无法恢复，确定要彻底删除该课表吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTimetable(id);
          setArchived(archived.filter(t => t.id !== id));
          message.success('课表已删除');
        } catch (e) {
          message.error('删除失败');
        }
      },
    });
  };

  const nameColors = ['#10239e','#ad6800','#006d75','#237804','#9e1068','#a8071a','#391085','#0050b3'];
  const getNameColor = (name) => {
    const keyVal = (name || '').split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
    return nameColors[keyVal % nameColors.length];
  };

  return (
    <div className="page-container">
      <div style={{ display:'flex', alignItems:'center', marginBottom:24 }}>
        <Button type="default" shape="circle" icon={<LeftOutlined />} onClick={()=>navigate('/dashboard')} />
        <div style={{ flex:1, textAlign:'center' }}>
          <h2 style={{ margin:0, fontWeight:600 }}>已归档课表</h2>
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
              disabled={selectedTimetables.length === 0 || nonArchivedCount >= 5}
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
                style={{ border:'1px solid #f0f0f0', borderRadius:10, marginBottom:16, padding:18, display:'flex', alignItems:'center', background:'#fff' }}
              >
                {batchMode && (
                  <Checkbox
                    checked={checked}
                    onChange={e=>{
                      if(e.target.checked){ setSelectedTimetables([...selectedTimetables,item.id]); }
                      else { setSelectedTimetables(selectedTimetables.filter(id=>id!==item.id)); }
                    }}
                    style={{ marginRight:16 }}
                  />)
                }
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <a style={{ color: getNameColor(item.name), fontWeight: 600, fontSize: 17 }} onClick={() => navigate(`/view-timetable/${item.id}`)}>{item.name}</a>
                    <Tag style={{ backgroundColor:'#f9f0ff', borderColor:'transparent', color:'#722ED1' }}>
                      {item.isWeekly? '周固定课表':'日期范围课表'}
                    </Tag>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', marginTop:10 }}>
                    <Space size={16} style={{ color:'#888', fontSize:13 }}>
                      <span><UserOutlined /> {item.nickname || item.username || '未知用户'}</span>
                      <span>
                        <CalendarOutlined />{' '}
                        {item.isWeekly? '每周重复': `${item.startDate || ''} 至 ${item.endDate || ''}`}
                      </span>
                      <span>共{scheduleCount[item.id] || 0}课程</span>
                    </Space>
                  </div>
                  <div style={{ color:'#888', fontSize:13, marginTop:2, display:'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>创建日期：{item.createdAt? item.createdAt.slice(0,10):''}</span>
                    {!batchMode && (
                      <div>
                        <Button
                          type="link"
                          onClick={() => handleRestore(item.id)}
                          disabled={nonArchivedCount >= 5}
                        >
                          恢复
                        </Button>
                        <Button
                          type="link"
                          danger
                          onClick={()=>handleDelete(item.id)}
                        >
                          删除
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
      
      {/* 版权信息 */}
      <Footer />
    </div>
  );
};

export default ArchivedTimetables;