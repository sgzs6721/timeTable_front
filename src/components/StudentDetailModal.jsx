import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Spin, message, List, Tag } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getStudentRecords } from '../services/weeklyInstance';

const StudentDetailModal = ({ visible, onClose, studentName, coachName }) => {
  const [loading, setLoading] = useState(false);
  const [scheduleRecords, setScheduleRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [actualCoachName, setActualCoachName] = useState(coachName);

  const PAGE_SIZE = 10;
  const ITEM_ROW_HEIGHT = 44; // 单行高度，确保分页固定位置

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
        // 过滤掉未来的课程记录
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 设置为今天开始时间
        
        const filteredSchedules = (response.data.schedules || []).filter(record => {
          const recordDate = new Date(record.scheduleDate);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate <= today; // 只保留今天及以前的课程
        });
        
        // 前端排序：按日期和时间倒序排列
        const sortedSchedules = filteredSchedules.sort((a, b) => {
          // 先按日期比较
          const dateA = new Date(a.scheduleDate);
          const dateB = new Date(b.scheduleDate);
          const dateCompare = dateB.getTime() - dateA.getTime();
          
          if (dateCompare !== 0) {
            return dateCompare;
          }
          
          // 日期相同时按时间比较
          const timeA = a.timeRange ? a.timeRange.split('-')[0] : '';
          const timeB = b.timeRange ? b.timeRange.split('-')[0] : '';
          
          if (timeA && timeB) {
            // 比较时间字符串（如 "18:00" vs "17:00"）
            return timeB.localeCompare(timeA);
          }
          
          return 0;
        });
        
        setScheduleRecords(sortedSchedules);
        
        // 请假记录也进行排序
        const sortedLeaves = (response.data.leaves || []).sort((a, b) => {
          // 先按日期比较
          const dateA = new Date(a.leaveDate);
          const dateB = new Date(b.leaveDate);
          const dateCompare = dateB.getTime() - dateA.getTime();
          
          if (dateCompare !== 0) {
            return dateCompare;
          }
          
          // 日期相同时按时间比较
          const timeA = a.timeRange ? a.timeRange.split('-')[0] : '';
          const timeB = b.timeRange ? b.timeRange.split('-')[0] : '';
          
          if (timeA && timeB) {
            return timeB.localeCompare(timeA);
          }
          
          return 0;
        });
        
        setLeaveRecords(sortedLeaves);
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
          <CalendarOutlined style={{ marginRight: 6 }} />
          上课记录 ({scheduleRecords.length})
        </span>
      ),
      children: (
        <div style={{ minHeight: PAGE_SIZE * ITEM_ROW_HEIGHT, display: 'flex', flexDirection: 'column' }}>
        <div 
          style={{ 
            overflowX: 'auto', 
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <List
            className="fixed-height-list"
            dataSource={scheduleRecords}
            renderItem={(item, index) => (
              <List.Item key={`${item.scheduleDate}-${item.timeRange}-${item.status}-${index}`} style={{ padding: '8px 0', fontSize: '12px', minHeight: ITEM_ROW_HEIGHT - 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', minWidth: '400px', gap: '20px' }}>
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
                      color={item.timetableType === '实例课表' ? undefined : (item.timetableType === '大课分配课时' ? undefined : undefined)} 
                      style={{ 
                        fontSize: '10px',
                        backgroundColor: item.timetableType === '实例课表' ? 'rgba(114, 46, 209, 0.2)' : (item.timetableType === '大课分配课时' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(24, 144, 255, 0.2)'),
                        color: item.timetableType === '实例课表' ? '#722ed1' : (item.timetableType === '大课分配课时' ? '#ff8c00' : '#1890ff'),
                        border: item.timetableType === '实例课表' ? '1px solid rgba(114, 46, 209, 0.3)' : (item.timetableType === '大课分配课时' ? '1px solid rgba(255, 193, 7, 0.3)' : '1px solid rgba(24, 144, 255, 0.3)'),
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
              pageSize: PAGE_SIZE, 
              size: 'small',
              showSizeChanger: false,
              showQuickJumper: false,
              hideOnSinglePage: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
          />
        </div>
        </div>
      )
    },
    {
      key: 'leaves',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 6 }} />
          请假记录 ({leaveRecords.length})
        </span>
      ),
      children: (
        <div style={{ minHeight: PAGE_SIZE * ITEM_ROW_HEIGHT }}>
        <div 
          style={{ 
            overflowX: 'auto', 
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <List
            className="fixed-height-list"
            dataSource={leaveRecords}
            renderItem={(item, index) => (
              <List.Item key={`${item.leaveDate}-${item.timeRange}-${item.leaveReason || ''}-${index}`} style={{ padding: '8px 0', fontSize: '12px', minHeight: ITEM_ROW_HEIGHT - 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', minWidth: '300px', gap: '20px' }}>
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
                  <div style={{ minWidth: '120px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#fa8c16' }}>
                      {item.leaveReason || '未填写'}
                    </span>
                  </div>
                </div>
              </List.Item>
            )}
            pagination={{ 
              pageSize: PAGE_SIZE, 
              size: 'small',
              showSizeChanger: false,
              showQuickJumper: false,
              hideOnSinglePage: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
          />
        </div>
        </div>
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
      rootClassName="student-detail-modal"
      styles={{ 
        body: { 
          height: '60vh', 
          overflowY: 'auto',
          touchAction: 'pan-y'
        } 
      }}
    >
      <Spin spinning={loading}>
        <div className="student-detail-body">
        <div style={{ marginBottom: 12, fontSize: '13px' }}>
          <span style={{ color: '#666' }}>教练：</span>
          <span style={{ fontWeight: 500 }}>{actualCoachName}</span>
        </div>
        
        <Tabs
          defaultActiveKey="schedules"
          items={tabItems}
          size="small"
          destroyInactiveTabPane
          className="student-detail-tabs"
        />
        </div>
      </Spin>
    </Modal>
  );
};

export default StudentDetailModal;
