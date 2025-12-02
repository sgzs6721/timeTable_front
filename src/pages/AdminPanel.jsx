import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, Badge, Dropdown, Spin, message, Card, Alert, Modal, Select, Input, Radio, DatePicker, Row, Col } from 'antd';
import { CalendarOutlined, LeftOutlined, CrownOutlined, UserAddOutlined, InboxOutlined, DownOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import UserManagement from './UserManagement';
import TimetableManagement from './TimetableManagement';
import Footer from '../components/Footer';
import './AdminPanel.css';
import { getAllRegistrationRequests, emergencyFixWeeklyInstances, autoFixWeeklyInstances, cleanDuplicateSchedules, getAllUsers, createTimetableForUser } from '../services/admin';
import { getCurrentUserPermissions } from '../services/rolePermission';
import dayjs from 'dayjs';

const { Option } = Select;

const AdminPanel = ({ user }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('timetables');
  const [pendingCount, setPendingCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  
  // 创建课表相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // 用于触发课表列表刷新
  const [newTimetableForm, setNewTimetableForm] = useState({
    userId: null,
    name: '',
    isWeekly: 1,
    startDate: null,
    endDate: null
  });

  // 获取当前用户权限配置
  const fetchUserPermissions = async () => {
    try {
      const response = await getCurrentUserPermissions();
      if (response && response.success) {
        setUserPermissions(response.data);
      }
    } catch (error) {
      console.error('获取用户权限失败:', error);
    }
  };

  useEffect(() => {
    // 获取用户权限
    fetchUserPermissions();
    // 获取所有用户（教练）列表
    fetchCoaches();
  }, []);

  // 基于权限拉取待审批数量
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await getAllRegistrationRequests();
        if (res.success) {
          setPendingCount(res.data.filter(r => r.status === 'PENDING').length);
        }
      } catch {}
    };
    if (userPermissions?.actionPermissions?.admin && userPermissions?.actionPermissions?.admin_pending) {
      fetchPending();
    }
  }, [userPermissions]);

  // 获取教练列表
  const fetchCoaches = async () => {
    try {
      const response = await getAllUsers();
      if (response && response.success) {
        setCoaches(response.data || []);
      }
    } catch (error) {
      console.error('获取教练列表失败:', error);
    }
  };

  // 打开创建课表对话框
  const handleOpenCreateModal = () => {
    setNewTimetableForm({
      userId: null,
      name: '',
      isWeekly: 1,
      startDate: null,
      endDate: null
    });
    setCreateModalVisible(true);
  };

  // 确认创建课表
  const handleConfirmCreate = async () => {
    const { userId, name, isWeekly, startDate, endDate } = newTimetableForm;
    
    if (!userId) {
      message.error('请选择教练');
      return;
    }
    
    if (!name || !name.trim()) {
      message.error('请输入课表名称');
      return;
    }
    
    // 如果是日期范围课表，需要验证日期
    if (isWeekly === 0) {
      if (!startDate) {
        message.error('请选择开始日期');
        return;
      }
      if (!endDate) {
        message.error('请选择结束日期');
        return;
      }
      if (dayjs(endDate).isBefore(dayjs(startDate))) {
        message.error('结束日期不能早于开始日期');
        return;
      }
    }
    
    // 获取被选中教练的机构ID
    const selectedCoach = coaches.find(c => c.id === userId);
    const organizationId = selectedCoach?.organizationId;
    
    setCreateLoading(true);
    try {
      const response = await createTimetableForUser({
        userId: userId,
        name: name.trim(),
        description: '',
        isWeekly: isWeekly,
        startDate: isWeekly === 0 ? dayjs(startDate).format('YYYY-MM-DD') : null,
        endDate: isWeekly === 0 ? dayjs(endDate).format('YYYY-MM-DD') : null,
        organizationId: organizationId
      });
      
      if (response && response.success) {
        message.success('课表创建成功');
        setCreateModalVisible(false);
        setNewTimetableForm({
          userId: null,
          name: '',
          isWeekly: 1,
          startDate: null,
          endDate: null
        });
        // 触发课表列表局部刷新
        setRefreshTrigger(prev => prev + 1);
      } else {
        message.error(response?.message || '创建课表失败');
      }
    } catch (error) {
      message.error('创建课表失败，请检查网络连接');
    } finally {
      setCreateLoading(false);
    }
  };

  // 紧急修复周实例
  const handleEmergencyFix = async () => {
    setFixLoading(true);
    try {
      const response = await emergencyFixWeeklyInstances();
      if (response.success) {
        const { totalTimetables, successCount, failedCount, skippedCount } = response.data;
        message.success(`紧急修复完成！总数: ${totalTimetables}, 成功: ${successCount}, 失败: ${failedCount}, 跳过: ${skippedCount}`);
      } else {
        message.error('紧急修复失败：' + response.message);
      }
    } catch (error) {
      message.error('紧急修复失败：' + error.message);
    } finally {
      setFixLoading(false);
    }
  };

  // 自动修复周实例
  const handleAutoFix = async () => {
    setFixLoading(true);
    try {
      const response = await autoFixWeeklyInstances();
      if (response.success) {
        message.success('自动修复完成！已检查并生成缺失的当前周实例');
      } else {
        message.error('自动修复失败：' + response.message);
      }
    } catch (error) {
      message.error('自动修复失败：' + error.message);
    } finally {
      setFixLoading(false);
    }
  };

  // 清理重复课程数据
  const handleCleanDuplicates = async () => {
    setFixLoading(true);
    try {
      const response = await cleanDuplicateSchedules();
      if (response.success) {
        const result = response.data;
        message.success(`清理完成！处理了 ${result.instancesProcessed} 个实例，清理了 ${result.totalCleaned} 个重复课程`);
      } else {
        message.error('清理重复数据失败：' + response.message);
      }
    } catch (error) {
      message.error('清理重复数据失败：' + error.message);
    } finally {
      setFixLoading(false);
    }
  };

  // 查看课表下拉菜单配置
  const getTimetableDropdownMenu = () => ({
    items: [
      {
        key: 'archived',
        label: showArchived ? '活跃课表' : '归档课表',
        icon: <InboxOutlined />,
        onClick: () => {
          setTimetableLoading(true);
          setShowArchived(!showArchived);
        },
      },
    ],
  });

  const canAdmin = userPermissions?.actionPermissions?.admin === true;
  const canAdminTimetables = canAdmin && userPermissions?.actionPermissions?.admin_timetables === true;
  const canAdminPending = canAdmin && userPermissions?.actionPermissions?.admin_pending === true;

  const tabItems = [
    ...(canAdminTimetables ? [{
      key: 'timetables',
      label: '课表管理',
      children: (
        <div style={{ position: 'relative' }}>
          {/* 课表类型切换按钮和批量操作 */}
          <div style={{ 
            marginBottom: '16px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {/* 左侧：课表类型切换按钮 */}
            <div style={{ display: 'flex', gap: 0 }}>
              <Button
                onClick={() => {
                  setTimetableLoading(true);
                  setShowArchived(false);
                }}
                style={{ 
                  borderRadius: '6px 0 0 6px',
                  borderRight: 'none',
                  backgroundColor: !showArchived ? '#1890ff' : 'transparent',
                  borderColor: '#1890ff',
                  color: !showArchived ? '#fff' : '#1890ff'
                }}
              >
                <CalendarOutlined />
                活跃课表
              </Button>
              <Button
                onClick={() => {
                  setTimetableLoading(true);
                  setShowArchived(true);
                }}
                style={{ 
                  borderRadius: '0 6px 6px 0',
                  borderLeft: 'none',
                  backgroundColor: showArchived ? '#ff8c00' : 'transparent',
                  borderColor: '#ff8c00',
                  color: showArchived ? '#fff' : '#ff8c00'
                }}
              >
                <InboxOutlined />
                归档课表
              </Button>
            </div>
            
            {/* 右侧：操作按钮 - 只在非批量模式时显示 */}
            {!batchMode && (
              <Space size="small">
                <Button 
                  size="small" 
                  onClick={handleOpenCreateModal}
                  style={{ 
                    padding: '0 12px', 
                    height: 26, 
                    fontSize: 13,
                    backgroundColor: '#e6f7ff',
                    borderColor: '#91d5ff',
                    color: '#1890ff'
                  }}
                >
                  创建
                </Button>
                <Button 
                  size="small" 
                  onClick={() => setBatchMode(true)} 
                  style={{ 
                    padding: '0 12px', 
                    height: 26, 
                    fontSize: 13,
                    backgroundColor: '#fff7e6',
                    borderColor: '#ffd591',
                    color: '#fa8c16'
                  }}
                >
                  批量操作
                </Button>
              </Space>
            )}
          </div>
          
          <TimetableManagement 
            user={user} 
            showArchived={showArchived} 
            onLoadingChange={setTimetableLoading}
            batchMode={batchMode}
            onBatchModeChange={setBatchMode}
            refreshTrigger={refreshTrigger}
          />
          {timetableLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}>
              <Spin size="large" />
            </div>
          )}
        </div>
      ),
    }] : []),
    ...(canAdmin ? [{
      key: 'users',
      label: '用户管理',
      children: <UserManagement activeTab="users" />,
    }] : []),
    ...(canAdminPending ? [{
      key: 'pending',
      label: (
        <span>
          注册通知
          {pendingCount > 0 && <Badge dot style={{ marginLeft: 2 }} />}
        </span>
      ),
      children: <UserManagement activeTab="pending" />,
    }] : []),
  ];

  const renderTabBar = (props, DefaultTabBar) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', position: 'relative', marginTop: '1rem', marginBottom: '1rem'}}>
        <Button
          onClick={() => navigate('/dashboard')}
          icon={<LeftOutlined />}
          shape="circle"
          style={{ 
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Space align="center" size="large">
            <h1 style={{ margin: 0, fontSize: '22px' }}>管理员面板</h1>
          </Space>
        </div>
      </div>
      <DefaultTabBar {...props} />
    </div>
  );

  const DesktopHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
      <Button
        onClick={() => navigate('/dashboard')}
        icon={<LeftOutlined />}
        shape="circle"
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Space align="center" size="large">
          <CrownOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
          <h1 style={{ margin: 0 }}>管理员面板</h1>
        </Space>
      </div>
    </div>
  );

  return (
    <div className={isMobile ? "page-container-mobile-admin" : "page-container"}>
      {!isMobile && <DesktopHeader />}
      <div className={isMobile ? "mobile-tabs-container with-gradient-border" : ""}>
        <Tabs
          defaultActiveKey="timetables"
          items={tabItems}
          size="large"
          renderTabBar={isMobile ? renderTabBar : undefined}
          className={!isMobile ? "desktop-tabs with-gradient-border" : ""}
          onChange={(key) => setActiveTab(key)}
        />
      </div>
      
      {/* 创建课表模态框 */}
      <Modal
        title="为教练创建课表"
        open={createModalVisible}
        onOk={handleConfirmCreate}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              选择教练 <span style={{ color: 'red' }}>*</span>
            </label>
            <Select
              value={newTimetableForm.userId}
              onChange={(value) => setNewTimetableForm({ ...newTimetableForm, userId: value })}
              style={{ width: '100%' }}
              placeholder="请选择教练"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {coaches.filter(coach => coach.position === 'COACH').map(coach => (
                <Option key={coach.id} value={coach.id} label={coach.nickname || coach.username}>
                  {coach.nickname || coach.username}
                  <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>
                    (教练)
                  </span>
                </Option>
              ))}
            </Select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              课表名称 <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={newTimetableForm.name}
              onChange={(e) => setNewTimetableForm({ ...newTimetableForm, name: e.target.value })}
              placeholder="请输入课表名称"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              课表类型 <span style={{ color: 'red' }}>*</span>
            </label>
            <Radio.Group
              value={newTimetableForm.isWeekly}
              onChange={(e) => setNewTimetableForm({ 
                ...newTimetableForm, 
                isWeekly: e.target.value,
                startDate: null,
                endDate: null
              })}
            >
              <Radio value={1}>周固定课表</Radio>
              <Radio value={0}>日期范围课表</Radio>
            </Radio.Group>
          </div>
          
          {/* 日期范围课表时显示日期选择器 */}
          {newTimetableForm.isWeekly === 0 && (
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    开始日期 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <DatePicker
                    value={newTimetableForm.startDate}
                    onChange={(date) => setNewTimetableForm({ ...newTimetableForm, startDate: date })}
                    style={{ width: '100%' }}
                    placeholder="选择开始日期"
                  />
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    结束日期 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <DatePicker
                    value={newTimetableForm.endDate}
                    onChange={(date) => setNewTimetableForm({ ...newTimetableForm, endDate: date })}
                    style={{ width: '100%' }}
                    placeholder="选择结束日期"
                  />
                </div>
              </Col>
            </Row>
          )}
        </div>
      </Modal>
      
      {/* 版权信息 */}
      <Footer />
    </div>
  );
};

export default AdminPanel; 