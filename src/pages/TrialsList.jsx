import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Tag, 
  Spin, 
  message, 
  Popconfirm, 
  DatePicker, 
  Select,
  Empty
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  PhoneOutlined,
  LeftCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { changeCustomerStatus } from '../services/customerStatusHistory';
import { cancelTrialSchedule } from '../services/customerStatusHistory';
import { getApiBaseUrl } from '../config/api';
import dayjs from 'dayjs';

const { Option } = Select;

const TrialsList = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [trials, setTrials] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [trialDateFilter, setTrialDateFilter] = useState(null);
  const [creatorsMap, setCreatorsMap] = useState({});

  useEffect(() => {
    fetchTrials();
  }, [selectedCreator, trialDateFilter]);

  const fetchTrials = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (selectedCreator) {
        params.append('createdById', selectedCreator);
      }
      
      if (trialDateFilter) {
        params.append('trialDate', trialDateFilter.format('YYYY-MM-DD'));
      }
      
      params.append('includeAll', 'true'); // 包括所有状态的体验记录
      
      const response = await fetch(
        `${getApiBaseUrl()}/customers/trials?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.success) {
        // 前端再做一层去重：同一个客户（姓名+电话相同）只保留一条最新的记录
        const trialsData = data.data || [];
        const uniqueTrialsMap = new Map();
        
        trialsData.forEach(trial => {
          const key = `${trial.childName}-${trial.parentPhone}`;
          const existing = uniqueTrialsMap.get(key);
          
          // 如果没有记录，或者当前记录更新，则保存
          if (!existing || 
              (trial.createdAt && existing.createdAt && trial.createdAt > existing.createdAt)) {
            uniqueTrialsMap.set(key, trial);
          }
        });
        
        const uniqueTrials = Array.from(uniqueTrialsMap.values());
        setTrials(uniqueTrials);
        
        // 构建录入人员映射
        const creators = {};
        uniqueTrials.forEach(trial => {
          if (trial.createdById && trial.createdByName) {
            creators[trial.createdById] = trial.createdByName;
          }
        });
        setCreatorsMap(creators);
      } else {
        message.error('获取体验列表失败');
      }
    } catch (error) {
      console.error('获取体验列表失败:', error);
      message.error('获取体验列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrialFromList = async (trial) => {
    try {
      message.loading({ content: '正在标记为已体验...', key: 'completeTrial' });
      
      const response = await changeCustomerStatus(trial.customerId, {
        toStatus: 'VISITED',
        notes: '体验课程已完成'
      });
      
      if (response && response.success) {
        message.success({ content: '✓ 已标记为已体验', key: 'completeTrial' });
        await fetchTrials();
      } else {
        message.error({ content: response.message || '标记失败', key: 'completeTrial' });
      }
    } catch (error) {
      console.error('完成体验课程失败:', error);
      message.error({ content: '标记为已体验失败', key: 'completeTrial' });
    }
  };

  const handleCancelTrialFromList = async (trial) => {
    try {
      message.loading({ content: '正在取消体验课程...', key: 'cancelTrial' });
      
      const response = await cancelTrialSchedule(
        trial.customerId,
        trial.historyId
      );
      
      if (response && response.success) {
        message.success({ content: '✓ 体验课程已取消', key: 'cancelTrial' });
        await fetchTrials();
      } else {
        message.error({ content: response.message || '取消失败', key: 'cancelTrial' });
      }
    } catch (error) {
      console.error('取消体验课程失败:', error);
      message.error({ content: '取消体验课程失败', key: 'cancelTrial' });
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      'SCHEDULED': { text: '待体验', color: 'purple' },
      'RE_EXPERIENCE': { text: '待再体验', color: 'cyan' },
      'VISITED': { text: '已体验', color: 'green' },
      'SOLD': { text: '已成交', color: 'success' }
    };
    
    const config = statusMap[status] || { text: status, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    try {
      navigator.clipboard.writeText(phone).then(() => message.success('手机号已复制'));
    } catch (e) {
      message.error('复制失败');
    }
  };

  // 按日期分组
  const groupedTrials = trials.reduce((groups, trial) => {
    const dateKey = trial.trialScheduleDate ? dayjs(trial.trialScheduleDate).format('YYYY-MM-DD') : 'unknown';
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(trial);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedTrials).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ padding: '0', width: '100%', height: '100vh', overflow: 'auto' }}>
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Button 
              type="text" 
              icon={<LeftCircleOutlined style={{ fontSize: '20px' }} />} 
              onClick={onClose}
              style={{ position: 'absolute', left: 0 }}
            />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>体验列表</span>
          </div>
        }
        styles={{ body: { padding: '12px' } }}
        style={{ borderRadius: 0, border: 'none' }}
      >
        {/* 过滤器 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '12px', flexWrap: 'nowrap' }}>
          <Select
            placeholder="全部录入人员"
            value={selectedCreator}
            onChange={setSelectedCreator}
            allowClear
            style={{ flex: 1 }}
          >
            {Object.entries(creatorsMap).map(([id, name]) => (
              <Option key={id} value={parseInt(id)}>
                {name}
              </Option>
            ))}
          </Select>
          
          <DatePicker
            placeholder="选择体验日期"
            value={trialDateFilter}
            onChange={setTrialDateFilter}
            format="YYYY-MM-DD"
            allowClear
            style={{ flex: 1 }}
          />
        </div>

        {/* 体验列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : trials.length === 0 ? (
          <Empty description="暂无体验记录" />
        ) : (
          <div>
            {sortedDates.map(dateKey => {
              const dateTrials = groupedTrials[dateKey];
              const date = dateKey !== 'unknown' ? dayjs(dateKey) : null;
              
              return (
                <div key={dateKey} style={{ marginBottom: 24 }}>
                  {/* 日期标题 */}
                  {date && (
                    <div style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(67, 206, 162, 0.25)',
                      marginBottom: 12,
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: '500',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarOutlined />
                        {date.format('YYYY-MM-DD dddd')}
                      </div>
                      <span style={{ fontSize: '13px' }}>
                        共 {dateTrials.length} 条
                      </span>
                    </div>
                  )}
                  
                  {/* 体验卡片 */}
                  {dateTrials.map(trial => (
                    <Card
                      key={trial.historyId}
                      size="small"
                      style={{ 
                        marginBottom: 12,
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                    >
                      {/* 第一行：状态标签和姓名 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getStatusTag(trial.status)}
                          <span style={{ fontSize: '16px', fontWeight: '500' }}>
                            {trial.childName}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', color: '#666' }}>
                          <PhoneOutlined style={{ marginRight: '4px', fontSize: '13px' }} />
                          <a 
                            href={`tel:${trial.parentPhone}`}
                            style={{ color: '#1890ff', textDecoration: 'none' }}
                          >
                            {trial.parentPhone}
                          </a>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopyPhone(trial.parentPhone)}
                            style={{ marginLeft: 4 }}
                          />
                        </div>
                      </div>

                      {/* 第二行：体验时间 */}
                      <div style={{ 
                        marginBottom: 8,
                        fontSize: '14px',
                        color: '#1890ff'
                      }}>
                        <ClockCircleOutlined style={{ marginRight: 6 }} />
                        体验时间：
                        {trial.trialScheduleDate 
                          ? dayjs(trial.trialScheduleDate).format('YYYY-MM-DD') 
                          : '-'} {trial.trialStartTime || ''}-{trial.trialEndTime || ''}
                      </div>

                      {/* 第三行：教练和操作按钮 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: '13px', 
                        color: '#666'
                      }}>
                        <div>
                          <UserOutlined style={{ marginRight: '6px' }} />
                          教练：{trial.trialCoachName || '未指定'}
                        </div>
                        
                        {/* 只有待体验状态才显示操作按钮 */}
                        {(trial.status === 'SCHEDULED' || trial.status === 'RE_EXPERIENCE') && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Popconfirm
                              title="确定取消体验课程？"
                              description="取消后将标记为已取消"
                              onConfirm={() => handleCancelTrialFromList(trial)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button 
                                type="text" 
                                danger
                                size="small"
                                icon={<CloseCircleOutlined />}
                              >
                                取消
                              </Button>
                            </Popconfirm>
                            <Popconfirm
                              title="确定标记为已体验？"
                              description="标记后客户状态将变更为已体验"
                              onConfirm={() => handleCompleteTrialFromList(trial)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <Button 
                                type="text" 
                                size="small"
                                icon={<CheckCircleOutlined />}
                                style={{ color: '#52c41a' }}
                              >
                                完成
                              </Button>
                            </Popconfirm>
                          </div>
                        )}
                      </div>

                      {/* 录入信息 */}
                      {(trial.createdByName || trial.createdAt) && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#999',
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: '1px solid #f0f0f0'
                        }}>
                          {trial.createdByName && <span>{trial.createdByName}</span>}
                          {trial.createdAt && (
                            <span style={{ marginLeft: 8 }}>
                              录入于 {dayjs(trial.createdAt).format('YYYY-MM-DD HH:mm')}
                            </span>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TrialsList;

