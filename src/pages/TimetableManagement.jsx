import React, { useState, useEffect } from 'react';
import { Button, message, Space, Tag, Tooltip, Checkbox, List, Spin } from 'antd';
import { CalendarOutlined, UserOutlined, MergeOutlined, EyeOutlined, LeftOutlined, RightOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllTimetables } from '../services/admin';

const ActiveBadge = () => (
    <div style={{
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 18,
      height: 18,
      background: '#389e0d',
      borderTopLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '-1px -1px 4px rgba(0,0,0,0.15)',
      zIndex: 1
    }}>
      <StarFilled style={{ color: 'white', fontSize: '10px' }} />
    </div>
  );

const TimetableManagement = ({ user }) => {
  const [allTimetables, setAllTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimetables, setSelectedTimetables] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllTimetables();
  }, []);

  const fetchAllTimetables = async () => {
    try {
      const response = await getAllTimetables();
      if (response.success) {
        setAllTimetables(response.data);
      } else {
        message.error(response.message || '获取课表数据失败');
      }
    } catch (error) {
      message.error('获取课表数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeTimetables = () => {
    if (selectedTimetables.length < 2) {
      message.warning('请至少选择两个课表进行合并');
      return;
    }
    
    // 检查选中课表类型是否一致
    const selectedData = allTimetables.filter(table => selectedTimetables.includes(table.id));
    const firstType = selectedData[0]?.isWeekly;
    const allSameType = selectedData.every(table => table.isWeekly === firstType);
    
    if (!allSameType) {
      message.warning('只能合并相同类型的课表（周固定课表或日期范围课表）');
      return;
    }
    
    // 跳转到合并预览页
    navigate(`/preview-merge?ids=${selectedTimetables.join(',')}`);
  };

  const colorPaletteAvatar = ['#f9f0ff','#e6f7ff','#fff7e6','#f6ffed','#fff0f6','#f0f5ff','#fffbe6','#fcf4ff'];
  const getAvatarColor = (id)=> colorPaletteAvatar[id % colorPaletteAvatar.length];

  const columns = [
    {
      title: '课表名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          {(() => {
            const nameColors = ['#10239e','#ad6800','#006d75','#237804','#9e1068','#a8071a','#391085','#0050b3'];
            const keyVal = (record.username || record.userName || '')
              .split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
            const color = nameColors[keyVal % nameColors.length];
            return (
              <a style={{ color }} onClick={() => navigate(`/view-timetable/${record.id}`)}>{text}</a>
            );
          })()}
          <div style={{ marginTop: 4 }}>
            <Tag style={{ backgroundColor: '#f9f0ff', borderColor: 'transparent', color: '#722ED1' }}>
              {record.isWeekly ? '周固定课表' : '日期范围课表'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: '所属用户',
      dataIndex: 'username',
      key: 'username',
      render: (_, record) => {
        const text = record.username || record.user?.username || record.userName || `ID:${record.userId || '-'}`;
        return (
          <Space>
            <UserOutlined />
            <span>{text}</span>
          </Space>
        );
      },
    },
    {
      title: '时间范围',
      dataIndex: 'dateRange',
      key: 'dateRange',
      responsive: ['md'],
      render: (_, record) => {
        if (record.isWeekly) {
          return <span style={{ color: '#666' }}>每周重复</span>;
        }
        return `${record.startDate} 至 ${record.endDate}`;
      },
    },
    {
      title: '课程数量',
      dataIndex: 'scheduleCount',
      key: 'scheduleCount',
      responsive: ['md'],
      render: (count) => (
        <Tag color="orange">{count || 0} 个课程</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      responsive: ['md'],
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="text"
          size="small" 
          icon={<EyeOutlined />} 
          onClick={() => navigate(`/view-timetable/${record.id}`)}
        />
      ),
    },
  ];

  // 检查是否可以合并（类型一致）
  const checkCanMerge = () => {
    if (selectedTimetables.length < 2) return false;
    const selectedData = allTimetables.filter(table => selectedTimetables.includes(table.id));
    if (selectedData.length === 0) return false;
    const firstType = selectedData[0]?.isWeekly;
    return selectedData.every(table => table.isWeekly === firstType);
  };

  // 进入/退出批量操作模式
  const handleBatchMode = () => {
    setBatchMode(true);
  };
  const handleCancelBatchMode = () => {
    setBatchMode(false);
    setSelectedTimetables([]);
  };

  const displayTimetables = batchMode
    ? allTimetables.filter(item => item.scheduleCount > 0 && item.isActive === 1)
    : allTimetables;

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: batchMode ? 'space-between' : 'flex-start', alignItems: 'center' }}>
        {batchMode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button size="small" style={{ marginRight: 16 }} onClick={handleCancelBatchMode}>取消批量</Button>
              <span style={{ fontSize: '14px', color: '#666' }}>
                已选择 {selectedTimetables.length} 个活动课表
              </span>
            </div>
            <Button 
              type="primary" 
              icon={<MergeOutlined />}
              onClick={handleMergeTimetables}
              disabled={selectedTimetables.length < 2 || !checkCanMerge()}
              size="small"
            >
              合并选中课表
            </Button>
          </>
        ) : (
          <Button type="primary" size="small" icon={<MergeOutlined />} onClick={handleBatchMode} style={{ padding: '0 8px', height: 26, fontSize: 13 }}>
            批量操作
          </Button>
        )}
      </div>

      {loading ? <Spin /> : (
        <List
          dataSource={displayTimetables}
          renderItem={item => {
            const nameColors = ['#10239e','#ad6800','#006d75','#237804','#9e1068','#a8071a','#391085','#0050b3'];
            const keyVal = (item.username || item.userName || '').split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
            const color = nameColors[keyVal % nameColors.length];
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
                  background: '#fff',
                  position: 'relative',
                }}
              >
                {item.isActive ? <ActiveBadge /> : null}
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <a style={{ color, fontWeight: 600, fontSize: 17 }} onClick={() => navigate(`/view-timetable/${item.id}`)}>{item.name}</a>
                    <Tag style={{ backgroundColor: '#f9f0ff', borderColor: 'transparent', color: '#722ED1', marginLeft: 8, minWidth: 90, textAlign: 'center' }}>
                      {item.isWeekly ? '周固定课表' : '日期范围课表'}
                    </Tag>
                  </div>
                  {/* 用户+日期+课程数量同一行，和标题有间距 */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, marginBottom: 0 }}>
                    <div style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span><UserOutlined /> {item.username || item.user?.username || item.userName || `ID:${item.userId || '-'}`}</span>
                      <span style={{ marginLeft: 10 }}>
                        {item.isWeekly ? '每周重复' : `${item.startDate} 至 ${item.endDate}`}
                      </span>
                    </div>
                  </div>
                  {/* 第三行：创建日期+课程数量，同一行，普通文本 */}
                  <div style={{ color: '#888', fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span>
                      创建日期：{item.createdAt ? (item.createdAt.length > 10 ? item.createdAt.slice(0, 10) : item.createdAt) : ''}
                    </span>
                    <span>{item.scheduleCount || 0} 个课程</span>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};

export default TimetableManagement; 