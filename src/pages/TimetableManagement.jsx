import React, { useState, useEffect } from 'react';
import { Button, message, Space, Tag, Tooltip, Checkbox, List, Spin, Modal } from 'antd';
import { CalendarOutlined, UserOutlined, MergeOutlined, EyeOutlined, LeftOutlined, RightOutlined, StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllTimetables, updateTimetableStatus } from '../services/admin';

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
        // 过滤掉已归档的课表，只显示活跃课表
        const activeTimetables = response.data.filter(t => !t.isArchived || t.isArchived === 0);
        const sortedData = activeTimetables.sort((a, b) => {
            const activeA = a.isActive ? 1 : 0;
            const activeB = b.isActive ? 1 : 0;
            if (activeB !== activeA) {
              return activeB - activeA;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
        setAllTimetables(sortedData);
      } else {
        message.error(response.message || '获取课表数据失败');
      }
    } catch (error) {
      message.error('获取课表数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = (id) => {
    Modal.confirm({
      title: '确认设为活动课表',
      content: '每个用户只能有一个活动课表。确定后，该用户之前的活动课表将自动失效。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await updateTimetableStatus(id, { isActive: true });
          if (response.success) {
            message.success('已将课表设为活动状态');
            fetchAllTimetables();
          } else {
            message.error(response.message || '操作失败');
          }
        } catch (error) {
          message.error('操作失败，请检查网络连接');
        }
      },
    });
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
            const displayName = record.nickname || record.username || record.userName || '';
            const keyVal = displayName.split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
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
        const displayName = record.nickname || record.username || record.user?.username || record.userName;
        const text = displayName || `ID:${record.userId || '-'}`;
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

  // 添加全选功能
  const handleSelectAll = () => {
    if (selectedTimetables.length === displayTimetables.length) {
      // 如果已全选，则取消全选
      setSelectedTimetables([]);
    } else {
      // 否则全选当前显示的课表
      const allIds = displayTimetables.map(item => item.id);
      setSelectedTimetables(allIds);
    }
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
              <Button 
                size="small" 
                style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: '4px' }} 
                onClick={handleSelectAll}
                type={selectedTimetables.length === displayTimetables.length && displayTimetables.length > 0 ? 'primary' : 'default'}
              >
                <Checkbox
                  checked={selectedTimetables.length === displayTimetables.length && displayTimetables.length > 0}
                  indeterminate={selectedTimetables.length > 0 && selectedTimetables.length < displayTimetables.length}
                  onClick={(e) => e.stopPropagation()}
                  onChange={handleSelectAll}
                />
                全选
              </Button>
              <Button 
                size="small" 
                style={{ 
                  marginRight: 16,
                  backgroundColor: '#ff4d4f',
                  borderColor: '#ff4d4f',
                  color: 'white'
                }} 
                onClick={handleCancelBatchMode}
              >
                取消
              </Button>
              <span style={{ fontSize: '14px', color: '#666' }}>
                已选择 {selectedTimetables.length} 个课表
              </span>
            </div>
            <Button 
              type="primary" 
              icon={<MergeOutlined />}
              onClick={handleMergeTimetables}
              disabled={selectedTimetables.length < 2 || !checkCanMerge()}
              size="small"
            >
              合并课表
            </Button>
          </>
        ) : (
          <Button type="primary" size="small" icon={<MergeOutlined />} onClick={handleBatchMode} style={{ padding: '0 8px', height: 26, fontSize: 13 }}>
            批量操作
          </Button>
        )}
      </div>

      <List
        dataSource={displayTimetables}
        loading={loading}
        renderItem={item => {
            const nameColors = ['#10239e','#ad6800','#006d75','#237804','#9e1068','#a8071a','#391085','#0050b3'];
            const displayName = item.nickname || item.username || item.userName || '';
          const keyVal = displayName.split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
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
                {item.isActive ? <ActiveBadge /> : (
                  !batchMode && (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActive(item.id);
                      }}
                      style={{
                        position: 'absolute',
                        bottom: 18,
                        right: 18,
                      }}
                    >
                      设为活动
                    </Button>
                  )
                )}
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
                    <Tooltip title={item.name}>
                      <a 
                        onClick={() => navigate(`/view-timetable/${item.id}`)}
                        style={{
                          color,
                          fontSize: '16px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: '0 1 auto',
                        }}
                      >
                        {item.name}
                      </a>
                    </Tooltip>
                    <div>
                      <Tag color={item.isWeekly ? "geekblue" : "purple"}>
                        {item.isWeekly ? '周固定课表' : '日期范围课表'}
                      </Tag>
                    </div>
                  </div>
                  <div style={{ color: '#666', fontSize: 13, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                    <span>
                      <UserOutlined /> {item.nickname || item.username || item.user?.username || item.userName || `ID:${item.userId || '-'}`}
                    </span>
                    <span style={{ marginLeft: 10 }}>
                      {item.isWeekly ? '每周重复' : `${item.startDate} 至 ${item.endDate}`}
                    </span>
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
    </div>
  );
};

export default TimetableManagement; 