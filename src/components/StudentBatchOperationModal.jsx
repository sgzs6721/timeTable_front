import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Tag, Space, Divider, Typography, Card, List } from 'antd';
import { renameStudent, hideStudent, assignStudentAlias, updateStudentOperationRecord, deleteStudentOperationRecord } from '../services/studentOperationRecords';
import { mergeStudents } from '../services/studentMerge';
import { getStudentOperationRecords } from '../services/studentOperationRecords';

const StudentBatchOperationModal = ({
  visible,
  onClose,
  selectedStudents = [],
  onOperationComplete
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [existingRules, setExistingRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [showExistingRules, setShowExistingRules] = useState(false);

  // 获取不同颜色的标签颜色
  const getTagColor = (index) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'lime', 'pink'];
    return colors[index % colors.length];
  };

  // 获取现有操作记录
  useEffect(() => {
    if (visible) {
      fetchExistingRules();
      // 重置状态
      setEditingRule(null);
      setOperationType(null);
      form.resetFields();
    }
  }, [visible]);

  // 当选中学员变化时，检查是否有现有规则并自动展开
  useEffect(() => {
    if (visible && selectedStudents.length > 0) {
      const hasRules = getSelectedStudentsRules().length > 0;
      setShowExistingRules(hasRules);
    }
  }, [selectedStudents, visible, existingRules]);

  const fetchExistingRules = async () => {
    try {
      const response = await getStudentOperationRecords();
      if (response && response.success) {
        setExistingRules(response.data || []);
      }
    } catch (error) {
      console.error('获取操作记录失败:', error);
    }
  };

  // 检查是否已存在规则
  const hasExistingRule = (studentName, operationType) => {
    return existingRules.some(rule =>
      rule.oldName === studentName && rule.operationType === operationType
    );
  };

  // 获取现有规则信息
  const getExistingRule = (studentName, operationType) => {
    return existingRules.find(rule =>
      rule.oldName === studentName && rule.operationType === operationType
    );
  };

  // 获取选中学员的所有现有规则
  const getSelectedStudentsRules = () => {
    return existingRules.filter(rule => selectedStudents.includes(rule.oldName));
  };

  // 处理编辑规则
  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setOperationType(rule.operationType);
    
    // 根据操作类型设置表单初始值
    if (rule.operationType === 'RENAME') {
      form.setFieldsValue({
        newName: rule.newName
      });
    } else if (rule.operationType === 'ASSIGN_ALIAS') {
      form.setFieldsValue({
        aliasName: rule.newName
      });
    } else if (rule.operationType === 'MERGE') {
      form.setFieldsValue({
        displayName: rule.newName
      });
    }
  };

  // 处理删除规则
  const handleDeleteRule = async (ruleId) => {
    try {
      await deleteStudentOperationRecord(ruleId);
      message.success('规则已删除');
      fetchExistingRules(); // 刷新规则列表
      onOperationComplete && onOperationComplete(); // 刷新页面数据
    } catch (error) {
      message.error('删除规则失败');
    }
  };

  // 处理更新规则
  const handleUpdateRule = async (values) => {
    if (!editingRule) return;
    
    setLoading(true);
    try {
      let updateData = {};
      
      if (editingRule.operationType === 'RENAME') {
        updateData = { newName: values.newName };
      } else if (editingRule.operationType === 'ASSIGN_ALIAS') {
        updateData = { newName: values.aliasName };
      } else if (editingRule.operationType === 'MERGE') {
        updateData = { newName: values.displayName };
      }
      
      await updateStudentOperationRecord(editingRule.id, updateData);
      message.success('规则已更新');
      
      // 重置状态
      setEditingRule(null);
      setOperationType(null);
      form.resetFields();
      
      // 刷新数据
      fetchExistingRules();
      onOperationComplete && onOperationComplete();
    } catch (error) {
      message.error('更新规则失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = () => {
    if (selectedStudents.length !== 1) {
      message.warning('请选择一个学员进行重命名');
      return;
    }
    setOperationType('rename');
    form.setFieldsValue({
      newName: selectedStudents[0]
    });
  };

  const handleDelete = () => {
    if (selectedStudents.length < 1) {
      message.warning('请至少选择一个学员进行删除');
      return;
    }
    setOperationType('delete');
  };

  const handleAssign = () => {
    if (selectedStudents.length !== 1) {
      message.warning('请选择一个学员进行分配');
      return;
    }
    setOperationType('assign');
  };

  const handleMerge = () => {
    if (selectedStudents.length < 2) {
      message.warning('请选择至少两个学员进行合并');
      return;
    }
    setOperationType('merge');
  };

  const handleOperationSubmit = async (values) => {
    setLoading(true);
    try {
      switch (operationType) {
        case 'rename':
          const existingRenameRule = getExistingRule(selectedStudents[0], 'RENAME');
          await renameStudent({
            oldName: selectedStudents[0],
            newName: values.newName
          });
          if (existingRenameRule) {
            message.success(`已更新重命名规则：将 "${selectedStudents[0]}" 显示为 "${values.newName}"（原规则：${existingRenameRule.newName}）`);
          } else {
            message.success(`已创建重命名规则：将 "${selectedStudents[0]}" 显示为 "${values.newName}"`);
          }
          break;
          
        case 'delete':
          // 批量删除学员（创建或更新隐藏规则）
          let updatedCount = 0;
          let createdCount = 0;
          for (const studentName of selectedStudents) {
            const existingDeleteRule = getExistingRule(studentName, 'DELETE');
            await deleteStudent(studentName);
            if (existingDeleteRule) {
              updatedCount++;
            } else {
              createdCount++;
            }
          }
          if (updatedCount > 0 && createdCount > 0) {
            message.success(`已更新 ${updatedCount} 个隐藏规则，创建 ${createdCount} 个新隐藏规则`);
          } else if (updatedCount > 0) {
            message.success(`已更新 ${updatedCount} 个隐藏规则`);
          } else {
            message.success(`已创建 ${createdCount} 个隐藏规则`);
          }
          break;
          
        case 'assign':
          const existingAliasRule = getExistingRule(selectedStudents[0], 'ASSIGN_ALIAS');
          await assignStudentAlias({
            oldName: selectedStudents[0],
            aliasName: values.aliasName
          });
          if (existingAliasRule) {
            message.success(`已更新别名规则：将 "${selectedStudents[0]}" 显示为 "${values.aliasName}"（原规则：${existingAliasRule.newName}）`);
          } else {
            message.success(`已创建别名规则：将 "${selectedStudents[0]}" 显示为 "${values.aliasName}"`);
          }
          break;
          
        case 'merge':
          await mergeStudents({
            displayName: values.displayName,
            studentNames: selectedStudents
          });
          message.success(`已创建合并规则：将多个学员显示为 "${values.displayName}"`);
          break;
          
        default:
          return;
      }
      
      // 先调用操作完成回调，刷新数据
      onOperationComplete && onOperationComplete();
      
      // 延迟关闭模态框，让用户看到成功消息
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (error) {
      message.error(`${operationType}操作失败`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOperationType(null);
    setEditingRule(null);
    setShowExistingRules(false);
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="学员批量操作"
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
    >
      <div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <strong>已选择的学员：</strong>
            <div style={{ marginTop: 8 }}>
              {selectedStudents.map((name, index) => (
                <Tag key={name} color={getTagColor(index)}>{name}</Tag>
              ))}
            </div>
          </div>
          <Divider />
          <div>
            <strong>请选择要执行的操作：</strong>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedStudents.length === 1 && (
                <>
                  <Button onClick={handleRename}>
                    重命名规则
                  </Button>
                  <Button onClick={handleDelete} danger>
                    隐藏规则
                  </Button>
                  <Button onClick={handleAssign}>
                    别名规则
                  </Button>
                </>
              )}
              {selectedStudents.length >= 2 && (
                <>
                  <Button onClick={handleDelete} danger>
                    隐藏规则
                  </Button>
                  <Button type="primary" onClick={handleMerge}>
                    合并规则
                  </Button>
                </>
              )}
            </div>
          </div>
        </Space>
        
        {/* 显示现有规则 */}
        {(getSelectedStudentsRules().length > 0) && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>现有规则 ({getSelectedStudentsRules().length})</strong>
              <Button
                type="link"
                size="small"
                onClick={() => setShowExistingRules(!showExistingRules)}
              >
                {showExistingRules ? '收起' : '展开'}
              </Button>
            </div>
            
            {showExistingRules && (
              <div>
                {getSelectedStudentsRules().map(rule => (
                  <div key={rule.id} style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color="blue">{rule.oldName}</Tag>
                        <span> → </span>
                        <Tag color="green">{rule.newName}</Tag>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {rule.operationType === 'RENAME' && '重命名规则'}
                        {rule.operationType === 'DELETE' && '隐藏规则'}
                        {rule.operationType === 'ASSIGN_ALIAS' && '别名规则'}
                        {rule.operationType === 'MERGE' && '合并规则'}
                        <span style={{ marginLeft: 8 }}>
                          创建时间: {new Date(rule.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16 }}>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleEditRule(rule)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {operationType === 'rename' && (
          <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
              {editingRule ? '编辑重命名规则' : (hasExistingRule(selectedStudents[0], 'RENAME') ? '更新重命名规则' : '创建重命名规则')}
            </div>
            {hasExistingRule(selectedStudents[0], 'RENAME') && !editingRule && (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="warning" style={{ fontSize: '12px' }}>
                  ⚠️ 该学员已存在重命名规则，将更新现有规则
                </Typography.Text>
              </div>
            )}
            <Form form={form} onFinish={editingRule ? handleUpdateRule : handleOperationSubmit} layout="inline">
              <Form.Item
                name="newName"
                rules={[{ required: true, message: '请输入新名称' }]}
                style={{ flex: 1, marginRight: 8 }}
              >
                <Input placeholder="输入显示名称" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingRule ? '更新规则' : (hasExistingRule(selectedStudents[0], 'RENAME') ? '更新规则' : '创建规则')}
                </Button>
              </Form.Item>
              <Form.Item>
                <Button onClick={() => {
                  setOperationType(null);
                  setEditingRule(null);
                  form.resetFields();
                }}>
                  取消
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
        
        {operationType === 'delete' && (
          <div style={{ marginTop: 16, padding: 16, backgroundColor: '#fff2f0', borderRadius: 8, border: '1px solid #ffccc7' }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#cf1322' }}>隐藏学员</div>
            <p>确定要隐藏以下学员吗？</p>
            <div style={{ marginBottom: 16 }}>
              {selectedStudents.map((name, index) => (
                <Tag key={name} color={getTagColor(index)}>{name}</Tag>
              ))}
            </div>
            {(() => {
              const deleteRulesCount = selectedStudents.filter(student =>
                hasExistingRule(student, 'DELETE')
              ).length;
              return deleteRulesCount > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="warning" style={{ fontSize: '12px' }}>
                    ⚠️ 其中有 {deleteRulesCount} 个学员已存在隐藏规则，将更新现有规则
                  </Typography.Text>
                </div>
              ) : null;
            })()}
            <p style={{ color: '#666', fontSize: '12px', marginBottom: 16 }}>
              注意：隐藏操作不会影响课表记录，只是创建隐藏规则使学员在列表中不显示
            </p>
            <Button
              type="primary"
              danger
              onClick={() => handleOperationSubmit({})}
              loading={loading}
            >
              {(() => {
                const deleteRulesCount = selectedStudents.filter(student =>
                  hasExistingRule(student, 'DELETE')
                ).length;
                return deleteRulesCount > 0 ?
                  `更新 ${deleteRulesCount} 个规则，创建 ${selectedStudents.length - deleteRulesCount} 个新规则` :
                  `创建 ${selectedStudents.length} 个隐藏规则`;
              })()}
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setOperationType(null)}>
              取消
            </Button>
          </div>
        )}
        
        {operationType === 'assign' && (
          <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
              {editingRule ? '编辑别名规则' : (hasExistingRule(selectedStudents[0], 'ASSIGN_ALIAS') ? '更新别名规则' : '创建别名规则')}
            </div>
            {hasExistingRule(selectedStudents[0], 'ASSIGN_ALIAS') && !editingRule && (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="warning" style={{ fontSize: '12px' }}>
                  ⚠️ 该学员已存在别名规则，将更新现有规则
                </Typography.Text>
              </div>
            )}
            <Form form={form} onFinish={editingRule ? handleUpdateRule : handleOperationSubmit} layout="inline">
              <Form.Item
                name="aliasName"
                rules={[{ required: true, message: '请输入别名' }]}
                style={{ flex: 1, marginRight: 8 }}
              >
                <Input placeholder="输入别名" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingRule ? '更新规则' : (hasExistingRule(selectedStudents[0], 'ASSIGN_ALIAS') ? '更新规则' : '创建规则')}
                </Button>
              </Form.Item>
              <Form.Item>
                <Button onClick={() => {
                  setOperationType(null);
                  setEditingRule(null);
                  form.resetFields();
                }}>
                  取消
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
        
        {operationType === 'merge' && (
          <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
            <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
              {editingRule ? '编辑合并规则' : '创建合并规则'}
            </div>
            <Form form={form} onFinish={editingRule ? handleUpdateRule : handleOperationSubmit}>
              <Form.Item
                name="displayName"
                label="合并后名称"
                rules={[{ required: true, message: '请输入合并后的名称' }]}
              >
                <Input placeholder="输入合并后的显示名称" />
              </Form.Item>
              <div style={{ marginBottom: 16 }}>
                <div>将合并显示的学员：</div>
                {selectedStudents.map((name, index) => (
                  <Tag key={name} color={getTagColor(index)}>{name}</Tag>
                ))}
              </div>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingRule ? '更新规则' : '创建规则'}
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setOperationType(null);
                    setEditingRule(null);
                    form.resetFields();
                  }}
                >
                  取消
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StudentBatchOperationModal;