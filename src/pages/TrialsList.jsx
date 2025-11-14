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
  Empty,
  Input,
  TimePicker,
  Space
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  PhoneOutlined,
  LeftOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  HistoryOutlined,
  UserSwitchOutlined,
  SearchOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import CustomerStatusHistoryModal from '../components/CustomerStatusHistoryModal';
import { changeCustomerStatus } from '../services/customerStatusHistory';
import { cancelTrialSchedule } from '../services/customerStatusHistory';
import { getApiBaseUrl } from '../config/api';
import dayjs from 'dayjs';

const { Option } = Select;

const TrialsList = ({ onClose, onNavigateToCustomer }) => {
  const [loading, setLoading] = useState(false);
  const [trials, setTrials] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [trialDateFilter, setTrialDateFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null); // 状态过滤器
  const [searchKeyword, setSearchKeyword] = useState(''); // 搜索关键字（姓名或电话）
  const [creatorsMap, setCreatorsMap] = useState({});
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingTrialId, setEditingTrialId] = useState(null); // 正在编辑的体验ID
  const [editingDate, setEditingDate] = useState(null); // 编辑中的日期
  const [editingTimeRange, setEditingTimeRange] = useState(null); // 编辑中的时间范围
  const [editingLoading, setEditingLoading] = useState(false); // 编辑保存中
  
  // 获取当前用户信息
  const [currentUser, setCurrentUser] = useState(null);
  const isSales = currentUser?.position?.toUpperCase() === 'SALES';
  const isCoach = currentUser?.position?.toUpperCase() === 'COACH';
  const isManager = currentUser?.position?.toUpperCase() === 'MANAGER';
  const isAdmin = currentUser?.position?.toUpperCase() === 'MANAGER';

  useEffect(() => {
    // 获取用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      // 销售和教练职位自动设置为只看自己
      const position = user.position?.toUpperCase();
      if ((position === 'SALES' || position === 'COACH') && user.id) {
        setSelectedCreator(user.id);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchTrials();
    }
  }, [selectedCreator, trialDateFilter, statusFilter, searchKeyword, currentUser]);

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
        let trialsData = data.data || [];
        
        // 应用状态过滤
        if (statusFilter) {
          if (statusFilter === 'CANCELLED') {
            // 已取消状态
            trialsData = trialsData.filter(trial => trial.trialCancelled === true);
          } else if (statusFilter === 'PENDING') {
            // 待体验（包括待体验和待再体验，且未取消）
            trialsData = trialsData.filter(trial => 
              !trial.trialCancelled && 
              (trial.status === 'SCHEDULED' || trial.status === 'RE_EXPERIENCE')
            );
          } else if (statusFilter === 'COMPLETED') {
            // 已完成（已体验或已成交，且未取消）
            trialsData = trialsData.filter(trial => 
              !trial.trialCancelled && 
              (trial.status === 'VISITED' || trial.status === 'SOLD')
            );
          }
        }
        
        // 应用姓名或电话搜索过滤
        if (searchKeyword && searchKeyword.trim()) {
          const keyword = searchKeyword.trim().toLowerCase();
          trialsData = trialsData.filter(trial => 
            (trial.childName && trial.childName.toLowerCase().includes(keyword)) ||
            (trial.parentPhone && trial.parentPhone.includes(keyword))
          );
        }
        
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

  // 开始编辑体验时间
  const handleStartEditTrial = (trial) => {
    setEditingTrialId(trial.historyId);
    setEditingDate(trial.trialScheduleDate ? dayjs(trial.trialScheduleDate) : null);
    if (trial.trialStartTime && trial.trialEndTime) {
      setEditingTimeRange([
        dayjs(trial.trialStartTime, 'HH:mm:ss'),
        dayjs(trial.trialEndTime, 'HH:mm:ss')
      ]);
    }
  };

  // 保存编辑的体验时间
  const handleSaveEditTrial = async (trial) => {
    if (!editingDate || !editingTimeRange || editingTimeRange.length !== 2) {
      message.warning('请选择完整的日期和时间');
      return;
    }

    setEditingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiBaseUrl()}/customers/${trial.customerId}/status-history/${trial.historyId}/update-trial-time`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trialScheduleDate: editingDate.format('YYYY-MM-DD'),
            trialStartTime: editingTimeRange[0].format('HH:mm:ss'),
            trialEndTime: editingTimeRange[1].format('HH:mm:ss')
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        message.success('体验时间已更新');
        setEditingTrialId(null);
        setEditingDate(null);
        setEditingTimeRange(null);
        await fetchTrials();
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新体验时间失败:', error);
      message.error('更新失败');
    } finally {
      setEditingLoading(false);
    }
  };

  // 取消编辑
  const handleCancelEditTrial = () => {
    setEditingTrialId(null);
    setEditingDate(null);
    setEditingTimeRange(null);
  };

  const getStatusTag = (trial) => {
    // 如果体验被取消，显示已取消标签
    if (trial.trialCancelled) {
      return <Tag color="error" style={{ fontSize: '14px', padding: '2px 8px' }}>已取消</Tag>;
    }
    
    const statusMap = {
      'SCHEDULED': { text: '待体验', color: 'purple' },
      'RE_EXPERIENCE': { text: '待再体验', color: 'cyan' },
      'VISITED': { text: '已体验', color: 'green' },
      'SOLD': { text: '已成交', color: 'success' },
      'PENDING_CONFIRM': { text: '待确认', color: 'orange' },
      'PENDING_SOLD': { text: '待成交', color: 'gold' }
    };
    
    const config = statusMap[trial.status] || { text: trial.status, color: 'default' };
    return <Tag color={config.color} style={{ fontSize: '14px', padding: '2px 8px' }}>{config.text}</Tag>;
  };

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    try {
      navigator.clipboard.writeText(phone).then(() => message.success('手机号已复制'));
    } catch (e) {
      message.error('复制失败');
    }
  };

  const handleOpenHistory = (trial, e) => {
    if (e) {
      e.stopPropagation();
    }
    // 构造客户对象，用于传递给 CustomerStatusHistoryModal
    const customerObj = {
      id: trial.customerId,
      childName: trial.childName,
      parentPhone: trial.parentPhone,
      status: trial.status
    };
    setSelectedCustomer(customerObj);
    setHistoryModalVisible(true);
  };

  const handleHistorySuccess = async () => {
    // 流转记录更新后，刷新体验列表
    await fetchTrials();
  };

  const handleNavigateToCustomer = (trial, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (onNavigateToCustomer) {
      onNavigateToCustomer({
        customerId: trial.customerId,
        customerName: trial.childName
      });
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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            position: 'relative',
            minHeight: '44px'
          }}>
            <Button 
              type="text" 
              icon={<LeftOutlined style={{ fontSize: 20 }} />} 
              onClick={onClose}
              style={{ 
                position: 'absolute', 
                left: 2,
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '1px solid #d9d9d9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            />
            <span style={{ fontSize: '20px', fontWeight: '500' }}>体验列表</span>
          </div>
        }
        styles={{ 
          body: { padding: '12px' },
          header: { padding: '24px 20px', minHeight: '88px' }
        }}
        style={{ borderRadius: 0, border: 'none' }}
      >
        {/* 过滤器 */}
        <div style={{ marginBottom: 16 }}>
          {/* 第一行过滤器 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <Select
              placeholder={(isSales || isCoach) ? (currentUser?.nickname || currentUser?.username || "当前用户") : "全部录入人员"}
              value={selectedCreator}
              onChange={setSelectedCreator}
              allowClear={!(isSales || isCoach)}
              disabled={isSales || isCoach}
              style={{ width: '50%' }}
            >
              {(isSales || isCoach) ? (
                // 销售和教练职位只显示自己
                <Option value={currentUser?.id}>
                  {currentUser?.nickname || currentUser?.username}
                </Option>
              ) : (
                // 管理员职位显示所有录入人
                Object.entries(creatorsMap).map(([id, name]) => (
                  <Option key={id} value={parseInt(id)}>
                    {name}
                  </Option>
                ))
              )}
            </Select>
            
            <DatePicker
              placeholder="选择体验日期"
              value={trialDateFilter}
              onChange={setTrialDateFilter}
              format="YYYY-MM-DD"
              allowClear
              style={{ width: '50%' }}
            />
          </div>
          
          {/* 第二行过滤器 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Input
              placeholder="人员姓名或电话"
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              style={{ width: '50%' }}
            />
            
            <Select
              placeholder="全部状态"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: '50%' }}
            >
              <Option value="PENDING">待体验</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="CANCELLED">已取消</Option>
            </Select>
          </div>
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
                      padding: '14px 20px',
                      background: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(67, 206, 162, 0.25)',
                      marginBottom: 12,
                      color: '#fff',
                      fontSize: '17px',
                      fontWeight: '500',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarOutlined style={{ fontSize: '18px' }} />
                        {date.format('YYYY-MM-DD dddd')}
                      </div>
                      <span style={{ fontSize: '15px' }}>
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
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        ...(trial.trialCancelled && {
                          backgroundColor: '#fafafa',
                          opacity: 0.7
                        })
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
                          {getStatusTag(trial)}
                          <span style={{ fontSize: '18px', fontWeight: '500' }}>
                            {trial.childName}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', color: '#666' }}>
                          <a 
                            href={`tel:${trial.parentPhone}`}
                            style={{ color: '#1890ff', textDecoration: 'none', fontSize: '15px' }}
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
                      {editingTrialId === trial.historyId ? (
                        // 编辑模式
                        <div style={{ 
                          marginBottom: 8,
                          padding: '8px',
                          backgroundColor: '#f0f5ff',
                          borderRadius: '4px',
                          border: '1px solid #91caff'
                        }}>
                          <div style={{ marginBottom: 8, fontSize: '13px', color: '#1890ff', fontWeight: 500 }}>
                            编辑体验时间：
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: 8 }}>
                            <DatePicker
                              value={editingDate}
                              onChange={setEditingDate}
                              format="YYYY-MM-DD"
                              style={{ flex: 1 }}
                              placeholder="选择日期"
                              inputReadOnly
                              getPopupContainer={() => document.body}
                            />
                            <TimePicker.RangePicker
                              value={editingTimeRange}
                              onChange={setEditingTimeRange}
                              format="HH:mm"
                              style={{ flex: 1 }}
                              placeholder={['开始', '结束']}
                              minuteStep={30}
                              showNow={false}
                              inputReadOnly
                              hideDisabledOptions={true}
                              getPopupContainer={() => document.body}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <Button 
                              size="small" 
                              icon={<SaveOutlined />}
                              type="primary"
                              loading={editingLoading}
                              onClick={() => handleSaveEditTrial(trial)}
                            >
                              保存
                            </Button>
                            <Button 
                              size="small" 
                              icon={<CloseOutlined />}
                              onClick={handleCancelEditTrial}
                              disabled={editingLoading}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // 显示模式
                        <div style={{ 
                          marginBottom: 8,
                          fontSize: '16px',
                          color: '#666',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <ClockCircleOutlined style={{ marginRight: 6, fontSize: '16px' }} />
                            时间：
                            {trial.trialScheduleDate 
                              ? dayjs(trial.trialScheduleDate).format('YYYY-MM-DD') 
                              : '-'} {trial.trialStartTime ? dayjs(trial.trialStartTime, 'HH:mm:ss').format('HH:mm') : ''}-{trial.trialEndTime ? dayjs(trial.trialEndTime, 'HH:mm:ss').format('HH:mm') : ''}
                          </div>
                          {!trial.trialCancelled && (trial.status === 'SCHEDULED' || trial.status === 'RE_EXPERIENCE') && (
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleStartEditTrial(trial)}
                              style={{ color: '#666', padding: 0 }}
                            />
                          )}
                        </div>
                      )}

                      {/* 第三行：教练 */}
                      <div style={{ 
                        marginBottom: 8,
                        fontSize: '16px',
                        color: '#666'
                      }}>
                        <UserOutlined style={{ marginRight: '6px', fontSize: '16px' }} />
                        教练：{trial.trialCoachName || '未指定'}
                      </div>

                      {/* 第四行：操作按钮 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        alignItems: 'center',
                        fontSize: '15px', 
                        color: '#666'
                      }}>
                        
                        {/* 只有待体验状态且未取消才显示取消和完成按钮 */}
                        {!trial.trialCancelled && (trial.status === 'SCHEDULED' || trial.status === 'RE_EXPERIENCE') && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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

                      {/* 录入信息和流转记录 */}
                      {(trial.createdByName || trial.createdAt) && (
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px', 
                          color: '#999',
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div>
                              {trial.createdByName && <span>{trial.createdByName}</span>}
                              {trial.createdAt && (
                                <span style={{ marginLeft: 8 }}>
                                  录入于 {dayjs(trial.createdAt).format('YYYY-MM-DD HH:mm')}
                                </span>
                              )}
                            </div>
                            
                            {/* 已完成标识 */}
                            {!trial.trialCancelled && (trial.status === 'VISITED' || trial.status === 'SOLD') && (
                              <Tag color="green" style={{ margin: 0, fontSize: '12px' }}>
                                已完成
                              </Tag>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {/* 跳转到客源按钮 */}
                            <Button 
                              type="text"
                              size="small"
                              icon={<UserSwitchOutlined style={{ fontSize: '16px' }} />}
                              onClick={(e) => handleNavigateToCustomer(trial, e)}
                              title="查看客户详情"
                              style={{ color: '#52c41a', padding: '0 4px' }}
                            />
                            
                            {/* 流转记录按钮 */}
                            <Button 
                              type="text"
                              size="small"
                              icon={<HistoryOutlined style={{ fontSize: '16px' }} />}
                              onClick={(e) => handleOpenHistory(trial, e)}
                              title="流转记录"
                              style={{ color: '#1890ff', padding: '0 4px' }}
                            />
                          </div>
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

      {/* 客户状态流转记录模态框 */}
      <CustomerStatusHistoryModal
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        customer={selectedCustomer}
        onSuccess={handleHistorySuccess}
        hideHistory={true}
      />
    </div>
  );
};

export default TrialsList;

