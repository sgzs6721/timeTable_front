import React, { useState, useEffect } from 'react';
import { Tabs, Button, Space, Badge, Dropdown, Spin, message, Card, Alert } from 'antd';
import { CalendarOutlined, LeftOutlined, CrownOutlined, UserAddOutlined, InboxOutlined, DownOutlined, MergeOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import UserManagement from './UserManagement';
import TimetableManagement from './TimetableManagement';
import './AdminPanel.css';
import { getAllRegistrationRequests, emergencyFixWeeklyInstances, autoFixWeeklyInstances, cleanDuplicateSchedules } from '../services/admin';

const AdminPanel = ({ user }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('timetables');
  const [pendingCount, setPendingCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);

  useEffect(() => {
    // 拉取待审批数量
    const fetchPending = async () => {
      try {
        const res = await getAllRegistrationRequests();
        if (res.success) {
          setPendingCount(res.data.filter(r => r.status === 'PENDING').length);
        }
      } catch {}
    };
    fetchPending();
  }, []);

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

  const tabItems = [
    {
      key: 'timetables',
      label: (
        <Space>
          <CalendarOutlined />
          <span>查看课表</span>
        </Space>
      ),
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
            
            {/* 右侧：批量操作按钮 - 只在非批量模式时显示 */}
            {!batchMode && (
              <div>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<MergeOutlined />} 
                  onClick={() => setBatchMode(true)} 
                  style={{ padding: '0 8px', height: 26, fontSize: 13 }}
                >
                  批量操作
                </Button>
              </div>
            )}
          </div>
          
          <TimetableManagement 
            user={user} 
            showArchived={showArchived} 
            onLoadingChange={setTimetableLoading}
            batchMode={batchMode}
            onBatchModeChange={setBatchMode}
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
    },
    {
      key: 'users',
      label: (
        <Space>
          <CrownOutlined />
          <span>权限管理</span>
        </Space>
      ),
      children: <UserManagement activeTab="users" />,
    },
    {
      key: 'pending',
      label: (
        <Space>
          <UserAddOutlined />
          <span>注册申请</span>
          {pendingCount > 0 && <Badge dot style={{ marginLeft: 2 }} />}
        </Space>
      ),
      children: <UserManagement activeTab="pending" />,
    },
    {
      key: 'maintenance',
      label: (
        <Space>
          <ToolOutlined />
          <span>系统维护</span>
        </Space>
      ),
      children: (
        <div>
          <Alert
            message="系统维护功能"
            description="这些功能用于修复系统中的数据问题，请谨慎使用。"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          
          <Card title="周实例数据修复" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="问题说明"
                description="如果发现固定课表的今日/明日/本周课程显示异常，可能是因为缺少当前周实例数据。"
                type="warning"
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
              
              <Space>
                <Button
                  type="primary"
                  danger
                  loading={fixLoading}
                  onClick={handleEmergencyFix}
                  disabled={fixLoading}
                >
                  紧急修复（详细报告）
                </Button>
                
                <Button
                  type="default"
                  loading={fixLoading}
                  onClick={handleAutoFix}
                  disabled={fixLoading}
                >
                  自动修复（静默）
                </Button>
              </Space>
              
              <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                <p>• 紧急修复：会显示详细的修复结果统计</p>
                <p>• 自动修复：只生成缺失的实例，不会重复生成</p>
              </div>
            </Space>
          </Card>
          
          <Card title="重复数据清理" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="问题说明"
                description="如果发现今日课程中显示重复的课程数据，可以使用此功能清理所有周实例中的重复课程。"
                type="warning"
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
              
              <Button
                type="primary"
                danger
                loading={fixLoading}
                onClick={handleCleanDuplicates}
                disabled={fixLoading}
              >
                清理重复课程数据
              </Button>
              
              <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                <p>• 此操作会检查所有周实例中的重复课程并删除重复项</p>
                <p>• 保留ID较小的课程记录（通常是先创建的）</p>
                <p>• 操作完成后会显示清理统计信息</p>
              </div>
            </Space>
          </Card>
        </div>
      ),
    },
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

    </div>
  );
};

export default AdminPanel; 