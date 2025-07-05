import React, { useState, useEffect } from 'react';
import { Table, Button, message, Space, Typography, Card, Tag, Tooltip, Checkbox } from 'antd';
import { UserOutlined, CalendarOutlined, MergeOutlined, EyeOutlined, ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllTimetables } from '../services/timetable';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const [allTimetables, setAllTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimetables, setSelectedTimetables] = useState([]);
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

  const columns = [
    {
      title: '课表名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Space>
            <CalendarOutlined />
            <a onClick={() => navigate(`/view-timetable/${record.id}`)}>{text}</a>
          </Space>
          <div style={{ marginTop: 4 }}>
            <Tag color={record.isWeekly ? 'blue' : 'green'}>
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

  const rowSelection = {
    selectedRowKeys: selectedTimetables,
    onChange: (selectedRowKeys) => {
      setSelectedTimetables(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  const selectedTableNames = allTimetables
    .filter(table => selectedTimetables.includes(table.id))
    .map(table => `${table.name} (${table.username})`)
    .join('、');

  // 检查是否可以合并（类型一致）
  const checkCanMerge = () => {
    if (selectedTimetables.length < 2) return false;
    const selectedData = allTimetables.filter(table => selectedTimetables.includes(table.id));
    if (selectedData.length === 0) return false;
    const firstType = selectedData[0]?.isWeekly;
    return selectedData.every(table => table.isWeekly === firstType);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => navigate('/dashboard')}
          icon={<LeftOutlined />}
          style={{ 
            position: 'absolute',
            left: 0,
            fontSize: '20px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            color: '#666'
          }}
        />
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Space align="center" size="large">
            <UserOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
            <h1 style={{ margin: 0 }}>管理员面板</h1>
          </Space>
        </div>
      </div>
      
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>
          已选择 {selectedTimetables.length} 个课表
        </span>
        <Button 
          type="primary" 
          icon={<MergeOutlined />}
          onClick={handleMergeTimetables}
          disabled={selectedTimetables.length < 2 || !checkCanMerge()}
        >
          合并选中课表
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={allTimetables}
        loading={loading}
        rowKey="id"
        rowSelection={rowSelection}
        pagination={false}
      />

      {/* 周导航样式的分页 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginTop: '16px',
        gap: '16px'
      }}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          disabled={true}
          style={{ 
            fontSize: '14px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '1px solid #d9d9d9',
            color: '#bfbfbf'
          }}
        />
        <Tag 
          color="blue" 
          style={{ 
            fontSize: '14px', 
            padding: '4px 12px',
            margin: 0
          }}
        >
          第 1-{Math.min(10, allTimetables.length)} 条，共 {allTimetables.length} 条记录
        </Tag>
        <Button
          type="text"
          icon={<RightOutlined />}
          disabled={true}
          style={{ 
            fontSize: '14px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '1px solid #d9d9d9',
            color: '#bfbfbf'
          }}
        />
      </div>

      <Card style={{ marginTop: 24 }} title="管理员统计">
        <div style={{ textAlign: 'center' }}>
          {/* 单行显示：总课表数、用户数、周固定课表、日期范围课表 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>
                {allTimetables.length}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>总课表数</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#52c41a' }}>
                {new Set(allTimetables.map(t => t.username)).size}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>用户数</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#722ed1' }}>
                {allTimetables.filter(t => t.isWeekly === true).length}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>周固定课表</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#eb2f96' }}>
                {allTimetables.filter(t => t.isWeekly === false).length}
              </div>
              <div style={{ color: '#666', marginTop: '8px' }}>日期范围课表</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminPanel; 