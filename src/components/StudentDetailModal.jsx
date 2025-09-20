import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Spin, message, List, Tag } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getStudentRecords } from '../services/weeklyInstance';

const StudentDetailModal = ({ visible, onClose, studentName, coachName }) => {
  const [loading, setLoading] = useState(false);
  const [scheduleRecords, setScheduleRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [actualCoachName, setActualCoachName] = useState(coachName);

  useEffect(() => {
    if (visible && studentName) {
      fetchStudentRecords();
    }
  }, [visible, studentName, coachName]);

  const fetchStudentRecords = async () => {
    setLoading(true);
    try {
      const response = await getStudentRecords(studentName, coachName);
      if (response && response.success) {
        setScheduleRecords(response.data.schedules || []);
        setLeaveRecords(response.data.leaves || []);
        // 使用后端返回的真正教练名称
        if (response.data.actualCoachName) {
          setActualCoachName(response.data.actualCoachName);
        }
      } else {
        message.error('获取学员记录失败');
      }
    } catch (error) {
      console.error('获取学员记录失败:', error);
      message.error('获取学员记录失败');
    } finally {
      setLoading(false);
    }
  };


  const tabItems = [
    {
      key: 'schedules',
      label: (
        <span>
          <CalendarOutlined />
          上课记录 ({scheduleRecords.length})
        </span>
      ),
      children: (
        <List
          dataSource={scheduleRecords}
          renderItem={(item) => (
            <List.Item style={{ padding: '8px 0', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '20px' }}>
                <div style={{ minWidth: '80px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#1890ff', fontWeight: 500 }}>
                    {item.scheduleDate}
                  </span>
                </div>
                <div style={{ minWidth: '100px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#666' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {item.timeRange}
                  </span>
                </div>
                <div style={{ minWidth: '80px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <Tag 
                    color={item.timetableType === '实例课表' ? undefined : undefined} 
                    style={{ 
                      fontSize: '10px',
                      backgroundColor: item.timetableType === '实例课表' ? 'rgba(114, 46, 209, 0.2)' : 'rgba(24, 144, 255, 0.2)',
                      color: item.timetableType === '实例课表' ? '#722ed1' : '#1890ff',
                      border: item.timetableType === '实例课表' ? '1px solid rgba(114, 46, 209, 0.3)' : '1px solid rgba(24, 144, 255, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: '20px'
                    }}
                  >
                    {item.timetableType}
                  </Tag>
                </div>
                <div style={{ minWidth: '60px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {item.status === '请假' ? (
                    <Tag color="orange" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', height: '20px' }}>请假</Tag>
                  ) : (
                    <Tag color="green" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', height: '20px' }}>正常</Tag>
                  )}
                </div>
              </div>
            </List.Item>
          )}
          pagination={{ 
            pageSize: 10, 
            size: 'small',
            showSizeChanger: false,
            showQuickJumper: false,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      )
    },
    {
      key: 'leaves',
      label: (
        <span>
          <ClockCircleOutlined />
          请假记录 ({leaveRecords.length})
        </span>
      ),
      children: (
        <List
          dataSource={leaveRecords}
          renderItem={(item) => (
            <List.Item style={{ padding: '8px 0', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '20px' }}>
                <div style={{ minWidth: '80px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#fa8c16', fontWeight: 500 }}>
                    {item.leaveDate}
                  </span>
                </div>
                <div style={{ minWidth: '100px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#666' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {item.timeRange}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#fa8c16' }}>
                    {item.leaveReason || '未填写'}
                  </span>
                </div>
              </div>
            </List.Item>
          )}
          pagination={{ 
            pageSize: 10, 
            size: 'small',
            showSizeChanger: false,
            showQuickJumper: false,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      )
    }
  ];

  return (
    <Modal
      title={`学员详情 - ${studentName}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      style={{ top: 20 }}
    >
      <Spin spinning={loading}>
        <div style={{ marginBottom: 12, fontSize: '13px' }}>
          <span style={{ color: '#666' }}>教练：</span>
          <span style={{ fontWeight: 500 }}>{actualCoachName}</span>
        </div>
        
        <Tabs
          defaultActiveKey="schedules"
          items={tabItems}
          size="small"
        />
      </Spin>
    </Modal>
  );
};

export default StudentDetailModal;
