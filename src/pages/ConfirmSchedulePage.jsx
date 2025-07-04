import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createSchedulesBatch, createSchedulesBatchForce, checkScheduleConflicts } from '../services/timetable';
import { Button, message, Modal, List, Typography, Alert, Space, Tag, Checkbox } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import './ConfirmSchedulePage.css';

const { Text, Title } = Typography;

const dayOfWeekMap = {
  MONDAY: '一', TUESDAY: '二', WEDNESDAY: '三',
  THURSDAY: '四', FRIDAY: '五', SATURDAY: '六', SUNDAY: '日',
};

const dayOfWeekInputMap = {
  '1': 'MONDAY', '一': 'MONDAY', '周一': 'MONDAY', '星期一': 'MONDAY',
  '2': 'TUESDAY', '二': 'TUESDAY', '周二': 'TUESDAY', '星期二': 'TUESDAY',
  '3': 'WEDNESDAY', '三': 'WEDNESDAY', '周三': 'WEDNESDAY', '星期三': 'WEDNESDAY',
  '4': 'THURSDAY', '四': 'THURSDAY', '周四': 'THURSDAY', '星期四': 'THURSDAY',
  '5': 'FRIDAY', '五': 'FRIDAY', '周五': 'FRIDAY', '星期五': 'FRIDAY',
  '6': 'SATURDAY', '六': 'SATURDAY', '周六': 'SATURDAY', '星期六': 'SATURDAY',
  '7': 'SUNDAY', '日': 'SUNDAY', '天': 'SUNDAY', '周日': 'SUNDAY', '星期日': 'SUNDAY', '周天': 'SUNDAY',
};

const formatDayOfWeekForDisplay = (dayOfWeek) => {
  return dayOfWeekMap[dayOfWeek?.toUpperCase()] || dayOfWeek;
};

const parseDayOfWeekFromInput = (input) => {
  if (!input) return null;
  const trimmedInput = input.trim();
  const mappedValue = dayOfWeekInputMap[trimmedInput] || dayOfWeekInputMap[trimmedInput.toUpperCase()];
  if (mappedValue) {
    return mappedValue;
  }
  const upperInput = trimmedInput.toUpperCase();
  if (dayOfWeekMap[upperInput]) {
    return upperInput;
  }
  return upperInput;
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  const dateParts = dateStr.split('-');
  if (dateParts.length === 3) {
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);
    return `${month}.${day}`;
  }
  return dateStr;
};

const parseDateFromInput = (input) => {
  if (!input) return null;
  const cleanedInput = input.trim().replace(/[.\/]/g, '-');
  const parts = cleanedInput.split('-');

  let year, month, day;
  const currentYear = new Date().getFullYear();

  if (parts.length === 3) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    year = currentYear;
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
  } else {
    return null; // Invalid format
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null; // Invalid numbers
  }

  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
};

// 将英文星期转换为中文
const convertDayOfWeekToChinese = (dayOfWeek) => {
  if (!dayOfWeek) return '';

  const dayMap = {
    'MONDAY': '周一',
    'TUESDAY': '周二',
    'WEDNESDAY': '周三',
    'THURSDAY': '周四',
    'FRIDAY': '周五',
    'SATURDAY': '周六',
    'SUNDAY': '周日'
  };

  return dayMap[dayOfWeek.toUpperCase()] || dayOfWeek;
};

const ConfirmSchedulePage = ({ setTextInputValue }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [selectedConflicts, setSelectedConflicts] = useState(new Set()); // 选中要覆盖的冲突
  const location = useLocation();
  const navigate = useNavigate();
  const { timetableId } = useParams();
  const timetableType = location.state?.timetableType;

  useEffect(() => {
    if (location.state && location.state.data) {
      const formattedSchedules = location.state.data.map(schedule => ({
        ...schedule,
        dayOfWeek: formatDayOfWeekForDisplay(schedule.dayOfWeek),
        date: formatDateForDisplay(schedule.date),
      }));
      setSchedules(formattedSchedules);
    } else {
      navigate(`/input-timetable/${timetableId}`);
    }
  }, [location.state, navigate, timetableId]);

  const handleInputChange = (index, field, value) => {
    const newSchedules = [...schedules];
    newSchedules[index][field] = value;
    setSchedules(newSchedules);
  };

  const handleDelete = (index) => {
    const newSchedules = schedules.filter((_, i) => i !== index);
    setSchedules(newSchedules);
  };

  const handleConfirm = async () => {
    if (schedules.length === 0) {
      message.warn('没有可添加的排课信息。');
      return;
    }

    const schedulesToCreate = schedules.map(schedule => {
      const [startTime, endTime] = schedule.time ? schedule.time.split('-') : [null, null];
      return {
        studentName: schedule.studentName,
        dayOfWeek: parseDayOfWeekFromInput(schedule.dayOfWeek),
        scheduleDate: parseDateFromInput(schedule.date),
        startTime: startTime ? `${startTime}:00` : null,
        endTime: endTime ? `${endTime}:00` : null,
        note: '通过文本识别创建',
      };
    });

    // 先检查冲突
    setCheckingConflicts(true);
    try {
      const conflictResponse = await checkScheduleConflicts(timetableId, schedulesToCreate);

      if (conflictResponse && conflictResponse.success) {
        const conflictResult = conflictResponse.data;

        if (conflictResult.hasConflicts) {
          // 过滤掉"学生冲突"
          const filteredConflicts = conflictResult.conflicts.filter(
            c => c.conflictType !== 'STUDENT_TIME_CONFLICT'
          );

          // 如果过滤后没有其他冲突了，则认为操作成功
          if (filteredConflicts.length === 0) {
            const createdCount = conflictResult.createdSchedules ? conflictResult.createdSchedules.length : 0;
            if (createdCount > 0) {
              message.success(`已成功创建 ${createdCount} 个无冲突排课，学生冲突项已被忽略。`);
            } else {
              message.info('所有新排课均因学生冲突而被忽略。');
            }
            if (setTextInputValue) setTextInputValue('');
            navigate(`/view-timetable/${timetableId}`);
            return;
          }

          const updatedConflictResult = {
            ...conflictResult,
            conflicts: filteredConflicts,
          };

          // 有冲突，显示冲突信息
          setConflicts(updatedConflictResult);
          setShowConflictModal(true);

          // 如果有部分成功创建的排课，显示提示
          if (updatedConflictResult.createdSchedules && updatedConflictResult.createdSchedules.length > 0) {
            message.info(`已成功创建 ${updatedConflictResult.createdSchedules.length} 个排课，${updatedConflictResult.conflicts.length} 个排课存在冲突`);
          }

          // 初始化选中状态：默认全选
          setSelectedConflicts(new Set(updatedConflictResult.conflicts.map((_, index) => index)));
          return;
        } else {
          // 没有冲突，全部创建成功
          const createdCount = conflictResult.createdSchedules ? conflictResult.createdSchedules.length : schedulesToCreate.length;
          message.success(`排课创建成功！共创建 ${createdCount} 个排课`);
          if (setTextInputValue) setTextInputValue('');
          navigate(`/view-timetable/${timetableId}`);
          return;
        }
      }
    } catch (error) {
      console.error('检查冲突失败:', error);
      message.warning('无法检查冲突，将直接创建排课');
    } finally {
      setCheckingConflicts(false);
    }

    // 没有冲突，直接创建
    await createSchedulesDirectly(schedulesToCreate);
  };

  const createSchedulesDirectly = async (schedulesToCreate) => {
    setLoading(true);
    try {
      const response = await createSchedulesBatch(timetableId, schedulesToCreate);

      if (response && response.success) {
        message.success('排课已成功添加！');
        if (setTextInputValue) setTextInputValue('');
        navigate(`/view-timetable/${timetableId}`);
      } else {
        message.error(response.message || '创建排课失败，请检查后端返回。');
      }
    } catch (error) {
      console.error('创建排课失败:', error);
      message.error('创建排课时发生未知错误。');
    } finally {
      setLoading(false);
    }
  };

  const handleForceCreate = async () => {
    if (!conflicts || !conflicts.conflicts || selectedConflicts.size === 0) {
      message.warning('请至少选择一个冲突进行覆盖');
      return;
    }

    // 只对选中的冲突进行强制创建
    const selectedConflictRequests = conflicts.conflicts
      .filter((_, index) => selectedConflicts.has(index))
      .map(conflict => {
        const request = conflict.newSchedule;
        return {
          studentName: request.studentName,
          dayOfWeek: request.dayOfWeek,
          scheduleDate: request.scheduleDate,
          startTime: request.startTime,
          endTime: request.endTime,
          note: '通过文本识别创建（智能覆盖）',
        };
      });

    setLoading(true);
    try {
      const response = await createSchedulesBatchForce(timetableId, selectedConflictRequests);

      if (response && response.success) {
        const totalCreated = (conflicts.createdSchedules ? conflicts.createdSchedules.length : 0) + selectedConflictRequests.length;
        const skippedCount = conflicts.conflicts.length - selectedConflicts.size;

        let successMessage = `排课已强制创建成功！共创建 ${totalCreated} 个排课`;
        if (skippedCount > 0) {
          successMessage += `，跳过 ${skippedCount} 个未选中的冲突`;
        }

        message.success(successMessage);
        if (setTextInputValue) setTextInputValue('');
        setShowConflictModal(false);
        navigate(`/view-timetable/${timetableId}`);
      } else {
        message.error(response.message || '强制创建排课失败。');
      }
    } catch (error) {
      console.error('强制创建排课失败:', error);
      message.error('强制创建排课时发生未知错误。');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  // 处理冲突选择
  const handleConflictSelection = (conflictIndex, checked) => {
    const newSelected = new Set(selectedConflicts);
    if (checked) {
      newSelected.add(conflictIndex);
    } else {
      newSelected.delete(conflictIndex);
    }
    setSelectedConflicts(newSelected);
  };

  // 全选/取消全选
  const handleSelectAllConflicts = (checked) => {
    if (checked) {
      setSelectedConflicts(new Set(conflicts.conflicts.map((_, index) => index)));
    } else {
      setSelectedConflicts(new Set());
    }
  };

  return (
    <div className="page-container">
      <h2>确认排课信息</h2>
      <p>请检查以排课信息，您可以直接在表格中进行修改。</p>
      <div className="schedule-table-container">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>姓名</th>
              {timetableType === 'WEEKLY' && <th>星期</th>}
              {timetableType === 'DATE_RANGE' && <th>日期</th>}
              <th>时间</th>
              <th className="action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={schedule.studentName || ''}
                    onChange={(e) => handleInputChange(index, 'studentName', e.target.value)}
                  />
                </td>
                {timetableType === 'WEEKLY' && (
                  <td>
                    <input
                      type="text"
                      value={schedule.dayOfWeek || ''}
                      onChange={(e) => handleInputChange(index, 'dayOfWeek', e.target.value)}
                    />
                  </td>
                )}
                {timetableType === 'DATE_RANGE' && (
                  <td>
                    <input
                      type="text"
                      placeholder="M.D"
                      value={schedule.date || ''}
                      onChange={(e) => handleInputChange(index, 'date', e.target.value)}
                    />
                  </td>
                )}
                <td>
                  <input
                    type="text"
                    value={schedule.time || ''}
                    onChange={(e) => handleInputChange(index, 'time', e.target.value)}
                  />
                </td>
                <td className="action-cell">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(index)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="primary" danger onClick={handleCancel} style={{ marginRight: 8 }}>
          取消
        </Button>
        <Button
          type="primary"
          onClick={handleConfirm}
          loading={loading || checkingConflicts}
        >
          {checkingConflicts ? '检查冲突中...' : '确认'}
        </Button>
      </div>

      {/* 冲突确认模态框 */}
      <Modal
        title={
          <div style={{ textAlign: 'center' }}>
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <Text strong style={{ fontSize: '18px' }}>发现排课冲突</Text>
            </Space>
          </div>
        }
        open={showConflictModal}
        onCancel={() => setShowConflictModal(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setShowConflictModal(false)}>
            取消
          </Button>,
          <Button
            key="force"
            type="primary"
            danger
            onClick={handleForceCreate}
            loading={loading}
            disabled={selectedConflicts.size === 0}
          >
            覆盖 ({selectedConflicts.size})
          </Button>,
        ]}
      >
        {conflicts && (
          <div>
            {conflicts.createdSchedules && conflicts.createdSchedules.length > 0 && (
              <Alert
                message={`已成功创建 ${conflicts.createdSchedules.length} 个排课`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <div style={{ marginBottom: 16 }}>
              <Space>
                <Text strong>冲突详情：</Text>
                <Checkbox
                  checked={selectedConflicts.size === conflicts.conflicts.length}
                  indeterminate={selectedConflicts.size > 0 && selectedConflicts.size < conflicts.conflicts.length}
                  onChange={(e) => handleSelectAllConflicts(e.target.checked)}
                >
                  全选
                </Checkbox>
              </Space>
            </div>

            <div style={{ marginBottom: '4px' }}>
              <List
                size="small"
                dataSource={conflicts.conflicts}
                renderItem={(conflict, index) => (
                  <List.Item>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space align="start">
                        <Checkbox
                          checked={selectedConflicts.has(index)}
                          onChange={(e) => handleConflictSelection(index, e.target.checked)}
                        />
                        <div>
                          <div>
                            <Tag color={'red'}>
                              时间冲突
                            </Tag>
                          </div>
                          {conflict.existingSchedule && (
                            <div style={{ marginTop: '8px' }}>
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                现有课程：
                                <span style={{ color: '#faad14', fontWeight: 'bold' }}>{conflict.existingSchedule.studentName}</span>
                                {` - ${conflict.existingSchedule.startTime}-${conflict.existingSchedule.endTime}`}
                                {conflict.existingSchedule.scheduleDate && ` (${conflict.existingSchedule.scheduleDate})`}
                                {conflict.existingSchedule.dayOfWeek && ` (${convertDayOfWeekToChinese(conflict.existingSchedule.dayOfWeek)})`}
                              </Text>
                            </div>
                          )}
                          {conflict.newSchedule && (
                            <div style={{ marginTop: '4px' }}>
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                新建课程：
                                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{conflict.newSchedule.studentName}</span>
                                ，是否覆盖
                              </Text>
                            </div>
                          )}
                        </div>
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            </div>

            <Alert
              message={<Text strong>选择操作</Text>}
              description={`请勾选需要覆盖的冲突项，然后点击"覆盖"。${conflicts.createdSchedules && conflicts.createdSchedules.length > 0 ? '无冲突的排课已成功创建，' : ''}覆盖规则：如果是不同学员的时间冲突，将删除原有课程并添加新课程。`}
              type="info"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ConfirmSchedulePage;