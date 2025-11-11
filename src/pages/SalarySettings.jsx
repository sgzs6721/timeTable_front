import React, { useState, useEffect } from 'react';
import { Card, InputNumber, Button, message, Spin, Select, Empty, Modal, Popconfirm } from 'antd';
import { SaveOutlined, UserOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { getAllUserSalarySettings, saveOrUpdateSalarySetting, deleteSalarySetting } from '../services/salary';

const SalarySettings = ({ organizationId }) => {
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]); // 所有用户列表
  const [selectedUsers, setSelectedUsers] = useState([]); // 已选择的用户列表（可以有多个）
  const [editedData, setEditedData] = useState({}); // 编辑的数据 {userId: {baseSalary, ...}}
  const [savingUserId, setSavingUserId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false); // 选择人员模态框
  const [tempSelectedUserId, setTempSelectedUserId] = useState(null); // 临时选择的用户ID
  const [deleteModalVisible, setDeleteModalVisible] = useState(false); // 删除确认模态框
  const [userToDelete, setUserToDelete] = useState(null); // 要删除的用户

  useEffect(() => {
    if (organizationId) {
      fetchAllUsers();
    }
  }, [organizationId]);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await getAllUserSalarySettings(organizationId);
      if (response && response.success) {
        const allUsersData = response.data || [];
        setAllUsers(allUsersData);
        
        // 自动显示已有工资设置的用户（过滤掉工资数据全为0的用户）
        const usersWithSalarySettings = allUsersData.filter(user =>
          user.role === 'USER' && (
            (user.baseSalary && user.baseSalary > 0) ||
            (user.socialSecurity && user.socialSecurity > 0) ||
            (user.hourlyRate && user.hourlyRate > 0) ||
            (user.commissionRate && user.commissionRate > 0)
          )
        );
        
        // 将有工资设置的用户添加到selectedUsers中
        if (usersWithSalarySettings.length > 0) {
          setSelectedUsers(usersWithSalarySettings);
          
          // 初始化编辑数据
          const initialEditData = {};
          usersWithSalarySettings.forEach(user => {
            initialEditData[user.userId] = {
              baseSalary: user.baseSalary,
              socialSecurity: user.socialSecurity,
              hourlyRate: user.hourlyRate,
              commissionRate: user.commissionRate
            };
          });
          setEditedData(initialEditData);
        }
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开选择人员模态框
  const handleOpenModal = () => {
    setTempSelectedUserId(null);
    setModalVisible(true);
  };

  // 确认选择人员
  const handleConfirmSelect = () => {
    if (!tempSelectedUserId) {
      message.warning('请选择人员');
      return;
    }

    // 检查是否已经添加过
    if (selectedUsers.find(u => u.userId === tempSelectedUserId)) {
      message.warning('该人员已添加');
      return;
    }

    const user = allUsers.find(u => u.userId === tempSelectedUserId);
    if (user) {
      // 添加到已选择列表（新人员显示在最上方）
      setSelectedUsers(prev => [user, ...prev]);
      
      // 初始化编辑数据
      setEditedData(prev => ({
        ...prev,
        [user.userId]: {
          baseSalary: user.baseSalary,
          socialSecurity: user.socialSecurity,
          hourlyRate: user.hourlyRate,
          commissionRate: user.commissionRate
        }
      }));
      
      setModalVisible(false);
      setTempSelectedUserId(null);
    }
  };

  // 打开删除确认模态框
  const handleRemoveUser = (userId) => {
    const user = selectedUsers.find(u => u.userId === userId);
    if (user) {
      setUserToDelete(user);
      setDeleteModalVisible(true);
    }
  };

  // 确认删除用户工资设置
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    setLoading(true);
    try {
      const response = await deleteSalarySetting(userToDelete.userId, organizationId);
      if (response && response.success) {
        message.success('删除成功');
        
        // 从selectedUsers中移除该用户
        setSelectedUsers(prev => prev.filter(u => u.userId !== userToDelete.userId));
        
        // 清除该用户的编辑数据
        setEditedData(prev => {
          const newData = { ...prev };
          delete newData[userToDelete.userId];
          return newData;
        });
        
        // 关闭模态框
        setDeleteModalVisible(false);
        setUserToDelete(null);
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除工资设置失败:', error);
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消删除
  const handleCancelDelete = () => {
    setDeleteModalVisible(false);
    setUserToDelete(null);
  };

  const handleValueChange = (userId, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value
      }
    }));
  };

  // 检查用户是否有实际的修改或是新用户
  const hasActualChanges = (userId) => {
    const user = selectedUsers.find(u => u.userId === userId);
    const changes = editedData[userId];
    
    if (!user) {
      return false;
    }

    // 对于新用户（没有id或所有工资字段都是0，表示数据库中还没有记录），始终允许保存
    const isNewUser = !user.id || (
      user.baseSalary === 0 && 
      user.socialSecurity === 0 && 
      user.hourlyRate === 0 && 
      user.commissionRate === 0
    );
    
    if (isNewUser) {
      return true;
    }

    // 对于没有编辑数据的情况
    if (!changes) {
      return false;
    }

    // 比较每个字段是否有实际变化
    const hasChanges = (
      (changes.baseSalary !== undefined && changes.baseSalary !== user.baseSalary) ||
      (changes.socialSecurity !== undefined && changes.socialSecurity !== user.socialSecurity) ||
      (changes.hourlyRate !== undefined && changes.hourlyRate !== user.hourlyRate) ||
      (changes.commissionRate !== undefined && changes.commissionRate !== user.commissionRate)
    );

    return hasChanges;
  };

  const handleSave = async (userId) => {
    if (!hasActualChanges(userId)) {
      message.info('没有修改');
      return;
    }

    const user = selectedUsers.find(u => u.userId === userId);
    const changes = editedData[userId] || {};

    setSavingUserId(userId);
    try {
      const data = {
        userId: userId,
        baseSalary: changes.baseSalary !== undefined ? changes.baseSalary : (user.baseSalary || 0),
        socialSecurity: changes.socialSecurity !== undefined ? changes.socialSecurity : (user.socialSecurity || 0),
        hourlyRate: changes.hourlyRate !== undefined ? changes.hourlyRate : (user.hourlyRate || 0),
        commissionRate: changes.commissionRate !== undefined ? changes.commissionRate : (user.commissionRate || 0)
      };

      const response = await saveOrUpdateSalarySetting(data, organizationId);
      if (response && response.success) {
        message.success('保存成功');
        
        // 更新selectedUsers中对应用户的数据
        setSelectedUsers(prevUsers => 
          prevUsers.map(u => 
            u.userId === userId 
              ? { 
                  ...u, 
                  baseSalary: changes.baseSalary || u.baseSalary,
                  socialSecurity: changes.socialSecurity || u.socialSecurity,
                  hourlyRate: changes.hourlyRate || u.hourlyRate,
                  commissionRate: changes.commissionRate || u.commissionRate
                }
              : u
          )
        );
        
        // 清除该用户的编辑数据，使按钮重新置灰
        setEditedData(prevData => {
          const newData = { ...prevData };
          delete newData[userId];
          return newData;
        });
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSavingUserId(null);
    }
  };

  // 获取可选的用户（只显示普通用户USER，排除管理员ADMIN和已添加的用户）
  const availableUsers = allUsers.filter(
    user => user.role === 'USER' && !selectedUsers.find(u => u.userId === user.userId)
  );

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large">
          <div style={{ height: 24, lineHeight: '24px', color: '#999' }}>加载中...</div>
        </Spin>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 24px 0' }}>
      <div style={{ marginBottom: 16, fontSize: '16px', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>人员工资设定</span>
        {/* 添加人员按钮 */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenModal}
          style={{
            borderRadius: '6px'
          }}
        >
          添加人员
        </Button>
      </div>

      {/* 已选择的人员卡片列表 */}
      {selectedUsers.length === 0 ? (
        <Empty 
          description="暂无人员，请点击上方按钮添加人员" 
          style={{ marginTop: 60 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedUsers.map(user => {
            const userEditData = editedData[user.userId] || {};
            return (
              <Card
                key={user.userId}
                style={{
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  border: '1px solid #e8e8e8'
                }}
              >
                {/* 用户信息头部 */}
                <div style={{ 
                  marginBottom: 16, 
                  paddingBottom: 12, 
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                    <span style={{ fontSize: '16px', fontWeight: 500 }}>
                      {user.nickname || user.username || '-'}
                    </span>
                  </div>
                  <Button
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => handleRemoveUser(user.userId)}
                    size="small"
                  >
                    移除
                  </Button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* 底薪 */}
                  <div>
                    <div style={{ marginBottom: 6, color: '#666', fontSize: '14px', fontWeight: 500 }}>
                      底薪（元）
                    </div>
                    <InputNumber
                      min={0}
                      precision={2}
                      value={userEditData.baseSalary}
                      onChange={(val) => handleValueChange(user.userId, 'baseSalary', val)}
                      style={{ width: '100%' }}
                      placeholder="请输入底薪"
                      size="middle"
                    />
                  </div>

                  {/* 社保 */}
                  <div>
                    <div style={{ marginBottom: 6, color: '#666', fontSize: '14px', fontWeight: 500 }}>
                      社保（元）
                    </div>
                    <InputNumber
                      min={0}
                      precision={2}
                      value={userEditData.socialSecurity}
                      onChange={(val) => handleValueChange(user.userId, 'socialSecurity', val)}
                      style={{ width: '100%' }}
                      placeholder="请输入社保"
                      size="middle"
                    />
                  </div>

                  {/* 课时费 */}
                  <div>
                    <div style={{ marginBottom: 6, color: '#666', fontSize: '14px', fontWeight: 500 }}>
                      课时费（元/课时）
                    </div>
                    <InputNumber
                      min={0}
                      precision={2}
                      value={userEditData.hourlyRate}
                      onChange={(val) => handleValueChange(user.userId, 'hourlyRate', val)}
                      style={{ width: '100%' }}
                      placeholder="请输入课时费"
                      size="middle"
                    />
                  </div>

                  {/* 提成比例 */}
                  <div>
                    <div style={{ marginBottom: 6, color: '#666', fontSize: '14px', fontWeight: 500 }}>
                      提成比例（%）
                    </div>
                    <InputNumber
                      min={0}
                      max={100}
                      precision={2}
                      value={userEditData.commissionRate}
                      onChange={(val) => handleValueChange(user.userId, 'commissionRate', val)}
                      style={{ width: '100%' }}
                      placeholder="请输入提成比例"
                      size="middle"
                    />
                  </div>
                </div>

                {/* 保存按钮 */}
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => handleSave(user.userId)}
                  loading={savingUserId === user.userId}
                  disabled={!hasActualChanges(user.userId)}
                  block
                  size="middle"
                  style={{ marginTop: 16, height: '40px', fontSize: '14px' }}
                >
                  {savingUserId === user.userId ? '保存中...' : '保存设置'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* 选择人员模态框 */}
      <Modal
        title="选择人员"
        open={modalVisible}
        onOk={handleConfirmSelect}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: 12, fontSize: '14px', color: '#666' }}>
            请选择要设置工资的人员
          </div>
          <Select
            showSearch
            placeholder="请选择人员"
            style={{ width: '100%' }}
            value={tempSelectedUserId}
            onChange={setTempSelectedUserId}
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={availableUsers.map(user => ({
              value: user.userId,
              label: user.nickname || user.username || `用户${user.userId}`
            }))}
            size="large"
          />
        </div>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleConfirmDelete}
        onCancel={handleCancelDelete}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: loading }}
        cancelButtonProps={{ disabled: loading }}
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ fontSize: '16px', marginBottom: '12px' }}>
            您确定要删除 <strong>{userToDelete?.nickname || userToDelete?.username}</strong> 的工资设置吗？
          </p>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: 0 }}>
            删除后将无法恢复，请谨慎操作。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default SalarySettings;
