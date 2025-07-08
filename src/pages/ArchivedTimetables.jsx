import React, { useEffect, useState } from 'react';
import { List, Button, Tag, Modal, message, Empty } from 'antd';
import { CalendarOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
// 假设有 getTimetables, deleteTimetable, restoreTimetable 这几个API
import { getTimetables, deleteTimetable } from '../services/timetable';

const ArchivedTimetables = () => {
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const res = await getTimetables();
      setArchived(res.data.filter(t => t.isArchived));
    } catch (e) {
      message.error('获取归档课表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (id) => {
    Modal.confirm({
      title: '恢复课表',
      content: '确定要将该课表恢复到“我的课表”吗？',
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        // TODO: 调用后端接口恢复课表
        setArchived(archived.filter(t => t.id !== id));
        message.success('课表已恢复');
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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Button type="default" shape="circle" icon={<RollbackOutlined />} onClick={() => navigate('/dashboard')} style={{ marginRight: 16 }} />
        <h2 style={{ margin: 0 }}>归档课表</h2>
      </div>
      <List
        loading={loading}
        dataSource={archived}
        locale={{ emptyText: <Empty description="暂无归档课表" /> }}
        renderItem={item => (
          <List.Item
            actions={[
              <Button type="link" onClick={() => handleRestore(item.id)}>恢复</Button>,
              <Button type="link" danger onClick={() => handleDelete(item.id)}>彻底删除</Button>
            ]}
          >
            <List.Item.Meta
              avatar={<CalendarOutlined style={{ fontSize: 28, color: '#722ED1' }} />}
              title={<span style={{ fontWeight: 600 }}>{item.name}</span>}
              description={
                <>
                  <div style={{ color: '#888', fontSize: 12 }}>{item.isWeekly ? '周固定课表' : `${item.startDate} 至 ${item.endDate}`}</div>
                  <Tag color={item.isWeekly ? 'blue' : 'purple'}>{item.isWeekly ? '周固定课表' : '日期范围课表'}</Tag>
                </>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default ArchivedTimetables; 