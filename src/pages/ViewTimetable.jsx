import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Table, message, Space, Tag, Popover, Spin, Input, Modal, Checkbox, Collapse, Dropdown, Switch, AutoComplete } from 'antd';
import { LeftOutlined, CalendarOutlined, RightOutlined, CopyOutlined, CloseOutlined, CheckOutlined, DownOutlined, UpOutlined, DeleteOutlined, UndoOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getTimetable, getTimetableSchedules, getTimetableSchedulesByStudent, deleteSchedule, updateSchedule, createSchedule, createSchedulesBatch, getActiveSchedulesByDate, deleteSchedulesBatch, getTodaySchedulesOnce, getTomorrowSchedulesOnce, invalidateTimetableCache, getActiveSchedulesByDateMerged, getTemplateSchedules, getThisWeekSchedules, swapSchedules, clearActiveSchedulesCache } from '../services/timetable';
import { swapInstanceSchedules } from '../services/weeklyInstance';
import { invalidateWeeklyTemplatesCache, getInstanceSchedulesByDate, clearByDateCache } from '../services/admin';
import { getThisWeekSchedulesSessionOnce } from '../services/timetable';
import {
  getCurrentWeekInstance,
  getCurrentWeekInstanceIncludingLeaves,
  generateCurrentWeekInstance,
  checkCurrentWeekInstance,
  clearCurrentWeekInstanceSchedules,
  syncTemplateToInstances,
  restoreCurrentWeekInstanceToTemplate,
  createInstanceSchedule,
  createInstanceSchedulesBatch,
  updateInstanceSchedule,
  deleteInstanceSchedule,
  deleteInstanceSchedulesBatch,
  generateNextWeekInstance,
  switchToWeekInstance,
  getInstanceSchedules,
  getWeeklyInstances,
  requestLeave,
  cancelLeave
} from '../services/weeklyInstance';
import { deleteNextWeekInstance, getAllStudents, deleteWeeklyInstance } from '../services/weeklyInstance';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import html2canvas from 'html2canvas';
import EditScheduleModal from '../components/EditScheduleModal';
import LeaveRequestModal from '../components/LeaveRequestModal';
import Footer from '../components/Footer';
import { isWeChatBrowser } from '../utils/browserDetect';
import './ViewTimetable.css';

dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekOfYear);
dayjs.locale({ ...dayjs.Ls.en, weekStart: 1 });

// 移除了全局的 useRef，将在组件内部定义

const dayMap = {
  MONDAY: '一',
  TUESDAY: '二',
  WEDNESDAY: '三',
  THURSDAY: '四',
  FRIDAY: '五',
  SATURDAY: '六',
  SUNDAY: '日',
};

// 仅展示信息的弹层：显示原学员与"取消/请假"状态
const CancelledOrLeavePopoverContent = ({ info, onClose, onRestore, restoreLoading }) => {
  if (!info) return null;
  return (
    <div style={{ width: 'min(280px, 92vw)', maxWidth: '92vw', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#666' }}>{info.timeInfo}</div>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} style={{ padding: 0, minWidth: 'auto', height: 'auto' }} />
      </div>
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#595959' }}>
            原学员：<strong>{info.studentName || '—'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {info.type === '请假' ? (
              <Tag color="orange" style={{ fontSize: 12, height: 22, display: 'inline-flex', alignItems: 'center' }}>请假</Tag>
            ) : (
              <Tag color="red" style={{ fontSize: 12, height: 22, display: 'inline-flex', alignItems: 'center' }}>取消</Tag>
            )}
            <span
              onClick={restoreLoading ? undefined : onRestore}
              style={{
                fontSize: '12px',
                color: restoreLoading ? '#999' : '#389e0d',
                cursor: restoreLoading ? 'not-allowed' : 'pointer',
                textDecoration: restoreLoading ? 'none' : 'underline',
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {restoreLoading ? (
                <>
                  <LoadingOutlined style={{ fontSize: '12px' }} />
                  恢复
                </>
              ) : (
                '恢复'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SchedulePopoverContent = ({ schedule, onDelete, onUpdateName, onUpdateField, onMove, onCopy, onSwap, timetable, isArchived, onClose, deleteLoading, updateLoading, templateSchedules, viewMode, allSchedules, onRemoveSchedule, hasOtherHalf = false }) => {
  const [name, setName] = React.useState(schedule.studentName);
  const [showAllInfo, setShowAllInfo] = React.useState(false);
  const [showLeaveForm, setShowLeaveForm] = React.useState(false);
  const [leaveReason, setLeaveReason] = React.useState('');
  const [leaveSubmitting, setLeaveSubmitting] = React.useState(false);
  const isNameChanged = name !== schedule.studentName;
  const isBlocked = !!schedule.isTimeBlock; // 判断是否为占用时间段（支持true或1）
  
  // 根据开始和结束时间判断是否为半小时课程
  const isActuallyHalfHour = React.useMemo(() => {
    if (!schedule.startTime || !schedule.endTime) return false;
    const start = dayjs(schedule.startTime, 'HH:mm:ss');
    const end = dayjs(schedule.endTime, 'HH:mm:ss');
    const duration = end.diff(start, 'minute');
    return duration === 30;
  }, [schedule.startTime, schedule.endTime]);
  
  // 判断当前是前半小时还是后半小时（如果是半小时课程）
  const currentHalfPosition = React.useMemo(() => {
    if (!isActuallyHalfHour || !schedule.startTime) return null;
    const startTime = dayjs(schedule.startTime, 'HH:mm:ss');
    const minute = startTime.minute();
    // 如果分钟是0或整点，说明是前半小时，如果是30分，说明是后半小时
    return minute === 0 || minute === 30 ? (minute === 0 ? 'first' : 'second') : 'first';
  }, [isActuallyHalfHour, schedule.startTime]);
  
  // 用于控制开关显示的状态（当用户点击开关时立即更新）
  const [tempHalfHourChecked, setTempHalfHourChecked] = React.useState(isActuallyHalfHour);
  
  // 当实际的半小时状态改变时，同步临时状态
  React.useEffect(() => {
    setTempHalfHourChecked(isActuallyHalfHour);
  }, [isActuallyHalfHour]);
  
  // 获取半小时的时间段显示
  const halfHourTimeRange = React.useMemo(() => {
    if (!isActuallyHalfHour) return '';
    const start = dayjs(schedule.startTime, 'HH:mm:ss');
    const end = dayjs(schedule.endTime, 'HH:mm:ss');
    return `${start.format('HH:mm')}-${end.format('HH:mm')}`;
  }, [isActuallyHalfHour, schedule.startTime, schedule.endTime]);
  
  // 处理半小时开关切换
  const handleHalfHourChange = (checked) => {
    if (checked) {
      // 立即更新临时状态，让开关视觉上打开，并显示时间段选择按钮
      setTempHalfHourChecked(true);
    } else {
      // 关闭半小时开关，直接调用更新
      setTempHalfHourChecked(false);
      onUpdateField('isHalfHour', false);
    }
  };
  
  // 确认选择前半或后半小时
  const handleConfirmHalfHourPosition = (position) => {
    // 如果点击的是当前已选中的位置，不需要调用接口
    if (currentHalfPosition === position) {
      return;
    }
    
    // 调用更新，时间段选择按钮会继续显示
    onUpdateField('isHalfHour', true, position);
  };

  // 获取对应的固定课表模板内容
  const getTemplateSchedule = () => {
    if (!timetable || !timetable.isWeekly || viewMode !== 'instance' || !templateSchedules) {
      return null;
    }
    
    return templateSchedules.find(template => 
      template.dayOfWeek === schedule.dayOfWeek &&
      template.startTime === schedule.startTime &&
      template.endTime === schedule.endTime
    );
  };

  const templateSchedule = getTemplateSchedule();
  const isModified = templateSchedule && (
    templateSchedule.studentName !== schedule.studentName ||
    templateSchedule.subject !== schedule.subject ||
    templateSchedule.note !== schedule.note
  );



  return (
    <div style={{ width: '300px', maxWidth: '92vw', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* 时间信息和关闭图标在同一行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {timetable.isWeekly ? (
            `星期${dayMap[schedule.dayOfWeek.toUpperCase()] || schedule.dayOfWeek}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`
          ) : (
            `${dayjs(schedule.scheduleDate).format('YYYY/MM/DD')}, ${schedule.startTime.substring(0, 5)}~${schedule.endTime.substring(0, 5)}`
          )}
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ padding: '0', minWidth: 'auto', height: 'auto' }}
        />
      </div>

      {/* 如果是已修改的课程且学员名不同，显示固定课表原始内容 */}
      {isModified && templateSchedule && schedule.note !== '恢复的课程' && templateSchedule.studentName !== schedule.studentName && (
        <div style={{ 
          backgroundColor: '#f6f6f6', 
          padding: '6px 8px', 
          borderRadius: '4px', 
          marginBottom: '8px',
          border: '1px solid #d9d9d9',
          fontSize: '12px',
          color: '#666'
        }}>
          固定课表原始内容: <strong>{templateSchedule.studentName}</strong>
        </div>
      )}

      {/* 占用时间段显示提示信息 */}
      {isBlocked ? (
        <div style={{ 
          padding: '8px', 
          backgroundColor: 'rgba(255, 77, 79, 0.1)', 
          borderRadius: '4px', 
          marginBottom: '8px',
          border: '1px solid rgba(255, 77, 79, 0.3)',
          fontSize: '14px',
          color: '#ff4d4f',
          textAlign: 'center',
          fontWeight: 500
        }}>
          【占用】
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
            <strong style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>学员:</strong>
            <Input
              size="small"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="学员姓名"
              disabled={isArchived}
              style={{ flex: 1 }}
            />
            {!isArchived && (
              <Button
                size="small"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdateName(name); 
                }}
                disabled={!isNameChanged || updateLoading}
                loading={updateLoading}
                style={{
                  backgroundColor: isNameChanged ? '#faad14' : '#d9d9d9',
                  borderColor: isNameChanged ? '#faad14' : '#d9d9d9',
                  color: 'white',
                  padding: '0 8px',
                  height: '22px',
                  fontSize: '12px',
                  flexShrink: 0
                }}
              >
                修改
              </Button>
            )}
          </div>
          
          {/* 半小时和体验开关 */}
          {!isArchived && onUpdateField && (
            <div 
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', marginBottom: '4px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', gap: '16px' }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: '13px', color: hasOtherHalf ? '#999' : '#666' }}>半小时:</span>
                  <Switch 
                    size="small"
                    checked={tempHalfHourChecked}
                    disabled={hasOtherHalf}
                    onChange={(checked, e) => {
                      if (e) e.stopPropagation();
                      handleHalfHourChange(checked);
                    }}
                  />
                </div>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: '13px', color: '#666' }}>体验:</span>
                  <Switch 
                    size="small"
                    checked={schedule.isTrial === 1 || schedule.isTrial === true}
                    onChange={(checked, e) => {
                      if (e) e.stopPropagation();
                      onUpdateField('isTrial', checked);
                    }}
                  />
                </div>
              </div>
              
              {/* 半小时位置选择按钮 - 当开关打开时显示 */}
              {tempHalfHourChecked && (() => {
                // 计算整小时时间槽的基准时间
                const startTime = dayjs(schedule.startTime, 'HH:mm:ss');
                const minute = startTime.minute();
                // 如果当前是后半小时（分钟=30），需要减去30分钟得到基准时间
                const baseTime = minute === 30 ? startTime.subtract(30, 'minute') : startTime;
                
                return (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    paddingTop: '4px',
                    paddingBottom: '4px',
                    position: 'relative',
                    zIndex: 10
                  }}>
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        if (!hasOtherHalf) {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!hasOtherHalf) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                      onClick={(e) => {
                        if (hasOtherHalf) return;
                        e.preventDefault();
                        e.stopPropagation();
                        handleConfirmHalfHourPosition('first');
                      }}
                      style={{ 
                        flex: 1, 
                        fontSize: '12px',
                        padding: '4px 15px',
                        textAlign: 'center',
                        borderRadius: '6px',
                        background: currentHalfPosition === 'first' 
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%)'
                          : 'rgba(230, 230, 230, 0.6)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: currentHalfPosition === 'first' ? '#fff' : '#666',
                        border: currentHalfPosition === 'first' ? 'none' : '1px solid rgba(217, 217, 217, 0.6)',
                        fontWeight: currentHalfPosition === 'first' ? '500' : 'normal',
                        cursor: hasOtherHalf ? 'not-allowed' : 'pointer',
                        pointerEvents: hasOtherHalf ? 'none' : 'auto',
                        position: 'relative',
                        zIndex: 11,
                        userSelect: 'none',
                        transition: 'all 0.3s ease',
                        opacity: hasOtherHalf ? 0.6 : 1
                      }}
                    >
                      {baseTime.format('HH:mm')}-{baseTime.add(30, 'minute').format('HH:mm')}
                    </div>
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseEnter={(e) => {
                        if (!hasOtherHalf) {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!hasOtherHalf) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                      onClick={(e) => {
                        if (hasOtherHalf) return;
                        e.preventDefault();
                        e.stopPropagation();
                        handleConfirmHalfHourPosition('second');
                      }}
                      style={{ 
                        flex: 1, 
                        fontSize: '12px',
                        padding: '4px 15px',
                        textAlign: 'center',
                        borderRadius: '6px',
                        background: currentHalfPosition === 'second' 
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%)'
                          : 'rgba(230, 230, 230, 0.6)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: currentHalfPosition === 'second' ? '#fff' : '#666',
                        border: currentHalfPosition === 'second' ? 'none' : '1px solid rgba(217, 217, 217, 0.6)',
                        fontWeight: currentHalfPosition === 'second' ? '500' : 'normal',
                        cursor: hasOtherHalf ? 'not-allowed' : 'pointer',
                        pointerEvents: hasOtherHalf ? 'none' : 'auto',
                        position: 'relative',
                        zIndex: 11,
                        userSelect: 'none',
                        transition: 'all 0.3s ease',
                        opacity: hasOtherHalf ? 0.6 : 1
                      }}
                    >
                      {baseTime.add(30, 'minute').format('HH:mm')}-{baseTime.add(60, 'minute').format('HH:mm')}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}






      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
        {/* 占用时间段不显示"全部"按钮 */}
        {!isBlocked && (
          <Button
            type="primary"
            size="small"
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowAllInfo(!showAllInfo); 
              setShowLeaveForm(false); 
            }}
            style={{ 
              flex: 1,
              backgroundColor: '#52c41a',
              borderColor: '#52c41a'
            }}
          >
            {showAllInfo ? '收起' : '全部'}
          </Button>
        )}
        {!isArchived && (
          <>
            <Button
              type="default"
              size="small"
              onClick={(e) => { 
                e.stopPropagation(); 
                onMove(schedule); 
              }}
              style={{
                flex: 1,
                backgroundColor: '#1890ff',
                borderColor: '#1890ff',
                color: 'white'
              }}
            >
              移动
            </Button>
            <Button
              type="default"
              size="small"
              onClick={(e) => { 
                e.stopPropagation(); 
                onCopy(schedule, null); 
              }}
              style={{
                flex: 1,
                backgroundColor: '#722ed1',
                borderColor: '#722ed1',
                color: 'white'
              }}
            >
              复制
            </Button>
          </>
        )}
      </div>

      {/* 第二行：请假、调换、删除按钮 */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        {/* 占用时间段不显示"请假"按钮，实例课表模式下显示请假按钮 */}
        {!isBlocked && !isArchived && viewMode === 'instance' && (
          <Button
            type="default"
            size="small"
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowLeaveForm(!showLeaveForm); 
              setShowAllInfo(false); 
            }}
            style={{
              flex: 1,
              backgroundColor: '#fa8c16',
              borderColor: '#fa8c16',
              color: 'white'
            }}
          >
            {showLeaveForm ? '收起' : '请假'}
          </Button>
        )}
        {!isArchived && (
          <>
            <Button
              type="default"
              size="small"
              onClick={(e) => { 
                e.stopPropagation(); 
                onSwap(schedule); 
              }}
              style={{
                flex: 1,
                backgroundColor: '#13c2c2',
                borderColor: '#13c2c2',
                color: 'white'
              }}
            >
              调换
            </Button>
            <Button
              type="default"
              size="small"
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(); 
              }}
              loading={deleteLoading}
              disabled={deleteLoading}
              style={{
                flex: 1,
                backgroundColor: '#ff4d4f',
                borderColor: '#ff4d4f',
                color: 'white'
              }}
            >
              删除
            </Button>
          </>
        )}
      </div>

      {/* 全部信息显示区域 - 显示该学员本周所有课程 */}
      {showAllInfo && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            {schedule.studentName} 本周课程安排：
          </div>
          {(() => {
            // 获取该学员本周的所有课程
            const studentSchedules = allSchedules.filter(s => s.studentName === schedule.studentName);
            
            if (studentSchedules.length === 0) {
              return <div style={{ color: '#999' }}>暂无其他课程</div>;
            }
            
            // 按日期排序（从早到晚）
            const sortedSchedules = studentSchedules.sort((a, b) => {
              if (!a.scheduleDate || !b.scheduleDate) return 0;
              const dateA = dayjs(a.scheduleDate);
              const dateB = dayjs(b.scheduleDate);
              if (!dateA.isSame(dateB, 'day')) {
                return dateA.isBefore(dateB) ? -1 : 1;
              }
              // 同一天按开始时间排序
              return (a.startTime || '').localeCompare(b.startTime || '');
            });
            
            // 按周分组
            const weekGroups = {};
            sortedSchedules.forEach(s => {
              if (s.scheduleDate) {
                const weekStart = dayjs(s.scheduleDate).startOf('week');
                const weekKey = weekStart.format('YYYY-MM-DD');
                if (!weekGroups[weekKey]) {
                  weekGroups[weekKey] = {
                    weekStart,
                    schedules: []
                  };
                }
                weekGroups[weekKey].schedules.push(s);
              }
            });
            
            const now = dayjs();
            
            // 按周顺序排列显示
            return Object.keys(weekGroups)
              .sort((a, b) => a.localeCompare(b))
              .map((weekKey, weekIndex) => {
                const group = weekGroups[weekKey];
                const weekStart = group.weekStart;
                const weekEnd = weekStart.add(6, 'day');
                const weekLabel = `${weekStart.format('YYYY/MM/DD')}-${weekEnd.format('MM/DD')}`;
                
                return (
                  <div key={weekKey} style={{ marginBottom: '8px' }}>
                    {/* 周标签 */}
                    <div style={{
                      fontSize: '11px',
                      color: '#1890ff',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      padding: '2px 6px',
                      backgroundColor: '#e6f7ff',
                      borderRadius: '3px',
                      display: 'inline-block'
                    }}>
                      {weekLabel}
                    </div>
                    
                    {/* 该周的课程 */}
                    {group.schedules.map((studentSchedule, index) => {
                      // 判断课程是否已上（比较日期和时间）
                      let isPast = false;
                      if (studentSchedule.scheduleDate) {
                        const scheduleDateTime = dayjs(`${studentSchedule.scheduleDate} ${studentSchedule.endTime}`);
                        isPast = scheduleDateTime.isBefore(now);
                      }
                      
                      // 获取显示的日期
                      let displayDate = '';
                      if (studentSchedule.scheduleDate) {
                        displayDate = dayjs(studentSchedule.scheduleDate).format('YYYY/MM/DD');
                      }
                      
                      return (
                        <div key={studentSchedule.id || index} style={{ 
                          marginBottom: '4px', 
                          padding: '4px', 
                          backgroundColor: isPast ? '#fff1f0' : 'white', 
                          borderRadius: '2px',
                          border: studentSchedule.id === schedule.id ? '1px solid #1890ff' : '1px solid #e8e8e8'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              {displayDate && <span style={{ marginRight: '8px', color: '#666' }}>{displayDate}</span>}
                              <strong>星期{dayMap[studentSchedule.dayOfWeek?.toUpperCase()] || studentSchedule.dayOfWeek}</strong>
                              <span style={{ marginLeft: '8px' }}>
                                {studentSchedule.startTime?.substring(0, 5)}~{studentSchedule.endTime?.substring(0, 5)}
                              </span>
                            </div>
                            {studentSchedule.id === schedule.id && (
                              <span style={{ 
                                fontSize: '10px', 
                                color: '#1890ff', 
                                backgroundColor: '#e6f7ff', 
                                padding: '1px 4px', 
                                borderRadius: '2px' 
                              }}>
                                当前
                              </span>
                            )}
                          </div>
                          {studentSchedule.subject && (
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                              科目：{studentSchedule.subject}
                            </div>
                          )}
                          {studentSchedule.note && (
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                              备注：{studentSchedule.note}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
          })()}
        </div>
      )}

      {/* 请假内嵌表单 */}
      {showLeaveForm && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: '4px'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="请输入请假原因（选填）"
              style={{ flex: 1, height: 30, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <button
              disabled={leaveSubmitting}
              onClick={async () => {
                try {
                  setLeaveSubmitting(true);
                  const resp = await requestLeave(schedule.id, leaveReason);
                  if (resp && resp.success) {
                    if (onRemoveSchedule) onRemoveSchedule(schedule.id);
                    if (onClose) onClose();
                    setShowLeaveForm(false);
                    message.success('请假申请成功');
                  } else {
                    message.error(resp?.message || '请假申请失败');
                  }
                } catch (e) {
                  message.error('请假申请失败');
                } finally {
                  setLeaveSubmitting(false);
                }
              }}
              style={{
                backgroundColor: '#fa8c16',
                color: '#fff',
                border: 'none',
                padding: '0 12px',
                borderRadius: 4,
                height: 30,
                cursor: 'pointer',
                flex: 1
              }}
            >
              {leaveSubmitting ? '提交中...' : '确认'}
            </button>
            <button
              disabled={leaveSubmitting}
              onClick={() => setShowLeaveForm(false)}
              style={{
                backgroundColor: '#ffffff',
                color: '#595959',
                border: '1px solid #d9d9d9',
                padding: '0 12px',
                borderRadius: 4,
                height: 30,
                cursor: 'pointer',
                flex: 1
              }}
            >
              取消
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>请假后该课程将从课表中移除</div>
        </div>
      )}
    </div>
  );
};

const NewSchedulePopoverContent = ({ onAdd, onBlock, onCancel, addLoading, timeInfo, hasHalfHourCourse = false, defaultHalfHourPosition = 'first', defaultIsHalfHour = false, fixedTimeSlot = null, studentOptions = [], disableHalfHourSwitch = false }) => {
  const [name, setName] = React.useState('');
  const [isHalfHour, setIsHalfHour] = React.useState(defaultIsHalfHour);
  const [halfHourPosition, setHalfHourPosition] = React.useState(defaultHalfHourPosition); // first: 前半小时, second: 后半小时
  const [isTrial, setIsTrial] = React.useState(false); // 是否为体验课程

  return (
    <div style={{ width: 'auto', minWidth: '160px', maxWidth: '92vw', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* 时间信息显示、半小时开关和体验开关 */}
      {timeInfo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
          <span style={{ whiteSpace: 'nowrap', marginRight: '8px' }}>{fixedTimeSlot || timeInfo}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ whiteSpace: 'nowrap' }}>半小时</span>
              <Switch
                size="small"
                checked={isHalfHour}
                onChange={setIsHalfHour}
                disabled={addLoading || fixedTimeSlot || disableHalfHourSwitch}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ whiteSpace: 'nowrap' }}>体验</span>
              <Switch
                size="small"
                checked={isTrial}
                onChange={setIsTrial}
                disabled={addLoading}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* 当用户选择了半小时且没有固定时间段时，显示具体时间段选择 */}
      {isHalfHour && timeInfo && !fixedTimeSlot && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>选择时间段：</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="small"
              type={halfHourPosition === 'first' ? 'primary' : 'default'}
              ghost={halfHourPosition === 'first'}
              onClick={() => setHalfHourPosition('first')}
              disabled={addLoading || (disableHalfHourSwitch && halfHourPosition !== 'first')}
              style={{ flex: 1, fontSize: '11px' }}
            >
              {(() => {
                // 从时间信息中提取时间槽，计算前半小时时间段
                const timeMatch = timeInfo.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
                if (timeMatch) {
                  const [, startTime, endTime] = timeMatch;
                  const startHour = parseInt(startTime.split(':')[0]);
                  const startMinute = startTime.split(':')[1];
                  const endHour = parseInt(endTime.split(':')[0]);
                  const endMinute = endTime.split(':')[1];
                  
                  // 前半小时：14:00-14:30
                  const firstHalfEnd = startHour + (startMinute === '30' ? 1 : 0);
                  const firstHalfEndMinute = startMinute === '30' ? '00' : '30';
                  return `${startHour}:${startMinute}-${firstHalfEnd}:${firstHalfEndMinute}`;
                }
                return '前半小时';
              })()}
            </Button>
            <Button
              size="small"
              type={halfHourPosition === 'second' ? 'primary' : 'default'}
              ghost={halfHourPosition === 'second'}
              onClick={() => setHalfHourPosition('second')}
              disabled={addLoading || (disableHalfHourSwitch && halfHourPosition !== 'second')}
              style={{ flex: 1, fontSize: '11px' }}
            >
              {(() => {
                // 从时间信息中提取时间槽，计算后半小时时间段
                const timeMatch = timeInfo.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
                if (timeMatch) {
                  const [, startTime, endTime] = timeMatch;
                  const startHour = parseInt(startTime.split(':')[0]);
                  const startMinute = startTime.split(':')[1];
                  const endHour = parseInt(endTime.split(':')[0]);
                  const endMinute = endTime.split(':')[1];
                  
                  // 后半小时：14:30-15:00
                  const secondHalfStart = startHour + (startMinute === '30' ? 1 : 0);
                  const secondHalfStartMinute = startMinute === '30' ? '00' : '30';
                  return `${secondHalfStart}:${secondHalfStartMinute}-${endHour}:${endMinute}`;
                }
                return '后半小时';
              })()}
            </Button>
          </div>
        </div>
      )}
      
      <AutoComplete
        size="small"
        placeholder="学生姓名"
        value={name}
        onChange={(value) => setName(value)}
        onSearch={(value) => {
          // 可以在这里实现搜索逻辑，目前使用默认的过滤
        }}
        options={studentOptions}
        disabled={addLoading}
        style={{ width: '100%', marginBottom: '8px' }}
        filterOption={(inputValue, option) =>
          option.value.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
        }
      />
      
      {/* 当没有timeInfo时，也显示半小时与体验开关（紧凑靠右） */}
      {!timeInfo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '8px', fontSize: '12px', color: '#666', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>半小时</span>
            <Switch
              size="small"
              checked={isHalfHour}
              onChange={setIsHalfHour}
              disabled={addLoading || disableHalfHourSwitch}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>体验</span>
            <Switch
              size="small"
              checked={isTrial}
              onChange={setIsTrial}
              disabled={addLoading}
            />
          </div>
        </div>
      )}

      {/* 当没有timeInfo也允许选择前后半小时（仅标签） */}
      {isHalfHour && !timeInfo && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>选择时间段：</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="small"
              type={halfHourPosition === 'first' ? 'primary' : 'default'}
              ghost={halfHourPosition === 'first'}
              onClick={() => setHalfHourPosition('first')}
              disabled={addLoading || (disableHalfHourSwitch && halfHourPosition !== 'first')}
              style={{ flex: 1, fontSize: '11px' }}
            >
              前半小时
            </Button>
            <Button
              size="small"
              type={halfHourPosition === 'second' ? 'primary' : 'default'}
              ghost={halfHourPosition === 'second'}
              onClick={() => setHalfHourPosition('second')}
              disabled={addLoading || (disableHalfHourSwitch && halfHourPosition !== 'second')}
              style={{ flex: 1, fontSize: '11px' }}
            >
              后半小时
            </Button>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: '8px' }}>
        {onBlock && (
          <Button 
            size="small" 
            onClick={() => onBlock({ isHalfHour, halfHourPosition })}
            disabled={addLoading}
            style={{ 
              backgroundColor: 'rgba(255, 77, 79, 0.15)', 
              borderColor: 'rgba(255, 77, 79, 0.3)',
              color: '#ff4d4f',
              fontWeight: 500
            }}
          >
            占用
          </Button>
        )}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <Button size="small" onClick={onCancel} disabled={addLoading}>
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => onAdd({ studentName: name, isHalfHour, halfHourPosition, isTrial })}
            loading={addLoading}
            disabled={addLoading}
          >
            添加
          </Button>
        </div>
      </div>
    </div>
  );
};
const ViewTimetable = ({ user }) => {
  const [timetable, setTimetable] = useState(null);
  const [timetableOwner, setTimetableOwner] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  // 本页采用"每区块一次"的策略：各区块调用 *Once 方法（带合并+缓存）
  const [templateSchedules, setTemplateSchedules] = useState([]); // 存储固定课表模板数据用于比较
  const [loading, setLoading] = useState(false); // 初始为false，避免返回时白屏
  
  // 移除了 viewModeRef，简化渲染逻辑
  
  // 周实例相关状态
  const [viewMode, setViewMode] = useState('instance'); // 'template' | 'instance' | 'today' | 'tomorrow'
  const [currentWeekInstance, setCurrentWeekInstance] = useState(null);
  const [hasCurrentWeekInstance, setHasCurrentWeekInstance] = useState(false);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [instanceDataLoading, setInstanceDataLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  
  // 每周实例分页相关状态
  const [weeklyInstances, setWeeklyInstances] = useState([]);
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [openPopoverKey, setOpenPopoverKey] = useState(null);
  const [openScheduleId, setOpenScheduleId] = useState(null); // 用于跟踪打开的课程ID，保持Popover在课程移动后仍然打开
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [availableTimeModalVisible, setAvailableTimeModalVisible] = useState(false);
  
  // 周实例显示范围状态
  const [displayStartIndex, setDisplayStartIndex] = useState(0);
  const maxDisplayCount = 3; // 最多显示3个实例
  
  // 计算当前显示的实例范围
  const getDisplayInstances = (instances) => {
    if (instances.length <= maxDisplayCount) {
      return instances;
    }
    const endIndex = Math.min(displayStartIndex + maxDisplayCount, instances.length);
    return instances.slice(displayStartIndex, endIndex);
  };
  
  // 更新显示范围，确保当前选中的实例在显示范围内
  const updateDisplayRange = (newCurrentIndex, instances) => {
    if (instances.length <= maxDisplayCount) {
      return;
    }
    
    let newStartIndex = displayStartIndex;
    
    // 如果当前实例不在显示范围内，调整显示范围
    if (newCurrentIndex < displayStartIndex) {
      newStartIndex = newCurrentIndex;
    } else if (newCurrentIndex >= displayStartIndex + maxDisplayCount) {
      newStartIndex = newCurrentIndex - maxDisplayCount + 1;
    }
    
    // 确保不超出边界
    newStartIndex = Math.max(0, Math.min(newStartIndex, instances.length - maxDisplayCount));
    
    if (newStartIndex !== displayStartIndex) {
      setDisplayStartIndex(newStartIndex);
    }
  };
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportingStudentName, setExportingStudentName] = useState('');

  // 请假相关状态
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveSchedule, setLeaveSchedule] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // 防抖/竞态控制：视图切换时只接受最后一次请求结果
  const latestRequestIdRef = useRef(0);
  
  // 防止重复生成周实例的标志
  const generatingRef = useRef(false);

  // 多选功能状态
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [batchScheduleModalVisible, setBatchScheduleModalVisible] = useState(false);
  const [batchStudentName, setBatchStudentName] = useState('');
  
  // 多选删除功能状态
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedSchedulesForDelete, setSelectedSchedulesForDelete] = useState(new Set());

  // Day schedule modal state
  const [dayScheduleModalVisible, setDayScheduleModalVisible] = useState(false);
  const [dayScheduleData, setDayScheduleData] = useState([]);
  const [dayScheduleTitle, setDayScheduleTitle] = useState('');
  const [daySchedulesForCopy, setDaySchedulesForCopy] = useState([]);
  const [currentDayDate, setCurrentDayDate] = useState(null);
  const [currentDayLabel, setCurrentDayLabel] = useState('');

  // 复制时包含其他教练课程相关状态
  const [copyOtherCoachesInModal, setCopyOtherCoachesInModal] = useState(true);
  const [otherCoachesDataInModal, setOtherCoachesDataInModal] = useState([]);
  const [loadingOtherCoachesInModal, setLoadingOtherCoachesInModal] = useState(false);
  const [otherCoachesExpanded, setOtherCoachesExpanded] = useState(false);

  // 移动功能状态
  const [moveMode, setMoveMode] = useState(false);
  const [scheduleToMove, setScheduleToMove] = useState(null);
  const [selectedMoveTarget, setSelectedMoveTarget] = useState(null);
  const [moveTargetText, setMoveTargetText] = useState('请选择要移动到的时间段');
  const [moveLoading, setMoveLoading] = useState(false);

  // 复制功能状态
  const [copyMode, setCopyMode] = useState(false);
  const [scheduleToCopy, setScheduleToCopy] = useState(null);
  const [selectedCopyTargets, setSelectedCopyTargets] = useState(new Set());
  const [copyLoading, setCopyLoading] = useState(false);

  // 调换功能状态
  const [swapMode, setSwapMode] = useState(false);
  const [scheduleToSwap, setScheduleToSwap] = useState(null);
  const [selectedSwapTarget, setSelectedSwapTarget] = useState(null);
  const [swapTargetText, setSwapTargetText] = useState('请选择要调换的课程');
  const [swapLoading, setSwapLoading] = useState(false);

  // 删除功能状态
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // 修改和添加功能状态
  const [updateLoading, setUpdateLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  
  // 视图切换loading状态
  const [switchToInstanceLoading, setSwitchToInstanceLoading] = useState(false);
  const [switchToTemplateLoading, setSwitchToTemplateLoading] = useState(false);
  
  // 视图切换时的临时数据保存
  const [tempSchedules, setTempSchedules] = useState([]);
  const [tempViewMode, setTempViewMode] = useState(null);
  const [tempWeeklyStats, setTempWeeklyStats] = useState(null);
  
  // 保存切换到固定课表前的实例状态
  const savedInstanceRef = useRef(null);

  

  const availableSlotsTitle = useMemo(() => {
    if (viewMode === 'template') {
      return '固定可排课时段';
    }
    return '本周可供排课时段';
  }, [viewMode]);

  // 智能弹框定位函数
  const getSmartPlacement = useCallback((dayIndex, timeIndex) => {
    const totalTimeSlots = 11; // 固定的时间段数量：09:00-20:00，共11个时间段
    const screenWidth = window.innerWidth;

    // 移动端优先使用上下方向
    if (screenWidth <= 768) {
      if (timeIndex <= Math.floor(totalTimeSlots / 2)) {
        return 'bottom';
      } else {
        return 'top';
      }
    }

    // 桌面端智能定位
    // 根据列位置决定左右方向 (dayIndex: 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日)
    let horizontalPlacement;
    if (dayIndex <= 1) {
      // 周一、周二：弹框显示在右侧
      horizontalPlacement = 'right';
    } else if (dayIndex >= 4) {
      // 周五、周六、周日：弹框显示在左侧（避免超出屏幕右边）
      horizontalPlacement = 'left';
    } else {
      // 周三、周四：根据时间位置决定，优先使用上下方向
      if (timeIndex <= Math.floor(totalTimeSlots / 3)) {
        return 'bottom';
      } else if (timeIndex >= Math.floor(totalTimeSlots * 2 / 3)) {
        return 'top';
      } else {
        return 'top'; // 中间时间段默认上方
      }
    }

    // 根据行位置决定上下方向
    let verticalPlacement;
    if (timeIndex <= Math.floor(totalTimeSlots / 3)) {
      // 前1/3行，弹框显示在下方
      verticalPlacement = 'Bottom';
    } else if (timeIndex >= Math.floor(totalTimeSlots * 2 / 3)) {
      // 后1/3行，弹框显示在上方
      verticalPlacement = 'Top';
    } else {
      // 中间行，默认显示在下方
      verticalPlacement = 'Bottom';
    }

    return `${horizontalPlacement}${verticalPlacement}`;
  }, []);



  const tableRef = useRef(null);
  const navigate = useNavigate();
  const { timetableId } = useParams();
  const addScheduleInputRef = useRef(null);
  const [newScheduleInfo, setNewScheduleInfo] = useState({ 
    studentName: '', 
    isHalfHour: false, // 默认1小时，false表示1小时，true表示半小时
    halfHourPosition: 'first' // 半小时位置：first=前半小时，second=后半小时
  });
  const [popoverVisible, setPopoverVisible] = useState({});
  
  // 学员自动完成相关状态
  const [studentOptions, setStudentOptions] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const handlePopoverVisibleChange = (key, visible) => {
    setPopoverVisible(prev => ({ ...prev, [key]: visible }));
    if (!visible) {
      setNewScheduleInfo({ studentName: '', isHalfHour: false, halfHourPosition: 'first' }); // 关闭时清空输入
    }
  };

  // 获取课表拥有者的学员列表
  const fetchStudentOptions = useCallback(async () => {
    if (!timetableOwner) return;
    
    setLoadingStudents(true);
    try {
      // 根据课表拥有者ID获取学员列表
      const response = await getAllStudents(false, null, timetableOwner.id);
      if (response && response.success) {
        const students = response.data || [];
        let studentNames = [];
        
        // 处理数据结构，可能是学员数组或教练分组数组
        if (students.length > 0 && students[0].studentName) {
          // 直接是学员数组
          studentNames = students.map(s => s.studentName).filter(Boolean);
        } else if (students.length > 0 && students[0].students) {
          // 是教练分组数组，提取所有学员
          students.forEach(group => {
            if (group.students && Array.isArray(group.students)) {
              studentNames.push(...group.students.map(s => s.studentName).filter(Boolean));
            }
          });
        }
        
        // 去重并转换为AutoComplete选项格式
        const uniqueNames = [...new Set(studentNames)];
        const options = uniqueNames.map(name => ({
          value: name,
          label: name
        }));
        
        setStudentOptions(options);
      }
    } catch (error) {
      console.error('获取学员列表失败:', error);
    } finally {
      setLoadingStudents(false);
    }
  }, [timetableOwner]);

  // 判断课程是否为半小时课程
  const isHalfHourSchedule = (schedule) => {
    // 方法1: 检查note字段
    if (schedule.note && schedule.note.includes('30分钟')) {
      return true;
    }
    
    // 方法2: 计算时间差
    if (schedule.startTime && schedule.endTime) {
      const start = dayjs(schedule.startTime, 'HH:mm:ss');
      const end = dayjs(schedule.endTime, 'HH:mm:ss');
      const duration = end.diff(start, 'minute');
      return duration === 30;
    }
    
    return false;
  };

  // 判断是否为占用时间段并返回样式
  const getScheduleStyle = (schedule, baseColor) => {
    const isBlocked = !!schedule.isTimeBlock;
    if (isBlocked) {
      return {
        background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, #d9d9d9 8px, #d9d9d9 9px)',
        backgroundColor: '#fafafa',
        color: '#999',
        opacity: 0.8,
        border: '2px solid #1890ff',
        boxSizing: 'border-box',
      };
    }
    return {
      backgroundColor: baseColor || 'transparent',
      color: '#333',
      opacity: 1,
    };
  };

  // 获取显示的学生名称（占用时间段显示"占用"）
  const getDisplayName = (schedule) => {
    return !!schedule.isTimeBlock ? '占用' : schedule.studentName;
  };

  // 根据日期和时间获取对应的课程
  const getScheduleForCell = (dayKey, timeIndex) => {
    const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'];
    const timeSlot = timeSlots[timeIndex];
    if (!timeSlot) return null;
    
    const [startTime, endTime] = timeSlot.split('-');
    const startTimeFormatted = `${startTime}:00`;
    const endTimeFormatted = `${endTime}:00`;
    
    return allSchedules.find(schedule => 
      schedule.dayOfWeek?.toUpperCase() === dayKey.toUpperCase() &&
      schedule.startTime === startTimeFormatted &&
      schedule.endTime === endTimeFormatted
    );
  };

  // 计算课程的课时数（半小时课程按0.5计算，占用时间段不计入课时）
  const calculateScheduleHours = (schedule) => {
    // 占用时间段不计入课时
    if (!!schedule.isTimeBlock) {
      return 0;
    }
    
    if (isHalfHourSchedule(schedule)) {
      return 0.5;
    }
    
    // 计算实际课时
    if (schedule.startTime && schedule.endTime) {
      const start = dayjs(schedule.startTime, 'HH:mm:ss');
      const end = dayjs(schedule.endTime, 'HH:mm:ss');
      const duration = end.diff(start, 'minute');
      return duration / 60; // 转换为小时
    }
    
    return 1; // 默认1课时
  };

  // 处理时间单元格点击，显示可供排课时段
  const handleTimeCellClick = (timeSlot) => {
    const availableSlots = [];
    
    // 定义时间段
    const timeSlots = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'
    ];
    
    // 遍历每一天
    weekDays.forEach((day, dayIndex) => {
      const isWeekend = dayIndex >= 5; // 周六(5)和周日(6)
      const startHour = isWeekend ? 10 : 16; // 周末10点开始，工作日16点开始
      const endHour = 20; // 都到20点结束
      
      // 获取该天已排课的时间段
      const scheduledTimes = displaySchedules
        .filter(schedule => {
          if (displayViewMode === 'instance') {
            // 优先按日期过滤（实例课程带有 scheduleDate）
            if (schedule.scheduleDate) {
              const base = currentWeekInstance?.weekStartDate 
                ? dayjs(currentWeekInstance.weekStartDate) 
                : dayjs().startOf('week');
              const currentDate = base.add(dayIndex, 'day');
              return schedule.scheduleDate === currentDate.format('YYYY-MM-DD');
            }
            // 回退：没有日期字段时按星期几过滤
            return (schedule.dayOfWeek || '').toLowerCase() === day.key;
          }
          // 模板视图：按星期几过滤
          return (schedule.dayOfWeek || '').toLowerCase() === day.key;
        })
        .map(schedule => `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`);
      
      // 检查每个时间段是否空闲
      timeSlots.forEach(timeSlot => {
        const [startTime] = timeSlot.split('-');
        const hour = parseInt(startTime.split(':')[0]);
        
        // 检查是否在可选时间范围内
        if (hour >= startHour && hour < endHour) {
          // 周末午休时间排除
          if (isWeekend && (hour === 12 || hour === 13)) {
            return; // continue
          }
          // 检查是否已排课
          if (!scheduledTimes.includes(timeSlot)) {
            availableSlots.push({
              day: day.label,
              date: displayViewMode === 'instance' && currentWeekInstance 
                ? dayjs(currentWeekInstance.weekStartDate).add(dayIndex, 'day').format('MM/DD')
                : null,
              timeSlot: timeSlot,
              dayIndex: dayIndex
            });
          }
        }
      });
    });
    
    setAvailableTimeSlots(availableSlots);
    setAvailableTimeModalVisible(true);
  };
  
  // 处理占用时间段
  const handleBlockTime = async (dayKey, timeIndex, scheduleInfo) => {
    const [startTimeStr, endTimeStr] = timeSlots[timeIndex].split('-');
    let startTime = dayjs(startTimeStr, 'HH:mm');
    
    // 如果用户选择了半小时，根据位置调整开始时间
    if (scheduleInfo.isHalfHour && scheduleInfo.halfHourPosition === 'second') {
      startTime = startTime.add(30, 'minute');
    }
    
    // 根据选择的时长计算结束时间
    let endTime;
    if (scheduleInfo.isHalfHour) {
      endTime = startTime.add(30, 'minute');
    } else {
      endTime = startTime.add(60, 'minute');
    }
    
    const startTimeFormatted = `${startTime.format('HH:mm')}:00`;
    const endTimeFormatted = `${endTime.format('HH:mm')}:00`;

    let scheduleDate = null;
    if (timetable.isWeekly) {
      if (viewMode === 'instance' && currentWeekInstance) {
        const dayIndex = weekDays.findIndex(day => day.key === dayKey);
        const base = dayjs(currentWeekInstance.weekStartDate);
        const currentDate = base.add(dayIndex, 'day');
        scheduleDate = currentDate.format('YYYY-MM-DD');
      }
    } else {
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        const dayIndex = weekDays.findIndex(day => day.key === dayKey);
        const currentDate = weekDates.start.add(dayIndex, 'day');
        scheduleDate = currentDate.format('YYYY-MM-DD');
      }
    }

    const payload = {
      studentName: '【占用】',
      dayOfWeek: dayKey.toUpperCase(),
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      note: `时间占用 (${scheduleInfo.isHalfHour ? '30分钟' : '1小时'})`,
      isTimeBlock: true,
    };

    if (scheduleDate) {
      payload.scheduleDate = scheduleDate;
    }

    setAddLoading(true);
    try {
      let resp;
      if (viewMode === 'instance' && currentWeekInstance) {
        resp = await createInstanceSchedule(currentWeekInstance.id, payload);
      } else {
        resp = await createSchedule(timetableId, payload);
      }
      
      if (resp.success) {
        const newSchedule = resp.data || {
          id: Date.now(),
          studentName: '【占用】',
          dayOfWeek: dayKey.toUpperCase(),
          startTime: startTimeFormatted,
          endTime: endTimeFormatted,
          note: payload.note,
          scheduleDate: payload.scheduleDate,
          isTimeBlock: true
        };
        
        setAllSchedules(prev => [...prev, newSchedule]);
        handlePopoverVisibleChange(`popover-${dayKey}-${timeIndex}`, false);
        
        const refreshData = async () => {
          try {
            if (viewMode === 'instance' && currentWeekInstance) {
              const r = await getInstanceSchedules(currentWeekInstance.id);
              if (r && r.success) {
                setAllSchedules(r.data || []);
                setCurrentWeekInstance(prev => ({
                  ...prev,
                  schedules: r.data || []
                }));
              }
            } else {
              await refreshSchedulesQuietly();
            }
          } catch (error) {
            console.error('异步刷新数据失败:', error);
          }
        };
        
        setTimeout(refreshData, 200);
        message.success('占用时间段成功');
      } else {
        message.error(resp.message || '占用失败');
      }
    } catch (err) {
      message.error('网络错误，占用失败');
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddSchedule = async (dayKey, timeIndex, scheduleInfo) => {
    const trimmedName = scheduleInfo.studentName.trim();
    if (!trimmedName) {
      message.warning('学生姓名不能为空');
      return;
    }

    const [startTimeStr, endTimeStr] = timeSlots[timeIndex].split('-');
    let startTime = dayjs(startTimeStr, 'HH:mm');
    
    // 如果用户选择了半小时，根据位置调整开始时间
    if (scheduleInfo.isHalfHour && scheduleInfo.halfHourPosition === 'second') {
      startTime = startTime.add(30, 'minute'); // 后半小时：从时间槽开始时间+30分钟
    }
    // 前半小时：从时间槽开始时间（保持原时间）
    
    // 根据选择的时长计算结束时间
    let endTime;
    if (scheduleInfo.isHalfHour) {
      endTime = startTime.add(30, 'minute');
    } else {
      endTime = startTime.add(60, 'minute');
    }
    
    const startTimeFormatted = `${startTime.format('HH:mm')}:00`;
    const endTimeFormatted = `${endTime.format('HH:mm')}:00`;

    let scheduleDate = null;
  // 统一规则（修正）：
  // - 周固定课表（isWeekly=true）：
  //   - 实例视图：仅写入"当前周实例"，需要具体日期 scheduleDate
  //   - 模板视图：写入"固定课表模板"，不带具体日期（不设置 scheduleDate）
  // - 日期范围课表（isWeekly=false）：始终使用当前周计算具体日期
  if (timetable.isWeekly) {
    if (viewMode === 'instance' && currentWeekInstance) {
      const dayIndex = weekDays.findIndex(day => day.key === dayKey);
      const base = dayjs(currentWeekInstance.weekStartDate);
      const currentDate = base.add(dayIndex, 'day');
      scheduleDate = currentDate.format('YYYY-MM-DD');
    }
  } else {
    const weekDates = getCurrentWeekDates();
    if (weekDates.start) {
      const dayIndex = weekDays.findIndex(day => day.key === dayKey);
      const currentDate = weekDates.start.add(dayIndex, 'day');
      scheduleDate = currentDate.format('YYYY-MM-DD');
    }
  }

    const payload = {
      studentName: trimmedName,
      dayOfWeek: dayKey.toUpperCase(),
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      note: `手动添加 (${scheduleInfo.isHalfHour ? '30分钟' : '1小时'})`,
    };

  // 仅当需要按日期写入（实例或日期范围课表）时，才设置 scheduleDate
  if (scheduleDate) {
    payload.scheduleDate = scheduleDate;
  }

    setAddLoading(true);
    try {
      let resp;
  if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：直接在实例中创建课程
        resp = await createInstanceSchedule(currentWeekInstance.id, payload);
      } else {
        // 模板视图：在固定课表中创建模板课程
        resp = await createSchedule(timetableId, payload);
      }
      
      if (resp.success) {
        // 立即将新课程添加到当前状态，无需等待重新获取
        const newSchedule = resp.data || {
          id: Date.now(), // 临时ID
          studentName: trimmedName,
          dayOfWeek: dayKey.toUpperCase(),
          startTime: startTimeFormatted,
          endTime: endTimeFormatted,
          note: payload.note,
          scheduleDate: payload.scheduleDate
        };
        
        setAllSchedules(prev => [...prev, newSchedule]);
        
        // 关闭弹出框
        handlePopoverVisibleChange(`popover-${dayKey}-${timeIndex}`, false);
        
        // 异步刷新数据以确保与服务器同步
        const refreshData = async () => {
          try {
        if (viewMode === 'instance' && currentWeekInstance) {
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          await refreshSchedulesQuietly();
        }
          } catch (error) {
            console.error('异步刷新数据失败:', error);
          }
        };
        
        // 延迟执行异步刷新
        setTimeout(refreshData, 200);
        
        message.success('添加成功');
      } else {
        message.error(resp.message || '添加失败');
      }
    } catch (err) {
      message.error('网络错误，添加失败');
    } finally {
      setAddLoading(false);
    }
  };


  const renderEmptyCell = (day, timeIndex) => {
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const cellKey = `${pagePrefix}-${day.key}-${timeIndex}`;
    const isSelected = selectedCells.has(cellKey);

    if (timetable?.isArchived) {
      return <div style={{ height: '48px' }} />;
    }

    const handleCellClick = (e) => {
      if (multiSelectMode) {
        e.stopPropagation();
        handleCellSelection(cellKey, weekDays.findIndex(d => d.key === day.key), timeIndex);
      } else if (moveMode) {
        e.stopPropagation();
        handleSelectMoveTarget(day.key, timeIndex);
      } else if (copyMode) {
        e.stopPropagation();
        handleSelectCopyTarget(day.key, timeIndex);
      } else if (swapMode) {
        e.stopPropagation();
        // 在调换模式下，需要点击有内容的单元格
        const schedule = getScheduleForCell(day.key, timeIndex);
        if (schedule && schedule.id !== scheduleToSwap?.id) {
          handleSelectSwapTarget(schedule);
        }
      }
    };

    if (multiSelectMode || moveMode || copyMode || swapMode) {
       // ... existing multi-select/move/copy rendering logic ...
       // This part is simplified for brevity. The original logic remains.
       return (
        <div
          style={{
            height: '48px',
            cursor: 'pointer',
            backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
            border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0',
          }}
          onClick={handleCellClick}
        />
      );
    }
    
    const popoverKey = `popover-${day.key}-${timeIndex}`;

    const popoverContent = (
      <div style={{ width: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
          <span>{timeSlots[timeIndex]}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>半小时</span>
            <Switch
              size="small"
              checked={newScheduleInfo.isHalfHour}
              onChange={(checked) => setNewScheduleInfo({ ...newScheduleInfo, isHalfHour: checked })}
              disabled={addLoading}
            />
          </div>
        </div>
        <AutoComplete
          ref={addScheduleInputRef}
          placeholder="学生姓名"
          value={newScheduleInfo.studentName}
          onChange={(value) => setNewScheduleInfo({ ...newScheduleInfo, studentName: value })}
          onSearch={(value) => {
            // 可以在这里实现搜索逻辑，目前使用默认的过滤
          }}
          options={studentOptions}
          onPressEnter={() => handleAddSchedule(day.key, timeIndex, newScheduleInfo)}
          style={{ marginBottom: '8px' }}
          disabled={addLoading}
          filterOption={(inputValue, option) =>
            option.value.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
          }
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <Button 
            size="small" 
            onClick={() => handleBlockTime(day.key, timeIndex, newScheduleInfo)}
            loading={addLoading}
            disabled={addLoading}
            style={{ backgroundColor: '#f5f5f5', borderColor: '#d9d9d9' }}
          >
            占用
          </Button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="small" onClick={() => handlePopoverVisibleChange(popoverKey, false)} disabled={addLoading}>
              取消
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => handleAddSchedule(day.key, timeIndex, newScheduleInfo)}
              loading={addLoading}
              disabled={addLoading}
            >
              添加
            </Button>
          </div>
        </div>
      </div>
    );

    return (
      <Popover
        content={popoverContent}
        title="添加新课程"
        trigger="click"
        open={popoverVisible[popoverKey]}
        onOpenChange={(visible) => {
          handlePopoverVisibleChange(popoverKey, visible);
          if (visible) {
            setTimeout(() => {
              addScheduleInputRef.current?.focus();
            }, 100);
          }
        }}
                          styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                      overlayStyle={{ maxWidth: '90vw' }}
      >
        <div style={{ height: '48px', cursor: 'pointer' }} />
      </Popover>
    );
  };
  // 兼容移动端的复制函数
  const copyToClipboard = async (text) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        message.success('已复制到剪贴板');
        return;
      }

      // 移动端兼容方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // 在移动端，需要先聚焦再选择
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);

      // 尝试复制
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        message.success('已复制到剪贴板');
      } else {
        throw new Error('复制失败');
      }
    } catch (error) {
      // 如果所有方法都失败，提示用户手动复制
      message.warning('复制失败，请长按选择文本手动复制');
      console.error('复制失败:', error);
    }
  };

  // 时间段定义
  const timeSlots = [
    '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '13:00-14:00', '14:00-15:00',
    '15:00-16:00', '16:00-17:00', '17:00-18:00',
    '18:00-19:00', '19:00-20:00'
  ];

  // 星期定义
  const weekDays = [
    { key: 'monday', label: '周一' },
    { key: 'tuesday', label: '周二' },
    { key: 'wednesday', label: '周三' },
    { key: 'thursday', label: '周四' },
    { key: 'friday', label: '周五' },
    { key: 'saturday', label: '周六' },
    { key: 'sunday', label: '周日' },
  ];

  // Swipe handling
  const touchStartRef = React.useRef(null);

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const delta = touchEndX - touchStartRef.current;
    const threshold = 50; // px
    if (Math.abs(delta) > threshold) {
      if (delta < 0 && currentWeek < totalWeeks) {
        setCurrentWeek(currentWeek + 1);
      } else if (delta > 0 && currentWeek > 1) {
        setCurrentWeek(currentWeek - 1);
      }
    }
    touchStartRef.current = null;
  };

  // 根据当前实例起始日期动态显示周标签
  const instanceWeekLabel = useMemo(() => {
    // 优先使用当前实例
    if (viewMode === 'instance' && currentWeekInstance?.weekStartDate) {
      const start = dayjs(currentWeekInstance.weekStartDate).startOf('day');
      const thisMonday = dayjs().startOf('week');
      if (start.isSame(thisMonday, 'day')) return '本周';
      if (start.isSame(thisMonday.add(1, 'week'), 'day')) return '下周';
      // 其它周：按"MMDD"显示（例：0901）
      return start.format('MMDD');
    }
    
    // 在template模式下，使用保存的实例状态
    if (viewMode === 'template' && savedInstanceRef.current?.instance?.weekStartDate) {
      const start = dayjs(savedInstanceRef.current.instance.weekStartDate).startOf('day');
      const thisMonday = dayjs().startOf('week');
      if (start.isSame(thisMonday, 'day')) return '本周';
      if (start.isSame(thisMonday.add(1, 'week'), 'day')) return '下周';
      return start.format('MMDD');
    }
    
    // 如果没有当前实例，显示最近一周实例的标签
    if (weeklyInstances.length > 0) {
      const latestInstance = weeklyInstances[weeklyInstances.length - 1];
      const start = dayjs(latestInstance.weekStartDate).startOf('day');
      const thisMonday = dayjs().startOf('week');
      if (start.isSame(thisMonday, 'day')) return '本周';
      if (start.isSame(thisMonday.add(1, 'week'), 'day')) return '下周';
      return start.format('MMDD');
    }
    
    return '本周';
  }, [viewMode, currentWeekInstance, weeklyInstances]);

  const handleShowDayCourses = async (day, dayIndex) => {
    let schedulesForDay = [];
    let modalTitle = '';
    let targetDate = null;

    if (timetable.isWeekly) {
      // 对于周固定课表，根据当前视图模式决定显示内容
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图且有当前周实例：显示实例中的课程，使用实例的周开始日期
        const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
        targetDate = instanceStartDate.add(dayIndex, 'day');
        const dateStr = targetDate.format('YYYY-MM-DD');
        
        // 获取包含请假课程的完整数据
        try {
          const response = await getCurrentWeekInstanceIncludingLeaves(timetable.id);
          if (response && response.success && response.data && response.data.schedules) {
            schedulesForDay = response.data.schedules.filter(s => s.scheduleDate === dateStr);
          } else {
            schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
          }
        } catch (error) {
          console.error('获取包含请假课程的数据失败:', error);
          schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
        }
        
        // 如果还是没有数据，再次尝试从allSchedules获取
        if (schedulesForDay.length === 0) {
          schedulesForDay = allSchedules.filter(s => {
            return s.scheduleDate === dateStr;
          });
        }
        
        modalTitle = `${timetable.name} - ${dateStr} (${day.label})`;
      } else {
        // 模板视图或没有当前周实例：显示固定课表模板的课程
        schedulesForDay = allSchedules.filter(s => s.dayOfWeek.toLowerCase() === day.key);
        modalTitle = `${timetable.name} - ${day.label}`;
        // 对于周固定课表，计算本周对应的日期
        const today = dayjs();
        const currentWeekStart = today.startOf('week');
        targetDate = currentWeekStart.add(dayIndex, 'day');
      }
    } else {
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        targetDate = weekDates.start.add(dayIndex, 'day');
        const dateStr = targetDate.format('YYYY-MM-DD');
        schedulesForDay = allSchedules.filter(s => s.scheduleDate === dateStr);
        modalTitle = `${timetable.name} - ${dateStr} (${day.label})`;
      }
    }

    const sortedSchedules = schedulesForDay.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 过滤掉占用时间段，只保留真正的课程
    const validSchedules = sortedSchedules.filter(s => !s.isTimeBlock);
    
    if (validSchedules.length === 0) {
      const dateText = targetDate ? targetDate.format('YYYY-MM-DD') : '该天';
      message.info(`${dateText}没有课程`);
      return;
    }

    const studentColorMapForDay = new Map(studentColorMap);
    sortedSchedules.forEach(s => {
      if (s.studentName && !studentColorMapForDay.has(s.studentName)) {
        studentColorMapForDay.set(s.studentName, colorPalette[studentColorMapForDay.size % colorPalette.length]);
      }
    });

    const firstScheduleHour = parseInt(sortedSchedules[0].startTime.substring(0, 2));
    const timeSlotsForDay = [];
    for (let hour = firstScheduleHour; hour <= 19; hour++) {
      timeSlotsForDay.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        displayTime: `${hour}-${hour + 1}`,
        hourStart: hour
      });
    }

    const tableData = timeSlotsForDay.map((slot, index) => {
      // 查找在这个小时内开始的所有课程（包括整点和半点）
      const schedulesInHour = sortedSchedules.filter(s => {
        const scheduleHour = parseInt(s.startTime.substring(0, 2));
        return scheduleHour === slot.hourStart;
      });
      
      // 如果有多个课程，显示时间信息；如果只有一个，像之前一样显示
      let displayText = '';
      if (schedulesInHour.length === 0) {
        displayText = '';
      } else if (schedulesInHour.length === 1) {
        const s = schedulesInHour[0];
        if (s.startTime.substring(0, 5) !== slot.time) {
          // 格式化时间：16:30 -> 16.30, 17:00 -> 17
          const startHour = s.startTime.substring(0, 2);
          const startMin = s.startTime.substring(3, 5);
          const endHour = s.endTime.substring(0, 2);
          const endMin = s.endTime.substring(3, 5);
          
          const startTimeStr = startMin === '00' ? startHour : `${startHour}.${startMin}`;
          const endTimeStr = endMin === '00' ? endHour : `${endHour}.${endMin}`;
          
          displayText = `${startTimeStr}-${endTimeStr} ${s.isOnLeave ? `${s.studentName}（请假）` : s.studentName}`;
        } else {
          displayText = s.isOnLeave ? `${s.studentName}（请假）` : s.studentName;
        }
      } else {
        // 多个课程，每个都显示完整时间
        displayText = schedulesInHour.map(s => {
          const startHour = s.startTime.substring(0, 2);
          const startMin = s.startTime.substring(3, 5);
          const endHour = s.endTime.substring(0, 2);
          const endMin = s.endTime.substring(3, 5);
          
          const startTimeStr = startMin === '00' ? startHour : `${startHour}.${startMin}`;
          const endTimeStr = endMin === '00' ? endHour : `${endHour}.${endMin}`;
          
          return `${startTimeStr}-${endTimeStr} ${s.isOnLeave ? `${s.studentName}（请假）` : s.studentName}`;
        }).join(' / ');
      }
      
      return {
        key: index,
        time: slot.displayTime,
        studentName: displayText,
        schedule: schedulesInHour[0] || null,
      };
    });

    setDayScheduleData(tableData);
    setDayScheduleTitle(modalTitle);
    setDaySchedulesForCopy(sortedSchedules);
    setCurrentDayDate(targetDate);
    setCurrentDayLabel(day.label);
    setDayScheduleModalVisible(true);

    // 默认获取其他教练课程数据
    if (targetDate) {
      setLoadingOtherCoachesInModal(true);
      const targetDateStr = targetDate.format('YYYY-MM-DD');
      
      // 清除该日期的缓存，确保获取最新数据（包含ownerRole字段）
      clearByDateCache(targetDateStr);
      clearActiveSchedulesCache(targetDateStr);
      
      // 优先使用普通用户可访问的API
      getInstanceSchedulesByDate(targetDateStr)
        .then(response => {
          if (response.success) {
            // 转换数据格式以匹配原有结构
            const convertedData = {
              date: targetDateStr,
              timetables: response.data.timetableSchedules || []
            };
            if (convertedData.timetables) {
              convertedData.timetables.forEach(timetable => {
                if (timetable.schedules) {
                  timetable.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
                }
              });
            }
            setOtherCoachesDataInModal(convertedData);
          }
        })
        .catch(error => {
          console.error('获取其他教练课程失败，尝试管理员API:', error);
          // 如果普通用户API失败，尝试管理员API（管理员用户）
          getActiveSchedulesByDateMerged(targetDateStr)
            .then(response => {
              if (response.success) {
                if (response.data && response.data.timetables) {
                  response.data.timetables.forEach(timetable => {
                    if (timetable.schedules) {
                      timetable.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
                    }
                  });
                }
                setOtherCoachesDataInModal(response.data);
              }
            })
            .catch(adminError => {
              console.error('获取其他教练课程失败:', adminError);
            });
        })
        .finally(() => {
          setLoadingOtherCoachesInModal(false);
        });
    }
  };

  // 处理日程弹框中复选框变化
  const handleCopyOtherCoachesInModalChange = async (checked) => {
    setCopyOtherCoachesInModal(checked);
    // 不清空数据，只改变复制时是否包含的状态
    // 如果取消勾选，不需要重新获取数据，因为数据已经在弹框打开时获取了
  };

  // 合并连续时间段的函数（用于复制功能）
  const mergeConsecutiveTimeSlotsForCopy = (schedules) => {
    if (!schedules || schedules.length === 0) return [];
    
    // 按学员名称分组（去除空格等字符进行标准化）
    const groupedByStudent = {};
    schedules.forEach(s => {
      const studentName = String(s.studentName || '').replace(/[\s\u3000]/g, '');
      if (!groupedByStudent[studentName]) {
        groupedByStudent[studentName] = [];
      }
      groupedByStudent[studentName].push(s);
    });
    
    const mergedSchedules = [];
    
    // 对每个学员的课程进行时间段合并
    Object.entries(groupedByStudent).forEach(([studentName, studentSchedules]) => {
      // 按开始时间排序
      const sorted = studentSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      let i = 0;
      while (i < sorted.length) {
        let currentSchedule = sorted[i];
        let currentStartHour = parseInt(currentSchedule.startTime.substring(0, 2));
        let currentStartMinute = parseInt(currentSchedule.startTime.substring(3, 5));
        let currentEndHour = parseInt(currentSchedule.endTime.substring(0, 2));
        let currentEndMinute = parseInt(currentSchedule.endTime.substring(3, 5));
        
        // 查找连续的时间段
        let j = i + 1;
        while (j < sorted.length) {
          const nextSchedule = sorted[j];
          const nextStartHour = parseInt(nextSchedule.startTime.substring(0, 2));
          const nextStartMinute = parseInt(nextSchedule.startTime.substring(3, 5));
          const nextEndHour = parseInt(nextSchedule.endTime.substring(0, 2));
          const nextEndMinute = parseInt(nextSchedule.endTime.substring(3, 5));
          
          // 检查当前结束时间是否等于下一个开始时间（连续）
          if (currentEndHour === nextStartHour && currentEndMinute === nextStartMinute) {
            currentEndHour = nextEndHour;
            currentEndMinute = nextEndMinute;
            j++;
          } else {
            break;
          }
        }
        
        // 创建合并后的课程记录
        mergedSchedules.push({
          ...currentSchedule,
          endTime: `${currentEndHour.toString().padStart(2, '0')}:${currentEndMinute.toString().padStart(2, '0')}:00`,
          originalCount: j - i // 记录合并了多少个时间段
        });
        
        i = j;
      }
    });
    
    return mergedSchedules;
  };

  const generateCopyTextForDay = (schedules, targetDate, dayLabel, includeOtherCoaches = false, otherCoachesData = null) => {
    // 过滤掉占用时间段
    const validSchedules = schedules ? schedules.filter(s => !s.isTimeBlock) : [];
    
    if (!validSchedules || validSchedules.length === 0) return '没有可复制的课程';
    
    // 格式化日期为：2025年07月14日
    let formattedDate = '';
    if (targetDate) {
      formattedDate = targetDate.format('YYYY年MM月DD日');
    }
    
    // 获取教练名称
    const coachName = timetableOwner?.nickname || timetableOwner?.username || '教练';
    
    // 构建标题
    const title = formattedDate ? `${formattedDate} ${dayLabel}课程安排` : `${dayLabel}课程安排`;
    
    // 合并连续时间段
    const mergedSchedules = mergeConsecutiveTimeSlotsForCopy(validSchedules);
    
    // 构建当前教练的课程列表
    const courseList = mergedSchedules
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(schedule => {
        // 格式化开始时间
        const startTime = schedule.startTime.substring(0, 5); // HH:mm
        const startHour = parseInt(startTime.substring(0, 2));
        const startMinute = startTime.substring(3, 5);
        
        // 格式化结束时间
        let endTimeStr;
        if (schedule.endTime) {
          const endTime = schedule.endTime.substring(0, 5); // HH:mm
          const endHour = parseInt(endTime.substring(0, 2));
          const endMinute = endTime.substring(3, 5);
          
          // 如果结束时间是整点（:00），只显示小时；否则显示完整时间
          if (endMinute === '00') {
            endTimeStr = endHour.toString();
          } else {
            endTimeStr = `${endHour}:${endMinute}`;
          }
        } else {
          endTimeStr = (startHour + 1).toString();
        }
        
        // 如果开始时间是整点（:00），只显示小时；否则显示完整时间
        let startTimeStr;
        if (startMinute === '00') {
          startTimeStr = startHour.toString();
        } else {
          startTimeStr = `${startHour}:${startMinute}`;
        }
        
        const studentName = schedule.isOnLeave ? `${schedule.studentName}（请假）` : schedule.studentName;
        return `${startTimeStr}-${endTimeStr} ${studentName}`;
      }).join('\n');

    let result = `${title}\n${coachName}：\n${courseList}`;

    // 如果需要包含其他教练的课程
    if (includeOtherCoaches && otherCoachesData && otherCoachesData.timetables && otherCoachesData.timetables.length > 0) {
      otherCoachesData.timetables.forEach(timetableInfo => {
        // 跳过当前教练的课表
        if (timetableInfo.timetableId.toString() === timetableId) {
          return;
        }
        
        // 始终跳过管理员的课程（不管谁登录）
        if (timetableInfo.ownerRole === 'ADMIN') {
          return;
        }

        result += `\n${timetableInfo.ownerName}：`;
        
        // 合并其他教练的连续时间段
        const mergedOtherSchedules = mergeConsecutiveTimeSlotsForCopy(timetableInfo.schedules);
        
        const otherCourseList = mergedOtherSchedules
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map(schedule => {
            // 格式化开始时间
            const startTime = schedule.startTime.substring(0, 5); // HH:mm
            const startHour = parseInt(startTime.substring(0, 2));
            const startMinute = startTime.substring(3, 5);
            
            // 格式化结束时间
            let endTimeStr;
            if (schedule.endTime) {
              const endTime = schedule.endTime.substring(0, 5); // HH:mm
              const endHour = parseInt(endTime.substring(0, 2));
              const endMinute = endTime.substring(3, 5);
              
              // 如果结束时间是整点（:00），只显示小时；否则显示完整时间
              if (endMinute === '00') {
                endTimeStr = endHour.toString();
              } else {
                endTimeStr = `${endHour}:${endMinute}`;
              }
            } else {
              endTimeStr = (startHour + 1).toString();
            }
            
            // 如果开始时间是整点（:00），只显示小时；否则显示完整时间
            let startTimeStr;
            if (startMinute === '00') {
              startTimeStr = startHour.toString();
            } else {
              startTimeStr = `${startHour}:${startMinute}`;
            }
            
            const studentName = schedule.isOnLeave ? `${schedule.studentName}（请假）` : schedule.studentName;
            return `${startTimeStr}-${endTimeStr} ${studentName}`;
          }).join('\n');
        result += `\n${otherCourseList}`;
      });
    }

    return result;
  };



  useEffect(() => {
    // 保存当前课表ID和访问时间
    sessionStorage.setItem('last_viewed_timetable_id', String(timetableId));
    sessionStorage.setItem('last_view_timetable_time', String(Date.now()));
    fetchTimetable();
  }, [timetableId]);

  // 获取学员列表用于自动完成
  useEffect(() => {
    if (timetableOwner) {
      fetchStudentOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetableOwner]);

  // 移除自动触发的useEffect，改为按钮点击时手动调用
  // 这样避免了无限循环调用API的问题

  // 当获取到每周实例列表后，自动切换到本周实例（仅在用户操作后触发，不在初始加载时触发）
  useEffect(() => {
    if (weeklyInstances.length > 0 && viewMode === 'instance' && currentInstanceIndex === 0 && !loading) {
      // 检查是否应该切换到本周实例
      const today = dayjs();
      // 如果今天是周日，仍然属于当前周，不是下一周
      const thisWeekStart = today.startOf('week'); // 周一
      const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
      
      const thisWeekIndex = weeklyInstances.findIndex(inst => {
        const start = dayjs(inst.weekStartDate);
        const end = dayjs(inst.weekEndDate);
        return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
      });
      
      // 如果找到本周实例且当前不是本周实例，则自动切换
      if (thisWeekIndex >= 0 && thisWeekIndex !== currentInstanceIndex) {
        switchToWeekInstanceByIndex(thisWeekIndex);
      }
    }
  }, [weeklyInstances, viewMode, loading]); // 添加loading依赖，避免初始加载时触发
  
  // 当实例列表变化时，更新显示范围
  useEffect(() => {
    if (weeklyInstances.length > 0) {
      updateDisplayRange(currentInstanceIndex, weeklyInstances);
    }
  }, [weeklyInstances, currentInstanceIndex]);

  // 注释掉旧的fetchTemplateSchedules调用，避免重复请求
  // useEffect(() => {
  //   if (timetable && viewMode === 'template' && !timetable.isWeekly && currentWeek) {
  //     fetchTemplateSchedules();
  //   }
  // }, [currentWeek]);

  // 删除旧的 viewMode 监听，避免与新的统一视图切换逻辑重复
  // useEffect(() => {
  //   if (!timetable || loading) return;
  //   if (viewMode === 'instance' && timetable.isWeekly) {
  //     fetchWeekInstanceSchedules();
  //   } else if (viewMode === 'template') {
  //     if (templateSchedules.length > 0) {
  //       setAllSchedules(templateSchedules);
  //     }
  //   } else if (viewMode === 'today') {
  //     fetchTodaySchedules();
  //   } else if (viewMode === 'tomorrow') {
  //     fetchTomorrowSchedules();
  //   }
  // }, [viewMode, timetable, loading]);

  const fetchTimetable = async () => {
    // 检查缓存，如果是最近访问的同一课表，不显示loading
    const lastTimetableId = sessionStorage.getItem('last_viewed_timetable_id');
    const lastViewTime = sessionStorage.getItem('last_view_timetable_time');
    const now = Date.now();
    const isRecentSameTimetable = lastTimetableId === String(timetableId) && 
                                  lastViewTime && 
                                  (now - parseInt(lastViewTime)) < 5 * 60 * 1000;
    
    if (!isRecentSameTimetable) {
      setLoading(true);
    }
    
    try {
      const response = await getTimetable(timetableId);
      if (response.success) {
        const { timetable: timetableData, owner } = response.data;
        
        // For weekly timetables, initialize and determine view mode
        // 默认展示：周固定 -> 本周；日期范围 -> 固定
        if (timetableData.isWeekly && !timetableData.startDate && !timetableData.endDate) {
          // 一次性获取所有需要的数据，避免多次状态更新导致闪烁
          const [templateResponse, instancesResponse, currentWeekResponse] = await Promise.all([
            getTemplateSchedules(timetableId),
            getWeeklyInstances(timetableId),
            getCurrentWeekInstance(timetableId)
          ]);
          
          let finalViewMode = 'template';
          let finalSchedules = [];
          let finalWeeklyInstances = [];
          let finalTemplateSchedules = [];
          let finalCurrentWeekInstance = null;
          let finalCurrentInstanceIndex = 0;
          
          // 处理模板数据
          if (templateResponse && templateResponse.success) {
            finalTemplateSchedules = templateResponse.data || [];
          }
          
          // 处理周实例列表
          if (instancesResponse && instancesResponse.success && Array.isArray(instancesResponse.data)) {
            const sortedInstances = instancesResponse.data.sort((a, b) => 
              dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
            );
            finalWeeklyInstances = sortedInstances;
            
            // 处理当前周实例
            if (currentWeekResponse && currentWeekResponse.success && currentWeekResponse.data?.hasInstance) {
              const instance = currentWeekResponse.data.instance;
              const schedules = currentWeekResponse.data.schedules || [];
              
              // 找到当前实例在列表中的索引
              const targetIndex = sortedInstances.findIndex(inst => inst.id === instance.id);
              const finalIndex = targetIndex >= 0 ? targetIndex : sortedInstances.length - 1;
              
              finalViewMode = 'instance';
              finalCurrentWeekInstance = instance;
              finalSchedules = schedules;
              finalCurrentInstanceIndex = finalIndex;
            } else {
              // 没有当前周实例，尝试生成
              const newCurrentWeekResponse = await ensureWeekInstanceExists();
              if (newCurrentWeekResponse && newCurrentWeekResponse.success && newCurrentWeekResponse.data?.hasInstance) {
                const instance = newCurrentWeekResponse.data.instance;
                const schedules = newCurrentWeekResponse.data.schedules || [];
                
                const targetIndex = sortedInstances.findIndex(inst => inst.id === instance.id);
                const finalIndex = targetIndex >= 0 ? targetIndex : sortedInstances.length - 1;
                
                finalViewMode = 'instance';
                finalCurrentWeekInstance = instance;
                finalSchedules = schedules;
                finalCurrentInstanceIndex = finalIndex;
              } else if (sortedInstances.length > 0) {
                // 如果生成失败但有其他实例，加载最近一周实例（最后一个）
                const latestInstance = sortedInstances[sortedInstances.length - 1];
                const latestSchedulesResponse = await getInstanceSchedules(latestInstance.id);
                
                finalViewMode = 'instance';
                finalCurrentWeekInstance = latestInstance;
                finalSchedules = latestSchedulesResponse.success ? (latestSchedulesResponse.data || []) : [];
                finalCurrentInstanceIndex = sortedInstances.length - 1;
              }
            }
          }
          
          // 批量更新所有数据状态
          setTimetable(timetableData);
          setTimetableOwner(owner);
          setTemplateSchedules(finalTemplateSchedules);
          setWeeklyInstances(finalWeeklyInstances);
          setViewMode(finalViewMode);
          setCurrentWeekInstance(finalCurrentWeekInstance);
          setAllSchedules(finalSchedules);
          setCurrentInstanceIndex(finalCurrentInstanceIndex);
          
          // 使用 requestAnimationFrame 确保浏览器完成本次渲染后再关闭loading
          // 双重 RAF 确保 DOM 已完全绘制
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setLoading(false);
            });
          });
          
          return; // 提前返回，避免执行后续的setLoading(false)
        } else {
          setViewMode('template');
          
          // 处理日期范围的周数计算，必须在获取课表数据之前计算好
          let finalCurrentWeek = 1;
          let finalTotalWeeks = 1;
          if (!timetableData.isWeekly && timetableData.startDate && timetableData.endDate) {
            const start = dayjs(timetableData.startDate);
            const end = dayjs(timetableData.endDate);
            const today = dayjs();

            // 找到起始日期所在周的周一（与后端逻辑一致）
            const anchorMonday = start.startOf('week');

            // 计算总周数
            const totalDays = end.diff(anchorMonday, 'day') + 1;
            const weeks = Math.ceil(totalDays / 7);
            finalTotalWeeks = weeks > 0 ? weeks : 1;

            // 计算当前应该显示的周数
            // 检查今天是否在课表日期范围内
            if (today.isSameOrAfter(start) && today.isSameOrBefore(end)) {
              // 计算今天是第几周
              const daysSinceAnchor = today.diff(anchorMonday, 'day');
              const weekNumber = Math.floor(daysSinceAnchor / 7) + 1;

              // 确保周数在有效范围内
              if (weekNumber >= 1 && weekNumber <= weeks) {
                finalCurrentWeek = weekNumber;
              }
            }
          }
          
          // 对于日期范围课表，使用计算出的周数获取对应周的数据
          const tpl = !timetableData.isWeekly 
            ? await getTimetableSchedules(timetableId, finalCurrentWeek)
            : await getTemplateSchedules(timetableId);
          const finalSchedules = (tpl && tpl.success) ? (tpl.data || []) : [];
          
          // 批量更新状态，确保currentWeek在allSchedules之前或同时设置
          setTimetable(timetableData);
          setTimetableOwner(owner);
          setTotalWeeks(finalTotalWeeks);
          setCurrentWeek(finalCurrentWeek);
          setAllSchedules(finalSchedules);
          
          // 使用 requestAnimationFrame 确保浏览器完成本次渲染后再关闭loading
          // 双重 RAF 确保 DOM 已完全绘制
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setLoading(false);
            });
          });
          
          return; // 提前返回
        }
      } else {
        message.error(response.message || '获取课表失败');
        setLoading(false);
        navigate('/dashboard');
      }
    } catch (error) {
      message.error('获取课表失败，请检查网络连接');
      setLoading(false);
      navigate('/dashboard');
    }
  };

  // 1. 获取固定课表模板数据（每区块一次）
  const fetchTemplateSchedules = async (requestId) => {
    const currentId = requestId ?? latestRequestIdRef.current;
    // 修复：使用正确的API直接获取指定课表的模板数据，而不是从admin接口获取所有数据再过滤
    const response = await getTemplateSchedules(timetableId);
    if (response && response.success) {
      // 只有当本次请求仍是最新时才更新UI，避免切换过程中数据错乱
      if (latestRequestIdRef.current === currentId) {
        setAllSchedules(response.data || []);
        setTemplateSchedules(response.data || []);
      }
    }
  };

  // 统一的生成周实例函数，防止并发调用
  const ensureWeekInstanceExists = async () => {
    // 如果已经在生成中，直接返回
    if (generatingRef.current) {
      console.log('周实例生成中，跳过重复请求');
      return null;
    }
    
    try {
      generatingRef.current = true;
      setIsGenerating(true);
      
      const gen = await generateCurrentWeekInstance(timetableId);
      if (gen && gen.success) {
        const resp = await getCurrentWeekInstance(timetableId);
        return resp;
      }
      return gen;
    } catch (error) {
      console.error('生成周实例失败:', error);
      return null;
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  // 2. 获取今日课程数据（每区块一次）
  const fetchTodaySchedules = async () => {
    // 周固定课表：必须从实例获取
    if (timetable?.isWeekly) {
      let resp = await getCurrentWeekInstance(timetableId);
      if (!(resp && resp.success && resp.data?.hasInstance)) {
        resp = await ensureWeekInstanceExists();
      }
      if (resp && resp.success && resp.data?.hasInstance) {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const list = (resp.data.schedules || []).filter(s => s.scheduleDate === todayStr);
        setCurrentWeekInstance(resp.data.instance);
        setAllSchedules(list);
        return;
      }
      setAllSchedules([]);
      return;
    }
    // 日期范围课表：用按日接口
    const response = await getTodaySchedulesOnce(timetableId);
    if (response && response.success) setAllSchedules(response.data || []);
  };

  // 3. 获取明日课程数据（每区块一次）
  const fetchTomorrowSchedules = async () => {
    if (timetable?.isWeekly) {
      let resp = await getCurrentWeekInstance(timetableId);
      if (!(resp && resp.success && resp.data?.hasInstance)) {
        resp = await ensureWeekInstanceExists();
      }
      if (resp && resp.success && resp.data?.hasInstance) {
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const list = (resp.data.schedules || []).filter(s => s.scheduleDate === tomorrowStr);
        setCurrentWeekInstance(resp.data.instance);
        setAllSchedules(list);
        return;
      }
      setAllSchedules([]);
      return;
    }
    const response = await getTomorrowSchedulesOnce(timetableId);
    if (response && response.success) setAllSchedules(response.data || []);
  };

  // 4. 获取本周数据（每区块一次）- 统一走聚合接口
  const fetchWeekInstanceSchedules = async (requestId) => {
    // 同时获取本周实例数据和模板数据
    const [instanceResponse, templateResponse] = await Promise.all([
      getThisWeekSchedulesSessionOnce(timetableId),
      getTemplateSchedules(timetableId)
    ]);
    
    if (instanceResponse && instanceResponse.success) {
      if (latestRequestIdRef.current === (requestId ?? latestRequestIdRef.current)) {
        setAllSchedules(instanceResponse.data || []);
        
        // 同时更新模板数据
        if (templateResponse && templateResponse.success) {
          setTemplateSchedules(templateResponse.data || []);
        }
      }
    } else {
      setAllSchedules([]);
      
      // 即使实例数据获取失败，也要尝试设置模板数据
      if (templateResponse && templateResponse.success) {
        setTemplateSchedules(templateResponse.data || []);
      }
    }
  };



  // 移除initializeWeeklyInstance函数，避免重复调用
  // 获取当前周实例的课程
  const fetchInstanceSchedules = async () => {
    
    // 防止重复调用
    if (instanceDataLoading || isGenerating) {
      return;
    }
    
    setInstanceDataLoading(true);
    try {
      // 如果是周固定课表且还没有模板数据，先获取模板数据用于比较
      if (timetable && timetable.isWeekly && templateSchedules.length === 0) {
        const templateResponse = await getTemplateSchedules(timetableId);
        if (templateResponse.success) {
          setTemplateSchedules(templateResponse.data);
        }
      }

      // 先检查是否有当前周实例
      const checkResponse = await checkCurrentWeekInstance(timetableId);
      if (checkResponse.success) {
        const hasInstance = checkResponse.data.hasCurrentWeekInstance;
        
        if (hasInstance) {
          // 有实例，获取实例数据
          const response = await getCurrentWeekInstance(timetableId);
          
          if (response.success && response.data.hasInstance) {
            setCurrentWeekInstance(response.data.instance);
            setAllSchedules(response.data.schedules);
            setHasCurrentWeekInstance(true);
          } else {
            setCurrentWeekInstance(null);
            setAllSchedules([]);
            setHasCurrentWeekInstance(false);
          }
        } else {
          // 没有实例，生成一个
          const instanceResponse = await ensureWeekInstanceExists();
          if (instanceResponse && instanceResponse.success && instanceResponse.data.hasInstance) {
            setCurrentWeekInstance(instanceResponse.data.instance);
            setAllSchedules(instanceResponse.data.schedules);
            setHasCurrentWeekInstance(true);
          } else {
            setCurrentWeekInstance(null);
            setAllSchedules([]);
            setHasCurrentWeekInstance(false);
            if (instanceResponse !== null) { // 如果不是因为正在生成而跳过的
              message.error('生成当前周实例失败');
            }
          }
        }
      } else {
        setCurrentWeekInstance(null);
        setAllSchedules([]);
        setHasCurrentWeekInstance(false);
      }
    } catch (error) {
      console.error('获取当前周实例失败:', error);
      message.error('获取当前周实例失败，请检查网络连接');
      setCurrentWeekInstance(null);
      setAllSchedules([]);
      setHasCurrentWeekInstance(false);
    } finally {
      setInstanceDataLoading(false);
    }
  };

  // 删除旧的 switchToInstanceView 方法，避免重复调用 fetchWeeklyInstances
  // 现在统一使用 handleThisWeekClick 方法

  // 获取每周实例列表
  const fetchWeeklyInstances = async () => {
    // 仅依赖timetableId，避免因timetable状态尚未set而提前return
    if (!timetableId) return;
    
    setInstancesLoading(true);
    try {
      const response = await getWeeklyInstances(timetableId);
      if (response.success && Array.isArray(response.data)) {
        // 按周开始日期排序
        const sortedInstances = response.data.sort((a, b) => 
          dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
        );
        setWeeklyInstances(sortedInstances);
        
        // 总是更新索引，确保状态一致性
        // 优先找到当前周实例的索引
        if (currentWeekInstance?.id) {
          const currentIndex = sortedInstances.findIndex(inst => inst.id === currentWeekInstance.id);
          if (currentIndex >= 0) {
            setCurrentInstanceIndex(currentIndex);
            return;
          }
        }
        
        // 如果没有当前周实例，尝试找到本周的实例
        const today = dayjs();
        // 与后端保持一致：周一为一周的开始，但周日仍属于当前周
        const thisWeekStart = today.startOf('week'); // 周一
        const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
        
        const thisWeekIndex = sortedInstances.findIndex(inst => {
          const start = dayjs(inst.weekStartDate);
          const end = dayjs(inst.weekEndDate);
          // 精确匹配：实例的周开始和结束日期与当前周一致
          return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
        });
        if (thisWeekIndex >= 0) {
          setCurrentInstanceIndex(thisWeekIndex);
        } else {
          // 如果找不到本周实例，默认选择最后一个（最新的）实例并加载数据
          const latestIndex = sortedInstances.length - 1;
          setCurrentInstanceIndex(latestIndex);
          
          // 加载最近实例的数据
          const latestInstance = sortedInstances[latestIndex];
          setCurrentWeekInstance(latestInstance);
          const latestSchedulesResponse = await getInstanceSchedules(latestInstance.id);
          if (latestSchedulesResponse.success) {
            setAllSchedules(latestSchedulesResponse.data || []);
          }
        }
      }
    } catch (error) {
      console.error('获取每周实例列表失败:', error);
    } finally {
      setInstancesLoading(false);
    }
  };

  // 切换到指定的周实例（允许传入最新的实例列表，避免异步状态滞后）
  const switchToWeekInstanceByIndex = async (instanceIndex, instancesOverride, forceSwitch = false) => {
    const list = Array.isArray(instancesOverride) ? instancesOverride : weeklyInstances;
    if (!Array.isArray(list) || instanceIndex < 0 || instanceIndex >= list.length) {
      // 重置loading状态
      setSwitchToInstanceLoading(false);
      setTempWeeklyStats(null);
      setTempViewMode(null);
      return;
    }
    
    const targetInstance = list[instanceIndex];
    
    // 如果点击的是当前选中的实例且当前已是实例视图，不做任何操作
    // forceSwitch为true时跳过此检查（从固定课表切换回来时需要强制切换）
    if (!forceSwitch && instanceIndex === currentInstanceIndex && viewMode === 'instance') {
      // 重置loading状态
      setSwitchToInstanceLoading(false);
      setTempWeeklyStats(null);
      setTempViewMode(null);
      return;
    }
    
    // 保存当前的统计信息，避免loading期间显示错误数据
    setTempWeeklyStats(weeklyStats);
    setTempViewMode('instance');
    setSwitchToInstanceLoading(true);
    
    setCurrentInstanceIndex(instanceIndex);
    updateDisplayRange(instanceIndex, list);
    setInstancesLoading(true);
    
    try {
      // 确保模板数据已加载（用于边框颜色比较）
      if (timetable && timetable.isWeekly && templateSchedules.length === 0) {
        const templateResponse = await getTemplateSchedules(timetableId);
        if (templateResponse.success) {
          setTemplateSchedules(templateResponse.data || []);
        }
      }
      
      // 获取指定周实例的课程数据
      const response = await getInstanceSchedules(targetInstance.id);
      if (response.success) {
        setCurrentWeekInstance({
          id: targetInstance.id,
          weekStartDate: targetInstance.weekStartDate,
          weekEndDate: targetInstance.weekEndDate,
          schedules: response.data || []
        });
        setAllSchedules(response.data || []);
        setViewMode('instance');
      } else {
        message.error('获取周实例数据失败');
      }
    } catch (error) {
      console.error('切换周实例失败:', error);
      message.error('切换周实例失败');
    } finally {
      setInstancesLoading(false);
      setSwitchToInstanceLoading(false);
      setTempWeeklyStats(null);
      setTempViewMode(null);
    }
  };

  // 按钮点击处理函数 - 直接调用对应API，避免useEffect循环
  const handleTodayClick = async () => {
    clearModes();
    setViewMode('today');
    await fetchTodaySchedules();
  };

  const handleTomorrowClick = async () => {
    clearModes();
    setViewMode('tomorrow');
    await fetchTomorrowSchedules();
  };

  // 切换到当前周实例的函数
  const switchToCurrentWeekInstance = async () => {
    
    // 确保有周实例列表
    if (weeklyInstances.length === 0) {
      await fetchWeeklyInstances();
    }
    
    // 重新获取更新后的周实例列表
    const instances = weeklyInstances.length > 0 ? weeklyInstances : await fetchWeeklyInstances() || [];
    
    // 计算本周的开始和结束日期
    const today = dayjs();
    // 如果今天是周日，仍然属于当前周，不是下一周
    const thisWeekStart = today.startOf('week'); // 周一
    const thisWeekEnd = thisWeekStart.add(6, 'day'); // 周日
    
    // 查找本周实例
    const thisWeekIndex = instances.findIndex(inst => {
      const start = dayjs(inst.weekStartDate);
      const end = dayjs(inst.weekEndDate);
      return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
    });
    
    if (thisWeekIndex >= 0) {
      await switchToWeekInstanceByIndex(thisWeekIndex);
    } else {
      // 尝试生成本周实例
      try {
        const generateResponse = await ensureWeekInstanceExists();
        if (generateResponse && generateResponse.success) {
          // 重新获取实例列表
          await fetchWeeklyInstances();
          // 再次查找本周实例
          const newThisWeekIndex = weeklyInstances.findIndex(inst => {
            const start = dayjs(inst.weekStartDate);
            const end = dayjs(inst.weekEndDate);
            return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
          });
          if (newThisWeekIndex >= 0) {
            await switchToWeekInstanceByIndex(newThisWeekIndex);
            return;
          }
        } else if (generateResponse && !generateResponse.success && generateResponse.message) {
          message.error(generateResponse.message);
          setSwitchToInstanceLoading(false);
          return;
        }
      } catch (error) {
        console.error('生成本周实例失败:', error);
      }
      
      // 如果还是找不到，设置为实例视图模式，但清空currentWeekInstance确保按钮显示"本周"
      setCurrentWeekInstance(null);
      setViewMode('instance');
    }
  };

  const handleThisWeekClick = async () => {
    clearModes();
    
    // 检查当前是否已经是本周实例
    if (viewMode === 'instance' && currentWeekInstance?.weekStartDate) {
      const today = dayjs();
      // 如果今天是周日，仍然属于当前周，不是下一周
      const thisWeekStart = today.startOf('week');
      const thisWeekEnd = thisWeekStart.add(6, 'day');
      const currentStart = dayjs(currentWeekInstance.weekStartDate);
      const currentEnd = dayjs(currentWeekInstance.weekEndDate);
      
      // 如果当前实例就是本周实例，不做任何操作
      if (currentStart.isSame(thisWeekStart, 'day') && currentEnd.isSame(thisWeekEnd, 'day')) {
        return;
      }
    }
    
    // 如果当前已经是实例视图，不做任何操作
    if (viewMode === 'instance') {
      return;
    }
    
    // 从固定课表切换回实例时
    if (viewMode === 'template') {
      setTempWeeklyStats(weeklyStats);
      setTempViewMode('instance');
      setSwitchToInstanceLoading(true);
      
      // 优先恢复之前保存的实例状态
      if (savedInstanceRef.current?.instance) {
        const { index } = savedInstanceRef.current;
        await switchToWeekInstanceByIndex(index, null, true); // forceSwitch=true
        savedInstanceRef.current = null;
        return;
      }
      
      // 如果是非活动课表，切换到最近的实例（最后一个）
      if (!timetable?.isActive && weeklyInstances.length > 0) {
        const latestIndex = weeklyInstances.length - 1;
        await switchToWeekInstanceByIndex(latestIndex, null, true); // forceSwitch=true
        return;
      }
      
      // 活动课表，尝试切换到本周实例
      await switchToCurrentWeekInstance();
      return;
    }
  };

  // 上方按钮点击处理函数 - 直接调用 handleThisWeekClick
  const handleTopButtonClick = handleThisWeekClick;

  const handleTemplateClick = async () => {
    clearModes();
    
    // 保存当前的统计信息，避免loading期间显示错误数据
    setTempWeeklyStats(weeklyStats);
    setTempViewMode('template');
    setSwitchToTemplateLoading(true);
    
    // 保存当前实例状态，切换回实例时恢复
    // 如果currentWeekInstance为空但有实例列表，使用当前索引对应的实例
    let savedInstance = currentWeekInstance;
    let savedIndex = currentInstanceIndex;
    
    if (!savedInstance && weeklyInstances.length > 0) {
      // 如果当前没有实例但有实例列表，使用最后一个（最近的）实例
      savedIndex = weeklyInstances.length - 1;
      savedInstance = weeklyInstances[savedIndex];
    }
    
    // 保存到ref用于后续恢复（每次都更新，确保保存最新状态）
    savedInstanceRef.current = { instance: savedInstance, index: savedIndex };
    
    // 直接设置视图模式，由统一的 useEffect 处理数据加载
    setViewMode('template');
  };

  // 清除多选和删除模式
  const clearModes = () => {
    if (multiSelectMode) {
      setMultiSelectMode(false);
      setSelectedCells(new Set());
    }
    if (deleteMode) {
      setDeleteMode(false);
      setSelectedSchedulesForDelete(new Set());
    }
    if (moveMode) {
      setMoveMode(false);
      setScheduleToMove(null);
      setSelectedMoveTarget(null);
    }
    if (copyMode) {
      setCopyMode(false);
      setScheduleToCopy(null);
      setSelectedCopyTargets(new Set());
    }
    if (swapMode) {
      setSwapMode(false);
      setScheduleToSwap(null);
      setSelectedSwapTarget(null);
    }
  };

  // 兼容旧函数名
  const switchToTemplateView = handleTemplateClick;

  // 比较固定课表和实例课程，确定边框颜色
  const getScheduleBorderColor = (instanceSchedule) => {
    if (!timetable || !timetable.isWeekly) {
      return ''; // 非周固定课表，不显示特殊边框
    }
    if (viewMode !== 'instance') {
      return '';
    }
    
    // 确保模板数据已加载
    if (!templateSchedules || templateSchedules.length === 0) {
      return ''; // 模板数据未加载，不显示边框
    }
    
    // 标准化处理函数，确保格式一致
    const normalizeDay = (v) => {
      if (!v) return '';
      const dayStr = String(v).toLowerCase().trim();
      // 处理可能的中文星期格式
      const dayMap = {
        '星期一': 'monday', '周一': 'monday', '一': 'monday',
        '星期二': 'tuesday', '周二': 'tuesday', '二': 'tuesday',
        '星期三': 'wednesday', '周三': 'wednesday', '三': 'wednesday',
        '星期四': 'thursday', '周四': 'thursday', '四': 'thursday',
        '星期五': 'friday', '周五': 'friday', '五': 'friday',
        '星期六': 'saturday', '周六': 'saturday', '六': 'saturday',
        '星期日': 'sunday', '周日': 'sunday', '日': 'sunday',
        'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday',
        'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday', 'sunday': 'sunday'
      };
      return dayMap[dayStr] || dayStr;
    };
    
    const normalizeTime = (v) => {
      if (!v) return '';
      let timeStr = String(v).trim();
      // 处理可能的秒数，如 "09:00:00"
      if (timeStr.length > 5) {
        timeStr = timeStr.substring(0, 5);
      }
      // 确保时间是 HH:MM 格式
      return timeStr;
    };

    const normalizeStudentName = (v) => {
      if (!v) return '';
      // 去除所有空格、换行符等空白字符
      return String(v).replace(/\s+/g, '').trim();
    };
    
    const iDay = normalizeDay(instanceSchedule.dayOfWeek);
    const iStart = normalizeTime(instanceSchedule.startTime);
    const iEnd = normalizeTime(instanceSchedule.endTime);
    const iStudentName = normalizeStudentName(instanceSchedule.studentName);
    
    // 判断是否为半小时课程
    const isHalfHour = isHalfHourSchedule(instanceSchedule);
    
    // 精确匹配：必须星期、开始时间、结束时间都相同
    // 对于半小时课程，需要找到它所在的整小时时间段的模板课程
    const templateSchedule = templateSchedules.find(template => {
      const tDay = normalizeDay(template.dayOfWeek);
      const tStart = normalizeTime(template.startTime);
      const tEnd = normalizeTime(template.endTime);
      
      if (isHalfHour) {
        // 半小时课程：先尝试精确匹配（模板课程也是半小时且时间完全相同）
        if (tDay === iDay && tStart === iStart && tEnd === iEnd) {
          return true;
        }
        
        // 如果精确匹配失败，再尝试匹配整小时课程
        // 例如：16:00-16:30 或 16:30-17:00 都应该匹配 16:00-17:00
        const start = dayjs(iStart, 'HH:mm');
        const end = dayjs(iEnd, 'HH:mm');
        const templateStart = dayjs(tStart, 'HH:mm');
        const templateEnd = dayjs(tEnd, 'HH:mm');
        
        // 检查半小时课程是否在模板课程的时间范围内
        return tDay === iDay && 
               start.isSameOrAfter(templateStart) && 
               end.isSameOrBefore(templateEnd) &&
               templateEnd.diff(templateStart, 'minute') === 60; // 模板课程必须是1小时
      } else {
        // 整小时课程：精确匹配
        return tDay === iDay && tStart === iStart && tEnd === iEnd;
      }
    });
    
    if (!templateSchedule) {
      // 固定课表中没有，但实例中有 - 绿色边框（手动添加）
      return '#52c41a';
    } else {
      // 固定课表中有，检查学生名是否一致（使用标准化后的学生名比较）
      const tStudentName = normalizeStudentName(templateSchedule.studentName);
      
      if (tStudentName !== iStudentName) {
        return '#faad14'; // 橙色边框
      }
      // 完全一致，不显示任何边框
      return '';
    }
  };

  // 简化的刷新函数，直接按当前视图类型刷新
  const refreshSchedulesQuietly = async () => {
    try {
      if (viewMode === 'template') {
        // 模板视图：清除模板缓存并刷新模板数据
        invalidateTimetableCache(timetableId);
        // 日期范围课表需要传递当前周数
        if (timetable && !timetable.isWeekly) {
          const r = await getTimetableSchedules(timetableId, currentWeek);
          if (r && r.success) {
            setAllSchedules(r.data || []);
          }
        } else {
          const r = await getTimetableSchedules(timetableId, null, true);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setTemplateSchedules(r.data || []);
          }
        }
      } else if (viewMode === 'instance') {
        // 实例视图：只刷新实例数据，不清除模板缓存
        if (currentWeekInstance && currentWeekInstance.id) {
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            // 更新currentWeekInstance中的schedules数据
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 回退到本周数据
          const r = await getThisWeekSchedules(timetableId);
          if (r && r.success) {
            setAllSchedules(r.data || []);
          }
        }
      } else if (viewMode === 'today') {
        const r = await getTodaySchedulesOnce(timetableId);
        if (r && r.success) setAllSchedules(r.data || []);
      } else if (viewMode === 'tomorrow') {
        const r = await getTomorrowSchedulesOnce(timetableId);
        if (r && r.success) setAllSchedules(r.data || []);
      }
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };

  // 简化视图切换数据加载，保持原有数据直到新数据加载完成
  React.useEffect(() => {
    if (!timetableId || !timetable) return;

    const loadViewData = async () => {
      try {
        // 显示加载状态，但保持原有表格数据
        setLoading(true);
        
        let response;
        
        if (viewMode === 'instance' && timetable.isWeekly) {
          // 本周实例：直接用聚合接口
          response = await getThisWeekSchedules(timetableId);
        } else if (viewMode === 'template') {
          // 模板视图
          response = await getTemplateSchedules(timetableId);
        } else if (viewMode === 'today') {
          // 今日课程
          response = await getTodaySchedulesOnce(timetableId);
        } else if (viewMode === 'tomorrow') {
          // 明日课程
          response = await getTomorrowSchedulesOnce(timetableId);
        } else if (!timetable.isWeekly) {
          // 日期范围课表：传递week参数获取指定周的数据
          response = await getTimetableSchedules(timetableId, currentWeek);
        } else {
          // 默认：普通课表数据
          response = await getTimetableSchedules(timetableId);
        }

        if (response && response.success) {
          const scheduleData = response.data || [];
          // 数据加载完成后直接更新表格
          setAllSchedules(scheduleData);
          setLoading(false);
          
          // 清理临时状态
          setSwitchToInstanceLoading(false);
          setSwitchToTemplateLoading(false);
          setTempWeeklyStats(null);
          setTempViewMode(null);
        } else {
          setLoading(false);
          // 清理临时状态
          setSwitchToInstanceLoading(false);
          setSwitchToTemplateLoading(false);
          setTempWeeklyStats(null);
          setTempViewMode(null);
        }
      } catch (error) {
        console.error('加载视图数据失败:', error);
        setLoading(false);
        // 清理临时状态
        setSwitchToInstanceLoading(false);
        setSwitchToTemplateLoading(false);
        setTempWeeklyStats(null);
        setTempViewMode(null);
      }
    };

    loadViewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, timetableId, currentWeek]);

  const handleDeleteSchedule = async (scheduleId) => {
    setDeleteLoading(true);
    try {
      // 找到要删除的课程信息
      const scheduleToDelete = allSchedules.find(s => s.id === scheduleId);
      
      let response;
      if (viewMode === 'instance') {
        // 实例视图：直接删除实例中的课程
        response = await deleteInstanceSchedule(scheduleId);
        if (response.success) {
          setOpenPopoverKey(null);
          // 直接从当前显示的数据中移除，避免重新请求
          setAllSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
          
          // 如果是取消操作（不是删除），更新leaveSlotMap
          if (scheduleToDelete) {
            const dayKey = (scheduleToDelete.dayOfWeek || '').toLowerCase();
            const timeKey = `${scheduleToDelete.startTime.substring(0,5)}-${scheduleToDelete.endTime.substring(0,5)}`;
            setLeaveSlotMap(prev => {
              const newMap = new Map(prev);
              // 使用对象格式存储，保持和请假时的数据结构一致
              newMap.set(`${dayKey}|${timeKey}`, { 
                studentName: scheduleToDelete.studentName || '', 
                scheduleId: scheduleToDelete.id,
                type: '取消'
              });
              return newMap;
            });
          }
          
          message.success('删除成功');
        } else {
          message.error(response.message || '删除失败');
        }
      } else {
        // 模板视图：使用原有删除API
        response = await deleteSchedule(timetableId, scheduleId);
        if (response.success) {
          setOpenPopoverKey(null);
          // 删除后刷新数据
          await refreshSchedulesQuietly();
          message.success('删除成功');
        } else {
          message.error(response.message || '删除失败');
        }
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 处理请假申请
  const handleLeaveRequest = (schedule) => {
    setLeaveSchedule(schedule);
    setLeaveModalVisible(true);
  };

  // 确认请假申请
  const handleConfirmLeave = async (leaveReason) => {
    if (!leaveSchedule) return;
    
    setLeaveLoading(true);
    try {
      const response = await requestLeave(leaveSchedule.id, leaveReason);
      if (response.success) {
        setLeaveModalVisible(false);
        setLeaveSchedule(null);
        setOpenPopoverKey(null);
        
        // 从课表中移除该课程（类似删除效果）
        setAllSchedules(prev => prev.filter(schedule => schedule.id !== leaveSchedule.id));
        
        // 更新leaveSlotMap，添加请假记录
        const dayKey = (leaveSchedule.dayOfWeek || '').toLowerCase();
        const timeKey = `${leaveSchedule.startTime.substring(0,5)}-${leaveSchedule.endTime.substring(0,5)}`;
        setLeaveSlotMap(prev => {
          const newMap = new Map(prev);
          newMap.set(`${dayKey}|${timeKey}`, { studentName: leaveSchedule.studentName || '', scheduleId: leaveSchedule.id, type: '请假' });
          return newMap;
        });
        
        message.success('请假申请成功');
      } else {
        message.error(response.message || '请假申请失败');
      }
    } catch (error) {
      message.error('请假申请失败，请重试');
    } finally {
      setLeaveLoading(false);
    }
  };

  // 取消请假申请
  const handleCancelLeave = () => {
    setLeaveModalVisible(false);
    setLeaveSchedule(null);
  };

  // 恢复请假/取消的学员
  const handleRestoreSchedule = async (cancelInfo) => {
    if (restoreLoading) return; // 防止重复点击
    try {
      setRestoreLoading(true);
      
      if (cancelInfo.type === '请假') {
        // 请假恢复：使用cancelLeave API
        try {
          const response = await cancelLeave(cancelInfo.scheduleId);
          if (response.success && response.data) {
            // 先从leaveSlotMap中移除该记录
            const timeInfoParts = cancelInfo.timeInfo.split(', ');
            const chineseToEnglishDay = {
              '星期一': 'monday',
              '星期二': 'tuesday',
              '星期三': 'wednesday',
              '星期四': 'thursday',
              '星期五': 'friday',
              '星期六': 'saturday',
              '星期日': 'sunday'
            };
            const dayKey = chineseToEnglishDay[timeInfoParts[0]] || (cancelInfo.timeInfo.includes('星期') ? timeInfoParts[0].toLowerCase() : null);
            const timeKey = timeInfoParts[1];
            if (dayKey && timeKey) {
              setLeaveSlotMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(`${dayKey}|${timeKey}`);
                return newMap;
              });
            }
            
            // 立即将恢复的课程添加到 allSchedules 中
            const restoredSchedule = response.data;
            
            // 检查课程是否已经在列表中
            const existingIndex = allSchedules.findIndex(s => s.id === restoredSchedule.id);
            
            if (existingIndex >= 0) {
              // 更新现有课程
              const newSchedules = [...allSchedules];
              newSchedules[existingIndex] = restoredSchedule;
              setAllSchedules(newSchedules);
            } else {
              // 添加新课程
              setAllSchedules([...allSchedules, restoredSchedule]);
            }
            
            message.success('恢复成功');
            setOpenPopoverKey(null);
            // 清除缓存，确保下次获取最新数据
            invalidateTimetableCache(timetableId);
          } else {
            message.error(response.message || '恢复失败');
          }
        } catch (error) {
          console.error('取消请假失败:', error);
          // 如果课程不存在（可能被物理删除），则重新创建
          if (error.response?.status === 404 ||
              error.message?.includes('课程不存在') ||
              error.response?.data?.message?.includes('不存在') ||
              error.response?.data?.message?.includes('已取消')) {
            await recreateSchedule(cancelInfo);
          } else {
            // 其他错误，也尝试重新创建作为备选方案
            try {
              await recreateSchedule(cancelInfo);
            } catch (recreateError) {
              console.error('重新创建课程也失败:', recreateError);
              message.error(error.response?.data?.message || '恢复失败，请重试');
            }
          }
        }
      } else {
        // 取消恢复：重新创建课程
        await recreateSchedule(cancelInfo);
      }
      
    } catch (error) {
      message.error('恢复失败，请重试');
      console.error('恢复失败:', error);
    } finally {
      setRestoreLoading(false);
    }
  };
  // 重新创建课程（用于恢复被删除的课程）
  const recreateSchedule = async (cancelInfo) => {
    try {
      
      // 检查 cancelInfo 结构
      if (!cancelInfo || !cancelInfo.timeInfo) {
        console.error('cancelInfo 结构不正确:', cancelInfo);
        message.error('恢复信息不完整，请重试');
        return;
      }
      
      const timeInfoParts = cancelInfo.timeInfo.split(', ');
      if (timeInfoParts.length < 2) {
        console.error('timeInfo 格式不正确:', cancelInfo.timeInfo);
        message.error('时间信息格式错误，请重试');
        return;
      }
      
      const [startTimeStr, endTimeStr] = timeInfoParts[1].split('-');
      if (!startTimeStr || !endTimeStr) {
        console.error('时间解析失败:', timeInfoParts[1]);
        message.error('时间解析失败，请重试');
        return;
      }
      
      const startTime = `${startTimeStr}:00`;
      const endTime = `${endTimeStr}:00`;
      
      // 获取星期几
      const dayMap = {
        '星期一': 'MONDAY',
        '星期二': 'TUESDAY',
        '星期三': 'WEDNESDAY',
        '星期四': 'THURSDAY',
        '星期五': 'FRIDAY',
        '星期六': 'SATURDAY',
        '星期日': 'SUNDAY'
      };
      const dayOfWeek = dayMap[timeInfoParts[0]];
      
      if (!dayOfWeek) {
        console.error('星期几解析失败:', timeInfoParts[0]);
        message.error('星期几解析失败，请重试');
        return;
      }
      
      const payload = {
        studentName: cancelInfo.studentName,
        dayOfWeek: dayOfWeek,
        startTime: startTime,
        endTime: endTime,
        note: '恢复的课程',
        isManualAdded: false,  // 标记为非手动添加，因为是从固定课表恢复的
        isModified: false      // 标记为未修改，因为内容与固定课表一致
      };
      
      
      if (currentWeekInstance) {
        
        // 先检查课程是否已经存在
        const existingSchedules = allSchedules || [];
        const alreadyExists = existingSchedules.some(schedule =>
          schedule.dayOfWeek === payload.dayOfWeek &&
          schedule.startTime === payload.startTime &&
          schedule.endTime === payload.endTime &&
          schedule.studentName === payload.studentName
        );
        
        if (alreadyExists) {
          // 先从leaveSlotMap中移除该记录
          const timeInfoParts = cancelInfo.timeInfo.split(', ');
          const chineseToEnglishDay = {
            '星期一': 'monday',
            '星期二': 'tuesday',
            '星期三': 'wednesday',
            '星期四': 'thursday',
            '星期五': 'friday',
            '星期六': 'saturday',
            '星期日': 'sunday'
          };
          const dayKey = chineseToEnglishDay[timeInfoParts[0]] || timeInfoParts[0].toLowerCase();
          const timeKey = timeInfoParts[1];
          setLeaveSlotMap(prev => {
            const newMap = new Map(prev);
            newMap.delete(`${dayKey}|${timeKey}`);
            return newMap;
          });
          
          message.success('恢复成功');
          setOpenPopoverKey(null);
          // 清除缓存，确保下次获取最新数据
          invalidateTimetableCache(timetableId);
          return;
        }
        
        try {
          const response = await createInstanceSchedule(currentWeekInstance.id, payload);
          if (response.success) {
            // 先从leaveSlotMap中移除该记录，避免重新获取数据时又被加回来
            const timeInfoParts = cancelInfo.timeInfo.split(', ');
            const chineseToEnglishDay = {
              '星期一': 'monday',
              '星期二': 'tuesday',
              '星期三': 'wednesday',
              '星期四': 'thursday',
              '星期五': 'friday',
              '星期六': 'saturday',
              '星期日': 'sunday'
            };
            const dayKey = chineseToEnglishDay[timeInfoParts[0]] || timeInfoParts[0].toLowerCase();
            const timeKey = timeInfoParts[1];
            setLeaveSlotMap(prev => {
              const newMap = new Map(prev);
              newMap.delete(`${dayKey}|${timeKey}`);
              return newMap;
            });
            
            // 手动将新创建的课程添加到allSchedules中，避免需要重新获取所有数据
            if (response.data) {
              setAllSchedules(prev => [...prev, response.data]);
            }
            
            message.success('恢复成功');
            setOpenPopoverKey(null);
            // 清除缓存，下次获取时能拿到最新数据
            invalidateTimetableCache(timetableId);
          } else {
            message.error(response.message || '恢复失败');
          }
        } catch (createError) {
          console.error('创建实例课程失败:', createError);
          // 检查是否是重复创建的错误
          if (createError.response?.status === 409 ||
              (createError.response?.data?.message &&
               createError.response.data.message.includes('已存在'))) {
            // 先从leaveSlotMap中移除该记录
            const timeInfoParts = cancelInfo.timeInfo.split(', ');
            const chineseToEnglishDay = {
              '星期一': 'monday',
              '星期二': 'tuesday',
              '星期三': 'wednesday',
              '星期四': 'thursday',
              '星期五': 'friday',
              '星期六': 'saturday',
              '星期日': 'sunday'
            };
            const dayKey = chineseToEnglishDay[timeInfoParts[0]] || timeInfoParts[0].toLowerCase();
            const timeKey = timeInfoParts[1];
            setLeaveSlotMap(prev => {
              const newMap = new Map(prev);
              newMap.delete(`${dayKey}|${timeKey}`);
              return newMap;
            });
            
            // 刷新数据以获取已存在的课程
            invalidateTimetableCache(timetableId);
            await fetchWeekInstanceSchedules();
            
            message.success('恢复成功');
            setOpenPopoverKey(null);
          } else {
            message.error(createError.response?.data?.message || '创建课程失败');
          }
        }
      } else {
        console.error('当前没有周实例，无法恢复课程');
        message.error('当前没有周实例，无法恢复课程');
      }
    } catch (error) {
      console.error('重新创建课程失败:', error);
      message.error('恢复失败：' + (error.message || '未知错误'));
    }
  };

  // 更新学生姓名
  const handleSaveStudentName = async (scheduleObj, newName) => {
    if (!newName || newName.trim() === '') {
      message.warning('学生姓名不能为空');
      return;
    }
    const payload = {
      studentName: newName.trim(),
    };
    setUpdateLoading(true);
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleObj.id, payload);
        if (response.success) {
          setOpenPopoverKey(null);
          // 直接更新本地状态，避免影响固定课表
          setAllSchedules(prev => prev.map(schedule => 
            schedule.id === scheduleObj.id 
              ? { ...schedule, studentName: newName.trim() }
              : schedule
          ));
          // 同时更新currentWeekInstance中的schedules数据
          setCurrentWeekInstance(prev => ({
            ...prev,
            schedules: (prev.schedules || []).map(schedule => 
              schedule.id === scheduleObj.id 
                ? { ...schedule, studentName: newName.trim() }
                : schedule
            )
          }));
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, payload);
        if (response.success) {
          setOpenPopoverKey(null);
          // 模板视图需要刷新数据
          await refreshSchedulesQuietly();
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setUpdateLoading(false);
    }
  };

  // 更新schedule的单个字段（如isHalfHour, isTrial等）
  const handleUpdateScheduleField = async (scheduleObj, fieldName, fieldValue, halfHourPosition = 'first') => {
    let payload = {
      [fieldName]: fieldValue,
    };
    
    // 如果是修改半小时字段，需要同时更新开始和结束时间
    if (fieldName === 'isHalfHour') {
      if (fieldValue) {
        // 打开半小时开关：需要根据 halfHourPosition 设置时间
        const currentStart = dayjs(scheduleObj.startTime, 'HH:mm:ss');
        const currentEnd = dayjs(scheduleObj.endTime, 'HH:mm:ss');
        const duration = currentEnd.diff(currentStart, 'minute');
        
        // 找到原始的整小时时间作为基准
        let baseStart;
        if (duration === 30) {
          // 如果当前已经是半小时，需要找到原始的整点时间
          if (currentStart.minute() === 30) {
            // 当前是后半小时（如15:30-16:00），基准时间是15:00
            baseStart = currentStart.subtract(30, 'minute');
          } else {
            // 当前是前半小时（如15:00-15:30），基准时间就是当前开始时间
            baseStart = currentStart;
          }
        } else {
          // 如果当前是整小时，基准就是当前开始时间
          baseStart = currentStart;
        }
        
        if (halfHourPosition === 'first') {
          // 前半小时：基准时间到基准时间+30分钟
          payload.startTime = baseStart.format('HH:mm:ss');
          payload.endTime = baseStart.add(30, 'minute').format('HH:mm:ss');
        } else {
          // 后半小时：基准时间+30分钟到基准时间+60分钟
          payload.startTime = baseStart.add(30, 'minute').format('HH:mm:ss');
          payload.endTime = baseStart.add(60, 'minute').format('HH:mm:ss');
        }
      } else {
        // 关闭半小时开关：恢复为整小时
        const currentStart = dayjs(scheduleObj.startTime, 'HH:mm:ss');
        const currentEnd = dayjs(scheduleObj.endTime, 'HH:mm:ss');
        const duration = currentEnd.diff(currentStart, 'minute');
        
        // 如果当前是后半小时（如15:30-16:00），需要调整开始时间到整点
        if (duration === 30 && currentStart.minute() === 30) {
          payload.startTime = currentStart.subtract(30, 'minute').format('HH:mm:ss');
          payload.endTime = currentEnd.format('HH:mm:ss');
        } else {
          // 如果是前半小时（如15:00-15:30），只需要延长结束时间
          payload.endTime = currentStart.add(60, 'minute').format('HH:mm:ss');
        }
      }
    }
    
    setUpdateLoading(true);
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleObj.id, payload);
        if (response.success) {
          // 直接更新本地状态
          setAllSchedules(prev => prev.map(schedule => 
            schedule.id === scheduleObj.id 
              ? { ...schedule, ...payload }
              : schedule
          ));
          // 同时更新currentWeekInstance中的schedules数据
          setCurrentWeekInstance(prev => ({
            ...prev,
            schedules: (prev.schedules || []).map(schedule => 
              schedule.id === scheduleObj.id 
                ? { ...schedule, ...payload }
                : schedule
            )
          }));
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, payload);
        if (response.success) {
          // 模板视图需要刷新数据
          await refreshSchedulesQuietly();
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setUpdateLoading(false);
    }
  };

  // 完整编辑课程
  const handleEditSchedule = async (scheduleObj, updatedData) => {
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleObj.id, updatedData);
        if (response.success) {
          setEditModalVisible(false);
          setEditingSchedule(null);
          // 直接更新本地状态，避免影响固定课表
          setAllSchedules(prev => prev.map(schedule => 
            schedule.id === scheduleObj.id 
              ? { ...schedule, ...updatedData }
              : schedule
          ));
          // 同时更新currentWeekInstance中的schedules数据
          setCurrentWeekInstance(prev => ({
            ...prev,
            schedules: (prev.schedules || []).map(schedule => 
              schedule.id === scheduleObj.id 
                ? { ...schedule, ...updatedData }
                : schedule
            )
          }));
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleObj.id, updatedData);
        if (response.success) {
          setEditModalVisible(false);
          setEditingSchedule(null);
          // 模板视图需要刷新数据
          await refreshSchedulesQuietly();
          message.success('修改成功');
        } else {
          message.error(response.message || '修改失败');
        }
      }
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  const handleStartMove = (schedule) => {
    setScheduleToMove(schedule);
    setMoveMode(true);
    setSelectedMoveTarget(null);
    setOpenPopoverKey(null);
    message.info('请选择要移动到的时间段');
  };

  const handleCancelMove = () => {
    setMoveMode(false);
    setScheduleToMove(null);
    setSelectedMoveTarget(null);
    setMoveTargetText('请选择要移动到的时间段');
  };

  const handleSelectMoveTarget = (targetDayKey, targetTimeIndex) => {
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const targetKey = `${pagePrefix}-${targetDayKey}-${targetTimeIndex}`;
    setSelectedMoveTarget(targetKey);
    
    // 生成显示文本
    const dayText = dayMap[targetDayKey.toUpperCase()] || targetDayKey;
    const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00'];
    const timeText = timeSlots[targetTimeIndex] || `${targetTimeIndex + 9}:00-${targetTimeIndex + 10}:00`;
    
    setMoveTargetText(`移动到周${dayText}，${timeText}`);
  };

  const handleConfirmMove = async () => {
    if (!selectedMoveTarget || !scheduleToMove) {
      message.warning('请先选择移动目标位置');
      return;
    }

    setMoveLoading(true);
    
    // 处理key格式: week-3-tuesday-5 或 weekly-tuesday-5
    const parts = selectedMoveTarget.split('-');
    let targetDayKey, targetTimeIndex;
    
    if (parts.length === 4) {
      // week-3-tuesday-5 格式
      targetDayKey = parts[2];
      targetTimeIndex = parts[3];
    } else if (parts.length === 3) {
      // weekly-tuesday-5 格式
      targetDayKey = parts[1]; 
      targetTimeIndex = parts[2];
    } else {
      message.error('移动目标格式错误');
      return;
    }
    
    
    const targetTimeSlot = timeSlots[parseInt(targetTimeIndex)];
    
    const [startTimeStr, endTimeStr] = targetTimeSlot.split('-');
    const startTime = `${startTimeStr}:00`;
    const endTime = `${endTimeStr}:00`;

    let payload = {
      startTime,
      endTime,
      dayOfWeek: targetDayKey.toUpperCase(),
    };

    // 为实例视图和日期范围课表计算目标日期
    if (viewMode === 'instance' && currentWeekInstance) {
      // 实例视图：基于实例的周开始日期计算目标日期
      const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
      const dayIndex = weekDays.findIndex(day => day.key === targetDayKey);
      const targetDate = instanceStartDate.clone().add(dayIndex, 'day');
      payload.scheduleDate = targetDate.format('YYYY-MM-DD');
    } else if (!timetable.isWeekly) {
      // 日期范围课表：使用getCurrentWeekDates计算目标日期
      const weekDates = getCurrentWeekDates();
      if (weekDates.start) {
        const dayIndex = weekDays.findIndex(day => day.key === targetDayKey);
        const targetDate = weekDates.start.clone().add(dayIndex, 'day');
        payload.scheduleDate = targetDate.format('YYYY-MM-DD');
      }
    }

    
    try {
      let response;
      if (viewMode === 'instance') {
        // 实例视图：使用实例更新API
        response = await updateInstanceSchedule(scheduleToMove.id, payload);
      } else {
        // 模板视图：使用原有更新API
        response = await updateSchedule(timetableId, scheduleToMove.id, payload);
      }
      
      if (response.success) {
        setMoveMode(false);
        setScheduleToMove(null);
        setSelectedMoveTarget(null);
        setMoveTargetText('请选择要移动到的时间段');
        
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        
        message.success('课程移动成功');
      } else {
        message.error(response.message || '移动失败');
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setMoveLoading(false);
    }
  };



  const handleStartCopy = (schedule) => {
    setCopyMode(true);
    setScheduleToCopy(schedule);
    setSelectedCopyTargets(new Set());
    setOpenPopoverKey(null);
    message.info('选择要复制到的时间段（可多选），点击确认复制');
  };

  const handleStartSwap = (schedule) => {
    setSwapMode(true);
    setScheduleToSwap(schedule);
    setSelectedSwapTarget(null);
    setOpenPopoverKey(null);
    message.info('请选择要调换的课程');
  };

  const handleCancelSwap = () => {
    setSwapMode(false);
    setScheduleToSwap(null);
    setSelectedSwapTarget(null);
    setSwapTargetText('请选择要调换的课程');
  };

  const handleSelectSwapTarget = (targetSchedule) => {
    // 检查源课程和目标课程的课程类型是否匹配
    const sourceIsHalfHour = isHalfHourSchedule(scheduleToSwap);
    const targetIsHalfHour = isHalfHourSchedule(targetSchedule);
    
    if (sourceIsHalfHour !== targetIsHalfHour) {
      message.warning('半小时课程只能和半小时课程调换，整小时课程只能和整小时课程调换');
      return;
    }
    
    setSelectedSwapTarget(targetSchedule);
    const dayText = dayMap[targetSchedule.dayOfWeek?.toUpperCase()] || targetSchedule.dayOfWeek;
    const timeText = `${targetSchedule.startTime?.substring(0, 5)}~${targetSchedule.endTime?.substring(0, 5)}`;
    setSwapTargetText(`与 ${targetSchedule.studentName} (周${dayText}，${timeText}) 调换`);
  };

  const handleConfirmSwap = async () => {
    if (!selectedSwapTarget || !scheduleToSwap) {
      message.warning('请先选择要调换的课程');
      return;
    }

    setSwapLoading(true);
    
    try {
      let response;
      
      if (viewMode === 'instance') {
        // 在实例视图下，使用实例课程的 ID 调用周实例调换接口
        const schedule1Id = scheduleToSwap.id;
        const schedule2Id = selectedSwapTarget.id;
        
        if (!schedule1Id || !schedule2Id) {
          message.error('无法获取课程ID，请重试');
          setSwapLoading(false);
          return;
        }
        
        response = await swapInstanceSchedules(schedule1Id, schedule2Id);
      } else {
        // 在固定课表视图下，使用固定课表的 ID 调用固定课表调换接口
        const schedule1Id = scheduleToSwap.id;
        const schedule2Id = selectedSwapTarget.id;
        
        if (!schedule1Id || !schedule2Id) {
          message.error('无法获取课程ID，请重试');
          setSwapLoading(false);
          return;
        }
        
        response = await swapSchedules(timetable.id, schedule1Id, schedule2Id);
      }
      
      if (response && response.success) {
        message.success('课程调换成功');
        // 固定课表视图需要清除缓存
        if (viewMode === 'template') {
          invalidateTimetableCache(timetableId);
        }
        // 刷新数据
        await refreshSchedulesQuietly();
        handleCancelSwap();
      } else {
        message.error(response?.message || '课程调换失败');
      }
    } catch (error) {
      console.error('调换课程失败:', error);
      message.error('调换课程失败，请重试');
    } finally {
      setSwapLoading(false);
    }
  };

  const handleCancelCopy = () => {
    setCopyMode(false);
    setScheduleToCopy(null);
    setSelectedCopyTargets(new Set());
  };

  const handleSelectCopyTarget = (targetDayKey, targetTimeIndex) => {
    // 使用与cellKey相同的格式
    const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    const targetKey = `${pagePrefix}-${targetDayKey}-${targetTimeIndex}`;
    const newTargets = new Set(selectedCopyTargets);
    
    if (newTargets.has(targetKey)) {
      newTargets.delete(targetKey);
    } else {
      newTargets.add(targetKey);
    }
    
    setSelectedCopyTargets(newTargets);
  };

  const handleConfirmCopy = async () => {
    if (!scheduleToCopy || selectedCopyTargets.size === 0) {
      message.warning('请先选择要复制到的时间段');
      return;
    }

    setCopyLoading(true);
    try {
      // 构建批量创建的payload数组
      const schedulesToCreate = Array.from(selectedCopyTargets).map((targetKey) => {
        // 解析cellKey格式：pagePrefix-dayKey-timeIndex
        const parts = targetKey.split('-');
        let dayKey, timeIndex, weekNum;

        if (timetable.isWeekly) {
          // 周固定课表：weekly-dayKey-timeIndex
          [, dayKey, timeIndex] = parts;
        } else {
          // 日期范围课表：week-weekNum-dayKey-timeIndex
          [, weekNum, dayKey, timeIndex] = parts;
        }

        const dayIndex = weekDays.findIndex(day => day.key === dayKey);
        const targetTimeSlot = timeSlots[parseInt(timeIndex)];
        const [startTimeStr, endTimeStr] = targetTimeSlot.split('-');
        const startTime = `${startTimeStr}:00`;
        const endTime = `${endTimeStr}:00`;

        let scheduleDate = null;
        if (!timetable.isWeekly) {
          // 对于日期范围课表，使用cellKey中的周数信息计算日期
          const targetWeek = weekNum ? parseInt(weekNum) : currentWeek;
          const startDate = dayjs(timetable.startDate);
          const anchorMonday = startDate.startOf('week');
          const weekStart = anchorMonday.add(targetWeek - 1, 'week');
          const currentDate = weekStart.add(dayIndex, 'day');
          scheduleDate = currentDate.format('YYYY-MM-DD');
        }

        const payload = {
          studentName: scheduleToCopy.studentName,
          dayOfWeek: dayKey.toUpperCase(),
          startTime,
          endTime,
          note: '复制创建',
        };

        if (scheduleDate) {
          payload.scheduleDate = scheduleDate;
        }

        return payload;
      });

      // 使用批量创建接口
      let response;
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例批量API
        response = await createInstanceSchedulesBatch(currentWeekInstance.id, schedulesToCreate);
      } else {
        // 模板视图：使用原有批量API
        response = await createSchedulesBatch(timetableId, schedulesToCreate);
      }
      
      if (response.success) {
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        message.success(`成功复制 ${schedulesToCreate.length} 个课程`);
      } else {
        message.error(response.message || '复制失败');
      }

      handleCancelCopy();
    } catch (err) {
      message.error('网络错误，复制失败');
      handleCancelCopy();
    } finally {
      setCopyLoading(false);
    }
  };

  const handleExportStudentSchedule = async (studentName) => {
    try {
      message.loading({ content: '正在导出全部课时...', key: 'exporting' });

      // 使用新的接口直接获取该学生的课程安排
      const response = await getTimetableSchedulesByStudent(timetableId, studentName);
      
      if (!response || !response.success) {
        message.destroy('exporting');
        message.error(response?.message || '获取学生课程安排失败');
        return;
      }

      const studentSchedules = response.data;
      message.destroy('exporting');

      if (studentSchedules.length === 0) {
        message.info('该学生在本课表没有课程');
        return;
      }

      setExportingStudentName(studentName);

      // 格式化内容
      let content = '';

      if (timetable.isWeekly) {
        // 周固定课表
        content += studentSchedules
          .map(s => {
            const dayOfWeek = s.dayOfWeek ? s.dayOfWeek.toUpperCase() : '';
            
            // 改进的映射逻辑
            let dayText = dayMap[dayOfWeek];
            if (!dayText) {
              // 如果dayMap中没有找到，尝试其他可能的格式
              if (dayOfWeek.includes('MONDAY') || dayOfWeek.includes('一')) dayText = '一';
              else if (dayOfWeek.includes('TUESDAY') || dayOfWeek.includes('二')) dayText = '二';
              else if (dayOfWeek.includes('WEDNESDAY') || dayOfWeek.includes('三')) dayText = '三';
              else if (dayOfWeek.includes('THURSDAY') || dayOfWeek.includes('四')) dayText = '四';
              else if (dayOfWeek.includes('FRIDAY') || dayOfWeek.includes('五')) dayText = '五';
              else if (dayOfWeek.includes('SATURDAY') || dayOfWeek.includes('六')) dayText = '六';
              else if (dayOfWeek.includes('SUNDAY') || dayOfWeek.includes('日') || dayOfWeek.includes('天')) dayText = '日';
              else dayText = s.dayOfWeek || '未知';
            }
            
            return `星期${dayText}, ${s.startTime.substring(0, 5)}~${s.endTime.substring(0, 5)}`;
          })
          .join('\n');
      } else {
        // 日期范围课表 - 根据scheduleDate计算星期几，并按日期排序
        content += studentSchedules
          .sort((a, b) => {
            // 按scheduleDate从早到晚排序
            const dateA = new Date(a.scheduleDate);
            const dateB = new Date(b.scheduleDate);
            return dateA - dateB;
          })
          .map(s => {
            let dayText = '未知';
            
            // 如果有scheduleDate，根据日期计算星期几
            if (s.scheduleDate) {
              const date = new Date(s.scheduleDate);
              const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
              const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
              dayText = weekDays[dayOfWeek];
            } else if (s.dayOfWeek) {
              // 如果dayOfWeek存在，使用映射逻辑
              const dayOfWeek = s.dayOfWeek.toUpperCase();
              let mappedDayText = dayMap[dayOfWeek];
              if (!mappedDayText) {
                if (dayOfWeek.includes('MONDAY') || dayOfWeek.includes('一')) mappedDayText = '一';
                else if (dayOfWeek.includes('TUESDAY') || dayOfWeek.includes('二')) mappedDayText = '二';
                else if (dayOfWeek.includes('WEDNESDAY') || dayOfWeek.includes('三')) mappedDayText = '三';
                else if (dayOfWeek.includes('THURSDAY') || dayOfWeek.includes('四')) mappedDayText = '四';
                else if (dayOfWeek.includes('FRIDAY') || dayOfWeek.includes('五')) mappedDayText = '五';
                else if (dayOfWeek.includes('SATURDAY') || dayOfWeek.includes('六')) mappedDayText = '六';
                else if (dayOfWeek.includes('SUNDAY') || dayOfWeek.includes('日') || dayOfWeek.includes('天')) mappedDayText = '日';
                else mappedDayText = s.dayOfWeek;
              }
              dayText = mappedDayText;
            }
            
            return `${s.scheduleDate}, 星期${dayText}, ${s.startTime.substring(0, 5)}~${s.endTime.substring(0, 5)}`;
          })
          .join('\n');
      }

      setExportContent(content);
      setExportModalVisible(true);
      setOpenPopoverKey(null);
    } catch (error) {
      message.destroy('exporting');
      console.error('导出失败:', error);
      message.error('导出失败，请检查网络连接');
    }
  };
  const handleExportTable = () => {
    const tableNode = tableRef.current;
    if (!tableNode) {
      message.error('无法导出，未找到表格元素');
      return;
    }

    message.loading({ content: '正在生成图片...', key: 'exporting' });

    // 1. 克隆节点
    const clonedNode = tableNode.cloneNode(true);

    // 2. 在克隆体上修改截断的学生姓名
    const elementsToModify = clonedNode.querySelectorAll('.student-name-truncated');

    elementsToModify.forEach(el => {
      if (el.title) {
        el.innerText = el.title;
      }
    });

    // 计算整个表格中最长文字的宽度
    const calculateMaxTextWidth = () => {
      let maxWidth = 0;

      // 为计算文字宽度创建测试元素
      const testDiv = document.createElement('div');
      testDiv.style.position = 'absolute';
      testDiv.style.left = '-9999px';
      testDiv.style.fontSize = '12px';
      testDiv.style.fontFamily = 'inherit';
      testDiv.style.whiteSpace = 'nowrap';
      testDiv.style.visibility = 'hidden';
      document.body.appendChild(testDiv);

      // 检查所有表头
      const headerCells = clonedNode.querySelectorAll('thead th');
      headerCells.forEach(th => {
        testDiv.innerText = th.innerText || th.textContent || '';
        maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
      });

      // 检查所有单元格内容
      const allCells = clonedNode.querySelectorAll('tbody td');
      allCells.forEach(cell => {
        // 获取单元格中所有学生姓名（包括截断的）
        const studentNames = cell.querySelectorAll('.student-name-truncated');
        studentNames.forEach(nameEl => {
          const fullName = nameEl.title || nameEl.innerText;
          testDiv.innerText = fullName;
          maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
        });

        // 也检查非截断的文本
        const allText = cell.innerText || cell.textContent || '';
        if (allText.trim()) {
          testDiv.innerText = allText;
          maxWidth = Math.max(maxWidth, testDiv.offsetWidth);
        }
      });

      document.body.removeChild(testDiv);

      // 添加一个字的宽度作为缓冲（约14px）
      return maxWidth + 14;
    };

    const maxTextWidth = calculateMaxTextWidth();
    const headerCells = clonedNode.querySelectorAll('thead th');
    const columnCount = headerCells.length;

    // 所有列都使用相同宽度，基于最长文字+1个字的宽度
    const uniformWidth = Math.max(maxTextWidth, 60); // 最小60px
    const totalWidth = uniformWidth * columnCount;

    // 对所有单元格设置统一样式
    const allCells = clonedNode.querySelectorAll('td, th');
    allCells.forEach(cell => {
      cell.style.whiteSpace = 'nowrap';  // 所有单元格都不换行
      cell.style.overflow = 'visible';
      cell.style.textOverflow = 'clip';
      cell.style.padding = '8px 16px';  // 内边距
    });

    // 设置表格布局和各列宽度
    const tableElement = clonedNode.querySelector('table');
    if (tableElement) {
      tableElement.style.tableLayout = 'fixed';
      tableElement.style.width = `${totalWidth}px`;

      // 所有列都设置为相同宽度
      headerCells.forEach(th => {
        th.style.width = `${uniformWidth}px`;
      });
    }

    // 必须将克隆节点添加到DOM中才能被html2canvas捕获，但可以设为不可见
    clonedNode.style.position = 'absolute';
    clonedNode.style.width = `${totalWidth}px`;  // 匹配表格宽度
    clonedNode.style.left = '-9999px';
    clonedNode.style.top = '0px';
    clonedNode.style.backgroundColor = 'white';
    document.body.appendChild(clonedNode);

    // 3. 对克隆体截图
    html2canvas(clonedNode, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      const weekInfo = !timetable?.isWeekly && totalWeeks > 1 ? `-第${currentWeek}周` : '';
      link.download = `${timetable?.name || '课表'}${weekInfo}-${new Date().toLocaleString()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success({ content: '图片已导出！', key: 'exporting' });
    }).catch(error => {
      console.error('导出失败:', error);
      message.error({ content: '导出失败，请稍后重试', key: 'exporting' });
    }).finally(() => {
      // 4. 清理
      document.body.removeChild(clonedNode);
    });
  };

  // 多选功能处理函数
  const toggleMultiSelectMode = () => {
    const newMode = !multiSelectMode;
    setMultiSelectMode(newMode);
    setSelectedCells(new Set()); // 切换模式时总是清空选择
    setOpenPopoverKey(null);

    // 如果是进入多选模式，显示提示
    if (newMode) {
      message.info('已进入多选模式，点击空白单元格进行选择');
    }
  };

  // 多选删除功能处理函数
  const toggleDeleteMode = () => {
    const newMode = !deleteMode;
    setDeleteMode(newMode);
    setSelectedSchedulesForDelete(new Set()); // 切换模式时总是清空选择
    setOpenPopoverKey(null);

    // 如果是进入删除模式，显示提示
    if (newMode) {
      message.info('已进入删除模式，点击有内容的单元格进行选择');
    }
  };

  // 处理删除模式下的单元格选择
  const handleDeleteCellSelection = (cellKey, dayKey, timeKey) => {
    const newSelected = new Set(selectedSchedulesForDelete);
    if (newSelected.has(cellKey)) {
      newSelected.delete(cellKey);
    } else {
      newSelected.add(cellKey);
    }
    setSelectedSchedulesForDelete(newSelected);
  };

  // 批量删除选中的课程
  const handleBatchDelete = async () => {
    if (selectedSchedulesForDelete.size === 0) {
      message.warning('请先选择要删除的课程');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedSchedulesForDelete.size} 个课程吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          
          // 收集所有要删除的schedule ID
          const scheduleIdsToDelete = [];
          
          for (const cellKey of selectedSchedulesForDelete) {
            // 从cellKey中解析出schedule信息
            // cellKey格式: ${day.key}-${record.key}，其中record.key是timeSlots的索引
            const [dayKey, timeIndex] = cellKey.split('-');
            const timeSlot = timeSlots[parseInt(timeIndex)];
            
            const schedules = displaySchedules.filter(s => {
              // 注意：这里不过滤占用时间段，占用时间段也可以被删除
              
              const timeKeyFromSchedule = `${s.startTime.substring(0, 5)}-${s.endTime.substring(0, 5)}`;
              let scheduleDayKey;
              if (timetable.isWeekly) {
                scheduleDayKey = s.dayOfWeek.toLowerCase();
              } else {
                const scheduleDate = dayjs(s.scheduleDate);
                const dayIndex = scheduleDate.day();
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                scheduleDayKey = dayNames[dayIndex];
              }
              return timeKeyFromSchedule === timeSlot && scheduleDayKey === dayKey;
            });
            

            if (schedules.length > 0) {
              const schedule = schedules[0];
              scheduleIdsToDelete.push(schedule.id);
            } else {
            }
          }

          // 使用批量删除接口
          if (scheduleIdsToDelete.length > 0) {
            if (viewMode === 'instance') {
              const response = await deleteInstanceSchedulesBatch(scheduleIdsToDelete);
              if (response.success) {
                message.success(`成功删除 ${response.data} 个课程`);
              } else {
                message.error(response.message || '批量删除失败');
              }
            } else {
              const response = await deleteSchedulesBatch(timetableId, scheduleIdsToDelete);
              if (response.success) {
                message.success(`成功删除 ${response.data} 个课程`);
              } else {
                message.error(response.message || '批量删除失败');
              }
            }
          } else {
            message.warning('没有找到要删除的课程');
          }
          
          // 清空选择并退出删除模式
          setSelectedSchedulesForDelete(new Set());
          setDeleteMode(false);
          
          // 刷新数据
          if (viewMode === 'instance' && currentWeekInstance) {
            // 实例视图：直接刷新实例数据，避免影响固定课表
            const r = await getInstanceSchedules(currentWeekInstance.id);
            if (r && r.success) {
              setAllSchedules(r.data || []);
              setCurrentWeekInstance(prev => ({
                ...prev,
                schedules: r.data || []
              }));
            }
          } else {
            // 模板视图：需要刷新数据
            await refreshSchedulesQuietly();
          }
        } catch (error) {
          console.error('批量删除失败:', error);
          message.error('批量删除失败，请重试');
        }
      }
    });
  };

  const handleCellSelection = (cellKey, dayIndex, timeIndex) => {
    if (!multiSelectMode) return;

    const newSelectedCells = new Set(selectedCells);
    if (newSelectedCells.has(cellKey)) {
      newSelectedCells.delete(cellKey);
    } else {
      newSelectedCells.add(cellKey);
    }
    setSelectedCells(newSelectedCells);
  };

  // 获取当前页面的选择数量
  const getCurrentPageSelectionCount = useCallback(() => {
    if (!multiSelectMode || selectedCells.size === 0) return 0;

    const currentPagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
    let count = 0;

    selectedCells.forEach(cellKey => {
      if (cellKey.startsWith(currentPagePrefix)) {
        count++;
      }
    });

    return count;
  }, [multiSelectMode, selectedCells, timetable?.isWeekly, currentWeek]);

  const openBatchScheduleModal = () => {
    if (selectedCells.size === 0) {
      message.warning('请先选择要排课的时间段');
      return;
    }
    setBatchScheduleModalVisible(true);
  };

  const handleBatchSchedule = async () => {
    if (!batchStudentName.trim()) {
      message.warning('请输入学生姓名');
      return;
    }

    const weekDates = getCurrentWeekDates();
    const schedulesToCreate = [];

    Array.from(selectedCells).forEach(cellKey => {
      // 解析新的cellKey格式：pagePrefix-dayKey-timeIndex
      const parts = cellKey.split('-');
      let dayKey, timeIndex, weekNum;

      if (timetable.isWeekly) {
        // 周固定课表：weekly-dayKey-timeIndex
        [, dayKey, timeIndex] = parts;
      } else {
        // 日期范围课表：week-weekNum-dayKey-timeIndex
        [, weekNum, dayKey, timeIndex] = parts;
      }

      const dayIndex = weekDays.findIndex(day => day.key === dayKey);
      const timeSlot = timeSlots[parseInt(timeIndex)];
      const [startTimeStr, endTimeStr] = timeSlot.split('-');
      const startTime = `${startTimeStr}:00`;
      const endTime = `${endTimeStr}:00`;

      let scheduleDate = null;
      if (!timetable.isWeekly) {
        // 对于日期范围课表，使用cellKey中的周数信息计算日期
        const targetWeek = weekNum ? parseInt(weekNum) : currentWeek;
        const startDate = dayjs(timetable.startDate);
        const anchorMonday = startDate.startOf('week');
        const weekStart = anchorMonday.add(targetWeek - 1, 'week');
        const currentDate = weekStart.add(dayIndex, 'day');
        scheduleDate = currentDate.format('YYYY-MM-DD');
      }

      const payload = {
        studentName: batchStudentName.trim(),
        dayOfWeek: dayKey.toUpperCase(),
        startTime,
        endTime,
        note: '批量添加',
      };

      if (scheduleDate) {
        payload.scheduleDate = scheduleDate;
      }

      schedulesToCreate.push(payload);
    });

    try {
      let response;
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例批量API
        response = await createInstanceSchedulesBatch(currentWeekInstance.id, schedulesToCreate);
      } else {
        // 模板视图：使用原有批量API
        response = await createSchedulesBatch(timetableId, schedulesToCreate);
      }
      
      if (response.success) {
        setBatchScheduleModalVisible(false);
        setBatchStudentName('');
        setSelectedCells(new Set());
        setMultiSelectMode(false);
        
        if (viewMode === 'instance' && currentWeekInstance) {
          // 实例视图：直接刷新实例数据，避免影响固定课表
          const r = await getInstanceSchedules(currentWeekInstance.id);
          if (r && r.success) {
            setAllSchedules(r.data || []);
            setCurrentWeekInstance(prev => ({
              ...prev,
              schedules: r.data || []
            }));
          }
        } else {
          // 模板视图：需要刷新数据
          await refreshSchedulesQuietly();
        }
        
        message.success(`成功添加 ${schedulesToCreate.length} 个课程安排`);
      } else {
        message.error(response.message || '批量添加失败');
      }
    } catch (error) {
      message.error('网络错误，批量添加失败');
    }
  };

  const cancelBatchSchedule = () => {
    setBatchScheduleModalVisible(false);
    setBatchStudentName('');
  };



  // Get the date range for the current week based on Monday as the first day
  const getCurrentWeekDates = () => {
    if (!timetable || timetable.isWeekly) return { start: null, end: null };

    const startDate = dayjs(timetable.startDate);

    // 找到起始日期所在周的周一（与后端逻辑一致）
    const anchorMonday = startDate.startOf('week');

    // 计算当前周的开始和结束日期
    const weekStart = anchorMonday.add(currentWeek - 1, 'week');
    const weekEnd = weekStart.add(6, 'day');

    return { start: weekStart, end: weekEnd };
  };

  // 获取当前周的课程数据
  const currentWeekSchedules = useMemo(() => {
    if (!allSchedules || allSchedules.length === 0) return [];
    
    // 日期范围课表：需要按当前周过滤
    if (!timetable?.isWeekly && timetable?.startDate && timetable?.endDate) {
      const startDate = dayjs(timetable.startDate);
      const anchorMonday = startDate.startOf('week');
      const weekStart = anchorMonday.add(currentWeek - 1, 'week');
      const weekEnd = weekStart.add(6, 'day');
      
      // 过滤出当前周的课程
      return allSchedules.filter(schedule => {
        if (!schedule.scheduleDate) return false;
        const scheduleDate = dayjs(schedule.scheduleDate);
        return scheduleDate.isSameOrAfter(weekStart, 'day') && scheduleDate.isSameOrBefore(weekEnd, 'day');
      });
    }
    
    // 周固定课表：直接使用allSchedules
    return allSchedules;
  }, [allSchedules, currentWeek, timetable]);

  const legendStats = useMemo(() => {
    if (viewMode !== 'instance' || !timetable?.isWeekly) {
      return null;
    }

    const stats = {
      added: 0,
      modified: 0,
      cancelled: 0,
    };

    const toKey = (s) => `${s.dayOfWeek.toUpperCase()}|${s.startTime.slice(0, 5)}|${s.endTime.slice(0, 5)}`;
    const templateMap = new Map(templateSchedules.map(s => [toKey(s), s]));
    const instanceMap = new Map(allSchedules.map(s => [toKey(s), s]));

    // 计算新增和已修改
    for (const [key, instanceSchedule] of instanceMap.entries()) {
      const templateSchedule = templateMap.get(key);
      if (!templateSchedule) {
        stats.added++;
      } else {
        const isContentSame =
          (templateSchedule.studentName || '') === (instanceSchedule.studentName || '') &&
          (templateSchedule.subject || '') === (instanceSchedule.subject || '') &&
          (templateSchedule.note || '') === (instanceSchedule.note || '');
        if (!isContentSame) {
          stats.modified++;
        }
      }
    }

    // 计算已取消
    for (const [key, templateSchedule] of templateMap.entries()) {
      if (!instanceMap.has(key)) {
        stats.cancelled++;
      }
    }

    return stats;
  }, [allSchedules, templateSchedules, viewMode, timetable?.isWeekly]);

  // 计算一周总课时数和节数
  const weeklyStats = useMemo(() => {
    // 根据当前视图模式选择数据源
    let schedules = [];
    
    if (viewMode === 'instance' && currentWeekInstance?.schedules) {
      // 当前周实例模式：使用实例课程数据
      schedules = currentWeekInstance.schedules;
    } else if (viewMode === 'instance') {
      // 实例模式但没有schedules数据时，使用allSchedules
      schedules = allSchedules || [];
    } else {
      // 固定课表模式：使用当前周课程数据
      schedules = currentWeekSchedules;
    }
    
    // 过滤掉占用时间段
    const validSchedules = schedules.filter(schedule => !schedule.isTimeBlock);
    
    if (!validSchedules.length) return { hours: 0, count: 0, students: 0 };
    
    const totalHours = validSchedules.reduce((total, schedule) => {
      const startTime = dayjs(schedule.startTime, 'HH:mm:ss');
      const endTime = dayjs(schedule.endTime, 'HH:mm:ss');
      const duration = endTime.diff(startTime, 'hour', true); // 精确到小数
      return total + duration;
    }, 0);
    
    // 计算学员数量（去重）
    const uniqueStudents = new Set();
    validSchedules.forEach(schedule => {
      if (schedule.studentName) {
        uniqueStudents.add(schedule.studentName);
      }
    });
    
    return {
      hours: totalHours,
      count: validSchedules.length,
      students: uniqueStudents.size
    };
  }, [currentWeekSchedules, currentWeekInstance?.schedules, viewMode]);

  // 本周请假课时数
  const [weeklyLeaveCount, setWeeklyLeaveCount] = useState(0);
  // 记录请假时段，用于网格点击时区分"取消/请假"
  const [leaveSlotMap, setLeaveSlotMap] = useState(new Map());
  
  // 获取请假课时数
  const fetchLeaveCount = useCallback(async () => {
    if (viewMode === 'instance' && timetable?.isWeekly && currentWeekInstance?.id) {
      // 检查当前查看的实例是否是真实的"本周"
      const isViewingActualCurrentWeek = currentWeekInstance.weekStartDate && 
        dayjs(currentWeekInstance.weekStartDate).isSame(dayjs().startOf('week'), 'day');

      if (isViewingActualCurrentWeek) {
        try {
          // 只在查看真实本周时调用此API
          const response = await getCurrentWeekInstanceIncludingLeaves(timetable.id);
          if (response && response.success && response.data && response.data.schedules) {
            const leaveCount = response.data.schedules.filter(s => s.isOnLeave === true).length;
            setWeeklyLeaveCount(leaveCount);
          } else {
            setWeeklyLeaveCount(0);
          }
        } catch (error) {
          console.error('获取请假课时数失败:', error);
          setWeeklyLeaveCount(0);
        }
      } else {
        // 查看其它周时，请假计数为0（因为没有API获取其它周的请假数据）
        setWeeklyLeaveCount(0);
      }
    } else {
      // 非实例视图模式，请假计数为0
      setWeeklyLeaveCount(0);
    }
  }, [viewMode, timetable?.isWeekly, timetable?.id, currentWeekInstance?.id, currentWeekInstance?.weekStartDate]);

  // 当相关状态变化时重新获取请假课时数
  useEffect(() => {
    fetchLeaveCount();
    // 同步刷新请假时段映射
    (async () => {
      try {
        if (viewMode === 'instance' && timetable?.isWeekly && currentWeekInstance?.id) {
          const response = await getCurrentWeekInstanceIncludingLeaves(timetable.id);
          if (response && response.success && response.data && Array.isArray(response.data.schedules)) {
            const map = new Map();
            response.data.schedules.filter(s => s.isOnLeave).forEach(s => {
              const dayKey = (s.dayOfWeek || '').toLowerCase();
              const timeKey = `${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`;
              map.set(`${dayKey}|${timeKey}`, { studentName: s.studentName || '', scheduleId: s.id, type: '请假' });
            });
            setLeaveSlotMap(map);
          } else {
            setLeaveSlotMap(new Map());
          }
        } else {
          setLeaveSlotMap(new Map());
        }
      } catch (e) {
        setLeaveSlotMap(new Map());
      }
    })();
  }, [fetchLeaveCount]);

  const handleWeekChange = (week) => {
    setCurrentWeek(week);
  };

  const colorPalette = [
    'rgba(255,183,197,0.45)', // pink
    'rgba(255,223,186,0.45)', // peach
    'rgba(255,255,186,0.45)', // lemon
    'rgba(186,255,201,0.45)', // mint
    'rgba(186,225,255,0.45)', // sky
    'rgba(218,198,255,0.45)', // lavender
    'rgba(255,200,221,0.45)', // rose
    'rgba(255,236,179,0.45)', // apricot
    'rgba(197,225,165,0.45)', // light green
    'rgba(179,229,252,0.45)', // light blue
    'rgba(248,209,215,0.45)', // blush
    'rgba(204,236,239,0.45)', // pale aqua
    'rgba(220,210,255,0.45)', // pale violet
    'rgba(255,214,214,0.45)', // light coral
    'rgba(255,242,204,0.45)', // cream
    'rgba(210,245,228,0.45)'  // aqua mint
  ];

  const textColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];

  const studentColorMap = new Map();
  const studentTextColorMap = new Map();

  // 如果课表信息未加载，显示完整页面布局但数据为空
  const isInitialLoading = !timetable;
  
  // 在切换过程中使用临时数据，否则使用当前数据
  const displaySchedules = ((switchToInstanceLoading || switchToTemplateLoading) && tempSchedules.length > 0 
    ? tempSchedules 
    : allSchedules).filter(s => !s.isOnLeave);
  
  const displayViewMode = (switchToInstanceLoading || switchToTemplateLoading) && tempViewMode 
    ? tempViewMode 
    : viewMode;

  const allStudentNames = [...new Set(displaySchedules.map(s => s.studentName).filter(Boolean))];
  allStudentNames.forEach((name, index) => {
    studentColorMap.set(name, colorPalette[index % colorPalette.length]);
    studentTextColorMap.set(name, textColorPalette[index % textColorPalette.length]);
  });
  const generateColumns = () => {
    const weekDates = getCurrentWeekDates();

    const columns = [
      {
        title: (
          <span
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleTimeCellClick('HEADER')}
          >
            时间
          </span>
        ),
        dataIndex: 'time',
        key: 'time',
        className: 'timetable-time-column',
        render: (time) => (
          <div 
            className="time-cell" 
            style={{ cursor: 'pointer' }}
            onClick={() => handleTimeCellClick(time)}
          >
            {time.split('-').map((t, i) => (
              <div key={i} className="time-part">{t}</div>
            ))}
          </div>
        )
      },
    ];

    weekDays.forEach((day, index) => {
      let columnTitle;
      let isToday = false;
      
      // 根据不同的视图模式显示列头
      if (viewMode === 'instance' && currentWeekInstance) {
        // 实例视图：使用实例的开始日期
        const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
        const currentDate = instanceStartDate.clone().add(index, 'day');
        isToday = currentDate.isSame(dayjs(), 'day');
        columnTitle = (
          <div
            style={{ 
              textAlign: 'center', 
              cursor: timetable.isArchived ? 'default' : 'pointer'
            }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div className="day-date">
              {currentDate.format('MM/DD')}
            </div>
          </div>
        );
      } else if (!timetable.isWeekly && weekDates && weekDates.start) {
        // 日期范围课表
        const currentDate = weekDates.start.clone().add(index, 'day');
        isToday = currentDate.isSame(dayjs(), 'day');
        columnTitle = (
          <div
            style={{ 
              textAlign: 'center', 
              cursor: timetable.isArchived ? 'default' : 'pointer'
            }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
            <div className="day-date">
              {currentDate.format('MM/DD')}
            </div>
          </div>
        );
      } else {
        // 固定课表视图，只显示星期几，不显示日期
        const today = dayjs();
        const dayOfWeek = today.day();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayOfThisWeek = today.clone().subtract(daysFromMonday, 'day');
        const currentDate = mondayOfThisWeek.clone().add(index, 'day');
        isToday = currentDate.isSame(today, 'day');
        
        columnTitle = (
          <div
            style={{ 
              textAlign: 'center', 
              cursor: timetable.isArchived ? 'default' : 'pointer'
            }}
            onClick={!timetable.isArchived ? () => handleShowDayCourses(day, index) : undefined}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {day.label}
            </div>
          </div>
        );
      }

      columns.push({
        title: columnTitle,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onHeaderCell: () => ({
          className: isToday ? 'today-header' : '',
          style: isToday
            ? { backgroundColor: '#4a90e2', color: '#ffffff', fontWeight: 500 }
            : undefined,
        }),
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: (text, record) => {
          const schedules = displaySchedules.filter(s => {
            // 注意：这里不过滤占用时间段，因为需要在课表上显示
            
            const scheduleStartTime = s.startTime.substring(0, 5);
            const scheduleEndTime = s.endTime.substring(0, 5);
            const timeKey = `${scheduleStartTime}-${scheduleEndTime}`;
            
            // 解析课程表时间槽和课程时间
            const [slotStart, slotEnd] = record.time.split('-');
            const slotStartTime = dayjs(slotStart, 'HH:mm');
            const slotEndTime = dayjs(slotEnd, 'HH:mm');
            const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
            const scheduleEnd = dayjs(scheduleEndTime, 'HH:mm');
            
            // 检查课程是否在这个时间槽内
            // 课程的开始时间必须在时间槽内，并且课程的结束时间不能超过时间槽的结束时间
            const isInTimeSlot = scheduleStart.isSameOrAfter(slotStartTime) && 
                                scheduleStart.isBefore(slotEndTime) &&
                                scheduleEnd.isSameOrBefore(slotEndTime);
            
            // 特殊处理：如果课程结束时间等于时间槽结束时间，也应该匹配（如14:30-15:00匹配14:00-15:00）
            const isExactEndMatch = scheduleStart.isSameOrAfter(slotStartTime) && 
                                  scheduleStart.isBefore(slotEndTime) &&
                                  scheduleEnd.isSame(slotEndTime);
            
            const finalTimeMatch = isInTimeSlot || isExactEndMatch;
            
            // 时间不在槽内，过滤掉
            if (!finalTimeMatch) {
              return false;
            }
            
            // 根据课表类型进行不同的过滤（优先检查课表类型，而不是仅依赖viewMode）
            // 日期范围课表：始终按实际日期过滤
            if (!timetable.isWeekly) {
              const weekDatesForFilter = getCurrentWeekDates();
              if (weekDatesForFilter && weekDatesForFilter.start) {
                const targetDate = weekDatesForFilter.start.add(index, 'day').format('YYYY-MM-DD');
                return s.scheduleDate === targetDate;
              }
              return false;
            }
            
            // 周固定课表：根据视图模式过滤
            if (displayViewMode === 'instance') {
              // 实例视图：优先按具体日期过滤
              if (s.scheduleDate && currentWeekInstance) {
                const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
                const currentDate = instanceStartDate.add(index, 'day');
                const targetDate = currentDate.format('YYYY-MM-DD');
                const dateMatch = s.scheduleDate === targetDate;
                return dateMatch;
              }
              // 回退到按星期几过滤（兼容性）
              const dayMatch = (s.dayOfWeek || '').toLowerCase() === day.key;
              return dayMatch;
            } else {
              // 模板视图：按星期几过滤
              const dayMatch = (s.dayOfWeek || '').toLowerCase() === day.key;
              return dayMatch;
            }
          });

          if (!schedules || schedules.length === 0) {
            const pagePrefix = timetable?.isWeekly ? 'weekly' : `week-${currentWeek}`;
            const cellKey = `${pagePrefix}-${day.key}-${record.key}`;
            const isSelected = selectedCells.has(cellKey);

            if (timetable?.isArchived) {
              return <div style={{ height: '48px' }} />;
            }

            // 检查模板中是否存在该时间段，且实例中该时间段没有课程（或课程是请假状态）
            const templateScheduleExists = displayViewMode === 'instance' &&
              Array.isArray(templateSchedules) &&
              templateSchedules.some(template => {
                const timeKey = record.time;
                const dayKey = day.key;
                const templateTimeKey = `${template.startTime.substring(0, 5)}-${template.endTime.substring(0, 5)}`;
                return template.dayOfWeek.toLowerCase() === dayKey && templateTimeKey === timeKey;
              }) &&
              (!schedules || schedules.length === 0 || schedules.every(schedule => schedule.isOnLeave));
            

            const templateScheduleForCell = displayViewMode === 'instance' && Array.isArray(templateSchedules)
              ? templateSchedules.find(template => {
                  const templateTimeKey = `${template.startTime.substring(0, 5)}-${template.endTime.substring(0, 5)}`;
                  return template.dayOfWeek.toLowerCase() === day.key && templateTimeKey === record.time;
                })
              : null;

            const emptyCellStyle = {
              height: '48px',
              cursor: 'pointer',
              border: templateScheduleExists ? '1px dashed #ff4d4f' : undefined,
            };

            const handleCellClick = (e) => {
              if (multiSelectMode) {
                e.stopPropagation();
                handleCellSelection(cellKey, index, record.key);
              } else if (deleteMode) {
                // 删除模式下，空白单元格不可点击
                e.stopPropagation();
                return;
              } else if (moveMode) {
                e.stopPropagation();
                handleSelectMoveTarget(day.key, record.key);
              } else if (copyMode) {
                e.stopPropagation();
                handleSelectCopyTarget(day.key, record.key);
              } else if (swapMode) {
                e.stopPropagation();
                // 在调换模式下，需要点击有内容的单元格
                const schedule = getScheduleForCell(day.key, record.key);
                if (schedule && schedule.id !== scheduleToSwap?.id) {
                  handleSelectSwapTarget(schedule);
                }
              }
            };

            const handleOpenChange = (newOpen) => {
              if (!multiSelectMode) {
                setOpenPopoverKey(newOpen ? cellKey : null);
              }
            };

            const handleAddSchedule = async (dayKey, timeIndex, scheduleInfo) => {
              const studentName = scheduleInfo.studentName;
              const isHalfHour = scheduleInfo.isHalfHour || false;
              const halfHourPosition = scheduleInfo.halfHourPosition || 'first';
              
              const trimmedName = studentName.trim();
              if (!trimmedName) {
                message.warning('学生姓名不能为空');
                return;
              }

              const [startTimeStr, endTimeStr] = record.time.split('-');
              let startTime = dayjs(startTimeStr, 'HH:mm');
              
              // 如果用户选择了半小时，根据位置调整开始时间
              if (isHalfHour && halfHourPosition === 'second') {
                startTime = startTime.add(30, 'minute'); // 后半小时：从时间槽开始时间+30分钟
              }
              // 前半小时：从时间槽开始时间（保持原时间）
              
              // 根据选择的时长计算结束时间
              let endTime;
              if (isHalfHour) {
                endTime = startTime.add(30, 'minute');
              } else {
                endTime = startTime.add(60, 'minute');
              }
              
              const startTimeFormatted = `${startTime.format('HH:mm')}:00`;
              const endTimeFormatted = `${endTime.format('HH:mm')}:00`;

              let scheduleDate = null;
              if (timetable.isWeekly && currentWeekInstance) {
                const instanceStartDate = dayjs(currentWeekInstance.weekStartDate);
                const targetDate = instanceStartDate.add(index, 'day');
                scheduleDate = targetDate.format('YYYY-MM-DD');
              } else if (!timetable.isWeekly && weekDates && weekDates.start) {
                const currentDate = weekDates.start.add(index, 'day');
                scheduleDate = currentDate.format('YYYY-MM-DD');
              }

              const payload = {
                studentName: trimmedName,
                dayOfWeek: day.key.toUpperCase(),
                startTime: startTimeFormatted,
                endTime: endTimeFormatted,
                note: `手动添加 (${isHalfHour ? '30分钟' : '1小时'})`,
              };

              if (scheduleDate) {
                payload.scheduleDate = scheduleDate;
              }

              setAddLoading(true);
              try {
                let resp;
                if (viewMode === 'instance' && currentWeekInstance) {
                  // 实例视图：直接在实例中创建课程
                  resp = await createInstanceSchedule(currentWeekInstance.id, payload);
                } else {
                  // 模板视图：在固定课表中创建模板课程
                  resp = await createSchedule(timetableId, payload);
                }
                
                if (resp.success) {
                  // 立即将新课程添加到当前状态
                  const newSchedule = resp.data || {
                    id: Date.now(), // 临时ID
                    studentName: trimmedName,
                    dayOfWeek: day.key.toUpperCase(),
                    startTime: startTimeFormatted,
                    endTime: endTimeFormatted,
                    note: payload.note,
                    scheduleDate: payload.scheduleDate
                  };
                  
                  setAllSchedules(prev => [...prev, newSchedule]);
                  setOpenPopoverKey(null);
                  
                  // 异步刷新数据
                  const refreshData = async () => {
                    try {
                  if (viewMode === 'instance' && currentWeekInstance) {
                    const r = await getInstanceSchedules(currentWeekInstance.id);
                    if (r && r.success) {
                      setAllSchedules(r.data || []);
                      setCurrentWeekInstance(prev => ({
                        ...prev,
                        schedules: r.data || []
                      }));
                    }
                  } else {
                    invalidateTimetableCache(timetableId);
                    await refreshSchedulesQuietly();
                  }
                    } catch (error) {
                      console.error('异步刷新数据失败:', error);
                    }
                  };
                  
                  setTimeout(refreshData, 200);
                  message.success('添加成功');
                } else {
                  message.error(resp.message || '添加失败');
                }
              } catch (err) {
                message.error('网络错误，添加失败');
              } finally {
                setAddLoading(false);
              }
            };

            if (multiSelectMode) {
              return (
                <div
                  style={{
                    ...emptyCellStyle,
                    backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                    border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: isSelected ? '#1890ff' : '#ccc'
                  }}
                  onClick={handleCellClick}
                  title={isSelected ? '点击取消选择' : '点击选择'}
                >
                  {isSelected ? '✓' : ''}
                </div>
              );
            }

            if (moveMode) {
              const isSelected = selectedMoveTarget === cellKey;
              return (
                                  <div
                    style={{
                      ...emptyCellStyle,
                      backgroundColor: isSelected ? '#e6f4ff' : 'transparent',
                      border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border || '1px solid #f0f0f0',
                      position: 'relative'
                    }}
                    onClick={handleCellClick}
                    title={isSelected ? '点击取消选择' : '点击选择此处移动课程'}
                  >
                    {/* 右上角的单选钮 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '12px',
                        height: '12px',
                        border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        borderRadius: '50%', // 圆形单选钮
                        backgroundColor: isSelected ? '#1890ff' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      {isSelected && (
                        <div style={{ 
                          width: '4px', 
                          height: '4px', 
                          backgroundColor: 'white', 
                          borderRadius: '50%' 
                        }} />
                      )}
                    </div>
                  </div>
              );
            }

            if (copyMode) {
              const isSelected = selectedCopyTargets.has(cellKey);
              
              return (
                <div
                  style={{
                    ...emptyCellStyle,
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    border: isSelected ? '2px solid #1890ff' : emptyCellStyle.border || '1px solid #f0f0f0',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start', // Align to top to control position with padding
                    justifyContent: 'center',
                    paddingTop: isSelected ? '25px' : '0', // Push text down
                  }}
                  onClick={handleCellClick}
                  title={isSelected ? '点击取消选择' : `复制 "${scheduleToCopy?.studentName}" 到此`}
                >
                  {/* 显示被复制的学生姓名 */}
                  {isSelected && scheduleToCopy && (
                    <span style={{ fontSize: '12px', color: '#722ed1' }}>
                      {scheduleToCopy.studentName}
                    </span>
                  )}
                  {/* 右上角的小复选框 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '12px',
                      height: '12px',
                      border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '2px',
                      backgroundColor: isSelected ? '#1890ff' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: 'bold',
                      color: 'white',
                      pointerEvents: 'none' // 防止复选框阻止父元素的点击事件
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </div>
                </div>
              );
            }

            // 生成时间信息
            const timeInfo = timetable.isWeekly 
              ? `星期${dayMap[day.key.toUpperCase()] || day.key}, ${record.time}`
              : weekDates && weekDates.start 
                ? `${weekDates.start.add(index, 'day').format('MM/DD')}, ${record.time}`
                : `${record.time}`;

            const slotKey = `${day.key}|${record.time}`;
            const leaveInfo = leaveSlotMap.get(slotKey);
            const cancelInfo = templateScheduleExists && templateScheduleForCell ? {
              studentName: leaveInfo ? leaveInfo.studentName : templateScheduleForCell.studentName,
              type: leaveInfo ? (leaveInfo.type || '请假') : '取消',
              timeInfo,
              scheduleId: leaveInfo ? leaveInfo.scheduleId : templateScheduleForCell.id
            } : null;
            
            // 判断是否为固定可排课时段（在周实例视图且有模板课表时）
            const isFixedTimeSlot = viewMode === 'instance' && timetable?.isWeekly && templateScheduleForCell;

            return (
              <Popover
                placement={getSmartPlacement(index, record.key)}
                title={null}
                content={
                  cancelInfo ? (
                    <div style={{ width: 'min(280px, 92vw)', maxWidth: '92vw', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                      <CancelledOrLeavePopoverContent 
                        info={cancelInfo} 
                        onClose={() => handleOpenChange(false)}
                        onRestore={() => handleRestoreSchedule(cancelInfo)}
                        restoreLoading={restoreLoading}
                      />
                      <div style={{ padding: '0 8px' }}>
                        <NewSchedulePopoverContent 
                          onAdd={(scheduleInfo) => handleAddSchedule(day.key, record.key, scheduleInfo)} 
                          onBlock={(scheduleInfo) => handleBlockTime(day.key, record.key, scheduleInfo)}
                          onCancel={() => handleOpenChange(false)} 
                          addLoading={addLoading} 
                          timeInfo={null} 
                          hasHalfHourCourse={false} 
                          studentOptions={studentOptions} 
                        />
                      </div>
                    </div>
                  ) : (
                    <NewSchedulePopoverContent 
                      onAdd={(scheduleInfo) => handleAddSchedule(day.key, record.key, scheduleInfo)} 
                      onBlock={(scheduleInfo) => handleBlockTime(day.key, record.key, scheduleInfo)}
                      onCancel={() => handleOpenChange(false)} 
                      addLoading={addLoading} 
                      timeInfo={timeInfo} 
                      hasHalfHourCourse={false} 
                      studentOptions={studentOptions} 
                    />
                  )
                }
                trigger={multiSelectMode ? "contextMenu" : (deleteMode ? "none" : "click")}
                open={!timetable?.isArchived && !deleteMode && (openPopoverKey === cellKey || (schedules.length > 0 && schedules.some(s => s.id === openScheduleId)))}
                onOpenChange={handleOpenChange}
                styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                overlayStyle={{ maxWidth: '90vw' }}
              >
                <div style={{ 
                  ...emptyCellStyle,
                  cursor: deleteMode ? 'not-allowed' : 'pointer',
                  opacity: deleteMode ? 0.5 : 1,
                  border: isFixedTimeSlot ? '2px dashed #52c41a' : emptyCellStyle.border,
                  backgroundColor: isFixedTimeSlot ? 'rgba(82, 196, 26, 0.05)' : emptyCellStyle.backgroundColor,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {isFixedTimeSlot && (
                    <div style={{
                      fontSize: '10px',
                      color: '#52c41a',
                      fontWeight: '500',
                      opacity: 0.7
                    }}>
                      可排课
                    </div>
                  )}
                </div>
              </Popover>
            );
          }


          const cellKey = `${day.key}-${record.key}`;
          const handleOpenChange = (newOpen) => {
            setOpenPopoverKey(newOpen ? cellKey : null);
            // 如果有课程，设置 openScheduleId
            if (newOpen && schedules.length > 0) {
              setOpenScheduleId(schedules[0].id);
            } else if (!newOpen) {
              setOpenScheduleId(null);
            }
          };

          const popoverContent = (
            <div style={{ width: '300px', maxWidth: '92vw' }}>
              {schedules.map((student, idx) => (
                <div key={student.id}>
                  <SchedulePopoverContent
                    schedule={student}
                    onDelete={() => handleDeleteSchedule(student.id)}
                    onUpdateName={(newName) => handleSaveStudentName(student, newName)}
                    onUpdateField={(fieldName, fieldValue, halfHourPosition) => handleUpdateScheduleField(student, fieldName, fieldValue, halfHourPosition)}
                    onMove={handleStartMove}
                    onCopy={handleStartCopy}
                    onSwap={handleStartSwap}
                    timetable={timetable}
                    isArchived={timetable?.isArchived}
                    onClose={() => {
                      setOpenPopoverKey(null);
                      setOpenScheduleId(null);
                    }}
                    deleteLoading={deleteLoading}
                    updateLoading={updateLoading}
                    templateSchedules={templateSchedules}
                    viewMode={viewMode}
                    allSchedules={allSchedules}
                    hasOtherHalf={false}
                    onRemoveSchedule={(id)=>{
                      // 内嵌请假成功后，从当前列表移除
                      setAllSchedules(prev=>prev.filter(s=>s.id!==id));
                    }}
                  />
                  {idx < schedules.length - 1 && <hr style={{ margin: '8px 0' }} />}
                </div>
              ))}
            </div>
          );

          // 在移动模式、复制模式、调换模式或多选模式下，有内容的单元格需要特殊处理
          // 在调换模式下，有内容的单元格可以点击选择要调换的目标课程
          if (moveMode || copyMode || multiSelectMode || swapMode) {
            const isSourceCellForMove = moveMode && scheduleToMove && schedules.some(s => s.id === scheduleToMove.id);
            const isSourceCellForCopy = copyMode && scheduleToCopy && schedules.some(s => s.id === scheduleToCopy.id);
            const isSourceCellForSwap = swapMode && scheduleToSwap && schedules.some(s => s.id === scheduleToSwap.id);
            const isSourceCell = isSourceCellForMove || isSourceCellForCopy || isSourceCellForSwap;

            let modeText = '此模式下无法操作已有课程';
            if (moveMode) modeText = '移动模式下无法操作已有课程';
            if (copyMode) modeText = '复制模式下无法操作已有课程';
            if (multiSelectMode) modeText = '多选模式下无法选择已有课程的单元格';

            let sourceCellTitle = '';
            if (isSourceCellForMove) sourceCellTitle = `正在移动: ${scheduleToMove.studentName}`;
            if (isSourceCellForCopy) sourceCellTitle = `正在复制: ${scheduleToCopy.studentName}`;
            if (isSourceCellForSwap) sourceCellTitle = `源课程: ${scheduleToSwap.studentName}`;

            const sourceHighlightColor = isSourceCellForCopy ? '#722ed1' : isSourceCellForSwap ? '#ff4d4f' : '#ff4d4f'; // 紫色用于复制，红色用于调换和移动
            const sourceHighlightBoxShadow = isSourceCellForCopy ? '0 0 8px rgba(114, 46, 209, 0.7)' : isSourceCellForSwap ? '0 0 8px rgba(82, 196, 26, 0.7)' : '0 0 8px rgba(255, 77, 79, 0.7)';

            // 检查是否有半小时课程
            const hasHalfHourCourse = schedules.some(s => isHalfHourSchedule(s));
            
            if (hasHalfHourCourse) {
              // 如果有半小时课程，需要根据课程的实际位置来渲染
              const [slotStart] = record.time.split('-');
              const slotStartTime = dayjs(slotStart, 'HH:mm');
              
              const firstHalfCourse = schedules.find(s => {
                if (!isHalfHourSchedule(s)) return false;
                const scheduleStartTime = s.startTime.substring(0, 5);
                const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
                const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
                return minutesFromSlotStart < 30;
              });
              
              const secondHalfCourse = schedules.find(s => {
                if (!isHalfHourSchedule(s)) return false;
                const scheduleStartTime = s.startTime.substring(0, 5);
                const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
                const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
                return minutesFromSlotStart >= 30;
              });
              
              const isSelectedForSwap = swapMode && selectedSwapTarget && schedules.some(s => s.id === selectedSwapTarget.id);
              
              return (
                <div 
                  style={{
                    height: '100%',
                    minHeight: '48px',
                    position: 'relative',
                    width: '100%',
                    cursor: swapMode ? 'pointer' : 'not-allowed',
                    border: isSourceCell ? `2px solid ${sourceHighlightColor}` : (isSelectedForSwap ? '2px solid #52c41a' : 'none'),
                    boxShadow: isSourceCell ? sourceHighlightBoxShadow : (isSelectedForSwap ? '0 0 8px rgba(82, 196, 26, 0.5)' : 'none'),
                    borderRadius: isSourceCell || isSelectedForSwap ? '4px' : '0',
                    opacity: isSourceCell ? 1 : (swapMode ? 1 : 0.6)
                  }}
                  onClick={(e) => {
                    if (swapMode && schedules.length > 0) {
                      e.stopPropagation();
                      const targetSchedule = schedules[0];
                      if (scheduleToSwap && targetSchedule.id === scheduleToSwap.id) {
                        handleCancelSwap();
                      } else {
                        const sourceIsHalfHour = isHalfHourSchedule(scheduleToSwap);
                        const targetIsHalfHour = isHalfHourSchedule(targetSchedule);
                        
                        if (sourceIsHalfHour !== targetIsHalfHour) {
                          message.warning('半小时课程只能和半小时课程调换，整小时课程只能和整小时课程调换');
                          return;
                        }
                        
                        handleSelectSwapTarget(targetSchedule);
                      }
                    }
                  }}
                >
                  {/* 前半小时区域 */}
                  {firstHalfCourse && (
                    <div style={{
                      ...getScheduleStyle(firstHalfCourse, studentColorMap.get(firstHalfCourse.studentName)),
                      height: '50%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                    }}>
                      {getDisplayName(firstHalfCourse)}
                    </div>
                  )}
                  
                  {/* 后半小时区域 */}
                  {secondHalfCourse && (
                    <div style={{
                      ...getScheduleStyle(secondHalfCourse, studentColorMap.get(secondHalfCourse.studentName)),
                      height: '50%',
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                    }}>
                      {getDisplayName(secondHalfCourse)}
                    </div>
                  )}
                </div>
              );
            }

            const isSelectedForSwap = swapMode && selectedSwapTarget && schedules.some(s => s.id === selectedSwapTarget.id);
            
            return (
              <div 
                style={{
                  height: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  cursor: swapMode ? 'pointer' : 'not-allowed',
                  // 高亮源单元格或已选择的调换目标
                  border: isSourceCell ? `2px solid ${sourceHighlightColor}` : (isSelectedForSwap ? '2px solid #52c41a' : 'none'),
                  boxShadow: isSourceCell ? sourceHighlightBoxShadow : (isSelectedForSwap ? '0 0 8px rgba(82, 196, 26, 0.5)' : 'none'),
                  borderRadius: isSourceCell || isSelectedForSwap ? '4px' : '0',
                  opacity: isSourceCell ? 1 : (swapMode ? 1 : 0.6)
                }}
                onClick={(e) => {
                  if (swapMode && schedules.length > 0) {
                    e.stopPropagation();
                    const targetSchedule = schedules[0];
                    if (scheduleToSwap && targetSchedule.id === scheduleToSwap.id) {
                      handleCancelSwap();
                    } else {
                      const sourceIsHalfHour = isHalfHourSchedule(scheduleToSwap);
                      const targetIsHalfHour = isHalfHourSchedule(targetSchedule);
                      
                      if (sourceIsHalfHour !== targetIsHalfHour) {
                        message.warning('半小时课程只能和半小时课程调换，整小时课程只能和整小时课程调换');
                        return;
                      }
                      
                      handleSelectSwapTarget(targetSchedule);
                    }
                  }
                }}
              >
                {schedules.map((student, idx) => {
                  // 在周实例视图中检查课程的特殊状态
                  const isBlocked = !!student.isTimeBlock;
                  const isManualAdded = viewMode === 'instance' && student.isManualAdded;
                  const isModified = viewMode === 'instance' && student.isModified;
                  
                  // 根据状态设置不同的样式
                  let borderColor = '';
                  let titleText = isSourceCell ? sourceCellTitle : modeText;
                  
                  // 占用时间段使用蓝色边框
                  if (isBlocked) {
                    borderColor = '#1890ff';
                    titleText = isSourceCell ? sourceCellTitle : `占用时间段 - ${modeText}`;
                  } else {
                    // 优先使用比较逻辑确定的边框颜色
                    const comparisonBorderColor = getScheduleBorderColor(student);
                    
                    // 完全依赖比较逻辑的结果，忽略 isModified 和 isManualAdded 标志
                    // 如果返回空字符串，说明与固定课表完全一致，不显示边框
                    borderColor = comparisonBorderColor;
                    
                    if (comparisonBorderColor === '#52c41a') {
                      titleText = isSourceCell ? sourceCellTitle : `手动添加的课程 - ${modeText}`;
                    } else if (comparisonBorderColor === '#faad14') {
                      titleText = isSourceCell ? sourceCellTitle : `已修改的课程 - ${modeText}`;
                    }
                  }
                  
                  return (
                    <div
                      key={student.id}
                      style={{
                        ...getScheduleStyle(student, studentColorMap.get(student.studentName)),
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        borderTop: idx > 0 ? '1px solid #fff' : 'none',
                        border: borderColor ? `2px solid ${borderColor}` : 'none',
                        position: 'relative',
                      }}
                      title={titleText}
                    >
                      {(() => {
                        const displayName = getDisplayName(student);
                        const isTruncated = displayName.length > 4;
                        const content = isTruncated ? `${displayName.substring(0, 3)}…` : displayName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? displayName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          }

          // 删除模式下的有内容单元格
          if (deleteMode) {
            const isSelected = selectedSchedulesForDelete.has(cellKey);
            
            // 检查是否有半小时课程
            const hasHalfHourCourse = schedules.some(s => isHalfHourSchedule(s));
            
            if (hasHalfHourCourse) {
              // 如果有半小时课程，需要根据课程的实际位置来渲染
              const [slotStart] = record.time.split('-');
              const slotStartTime = dayjs(slotStart, 'HH:mm');
              
              const firstHalfCourse = schedules.find(s => {
                if (!isHalfHourSchedule(s)) return false;
                const scheduleStartTime = s.startTime.substring(0, 5);
                const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
                const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
                return minutesFromSlotStart < 30;
              });
              
              const secondHalfCourse = schedules.find(s => {
                if (!isHalfHourSchedule(s)) return false;
                const scheduleStartTime = s.startTime.substring(0, 5);
                const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
                const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
                return minutesFromSlotStart >= 30;
              });
              
              return (
                <div
                  style={{
                    height: '100%',
                    minHeight: '48px',
                    position: 'relative',
                    width: '100%',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#fff7e6' : 'transparent',
                    border: isSelected ? '2px solid #fa8c16' : '1px solid #f0f0f0',
                    borderRadius: '4px',
                    // 调换模式下的边框样式
                    ...(swapMode && (() => {
                      const isSourceCell = scheduleToSwap && schedules.some(s => s.id === scheduleToSwap.id);
                      if (isSourceCell) {
                        return {
                          border: '2px solid #ff4d4f',
                          boxShadow: '0 0 8px rgba(255, 77, 79, 0.7)'
                        };
                      }
                      
                    // 检查是否已选择为调换目标
                    const isSelectedForSwap = selectedSwapTarget && schedules.some(s => s.id === selectedSwapTarget.id);
                    if (isSelectedForSwap) {
                      return {
                        border: '2px solid #52c41a',
                        boxShadow: '0 0 8px rgba(82, 196, 26, 0.5)'
                      };
                    }
                    
                    return {};
                    })())
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (swapMode) {
                      // 调换模式下选择课程
                      if (schedules.length > 0) {
                        const targetSchedule = schedules[0];
                        if (scheduleToSwap && targetSchedule.id === scheduleToSwap.id) {
                          // 如果点击的是源课程，取消调换
                          handleCancelSwap();
                        } else if (targetSchedule.id !== scheduleToSwap?.id) {
                          // 检查课程类型是否匹配
                          const sourceIsHalfHour = scheduleToSwap?.isHalfHour || false;
                          const targetIsHalfHour = targetSchedule?.isHalfHour || false;
                          
                          if (sourceIsHalfHour !== targetIsHalfHour) {
                            message.warning('半小时课程只能和半小时课程调换，整小时课程只能和整小时课程调换');
                            return;
                          }
                          
                          // 选择目标课程
                          handleSelectSwapTarget(targetSchedule);
                        }
                      }
                    } else {
                      handleDeleteCellSelection(cellKey, day.key, record.key);
                    }
                  }}
                  title={swapMode ? (
                    scheduleToSwap && schedules.some(s => s.id === scheduleToSwap.id) ? 
                      `源课程: ${scheduleToSwap.studentName} (点击取消)` : 
                      '点击选择要调换的课程'
                  ) : (isSelected ? '点击取消选择' : '点击选择删除')}
                >
                  {/* 前半小时区域 */}
                  {firstHalfCourse && (
                    <div style={{
                      ...getScheduleStyle(firstHalfCourse, studentColorMap.get(firstHalfCourse.studentName)),
                      height: '50%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                    }}>
                      {getDisplayName(firstHalfCourse)}
                    </div>
                  )}
                  
                  {/* 后半小时区域 */}
                  {secondHalfCourse && (
                    <div style={{
                      ...getScheduleStyle(secondHalfCourse, studentColorMap.get(secondHalfCourse.studentName)),
                      height: '50%',
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                    }}>
                      {getDisplayName(secondHalfCourse)}
                    </div>
                  )}
                  
                  {/* 右上角的删除选择标记 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '12px',
                      height: '12px',
                      border: isSelected ? '2px solid #fa8c16' : '1px solid #d9d9d9',
                      borderRadius: '2px',
                      backgroundColor: isSelected ? '#fa8c16' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      color: isSelected ? 'white' : '#ccc',
                      zIndex: 10
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </div>
                </div>
              );
            }
            
            return (
              <div
                style={{
                  height: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#fff7e6' : 'transparent',
                  border: isSelected ? '2px solid #fa8c16' : '1px solid #f0f0f0',
                  borderRadius: '4px',
                  position: 'relative',
                  // 调换模式下的边框样式
                  ...(swapMode && (() => {
                    const isSourceCell = scheduleToSwap && schedules.some(s => s.id === scheduleToSwap.id);
                    if (isSourceCell) {
                      return {
                        border: '2px solid #ff4d4f',
                        boxShadow: '0 0 8px rgba(255, 77, 79, 0.7)'
                      };
                    }
                    
                    // 检查是否已选择为调换目标
                    const isSelectedForSwap = selectedSwapTarget && schedules.some(s => s.id === selectedSwapTarget.id);
                    if (isSelectedForSwap) {
                      return {
                        border: '2px solid #52c41a',
                        boxShadow: '0 0 8px rgba(82, 196, 26, 0.5)'
                      };
                    }
                    
                    return {};
                  })())
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (swapMode) {
                    // 调换模式下选择课程
                    if (schedules.length > 0) {
                      const targetSchedule = schedules[0];
                      if (scheduleToSwap && targetSchedule.id === scheduleToSwap.id) {
                        // 如果点击的是源课程，取消调换
                        handleCancelSwap();
                      } else if (targetSchedule.id !== scheduleToSwap?.id) {
                        // 检查课程类型是否匹配
                        const sourceIsHalfHour = isHalfHourSchedule(scheduleToSwap);
                        const targetIsHalfHour = isHalfHourSchedule(targetSchedule);
                        
                        if (sourceIsHalfHour !== targetIsHalfHour) {
                          message.warning('半小时课程只能和半小时课程调换，整小时课程只能和整小时课程调换');
                          return;
                        }
                        
                        // 选择目标课程
                        handleSelectSwapTarget(targetSchedule);
                      }
                    }
                  } else {
                    handleDeleteCellSelection(cellKey, day.key, record.key);
                  }
                }}
                title={swapMode ? (
                  scheduleToSwap && schedules.some(s => s.id === scheduleToSwap.id) ? 
                    `源课程: ${scheduleToSwap.studentName} (点击取消)` : 
                    '点击选择要调换的课程'
                ) : (isSelected ? '点击取消选择' : '点击选择删除')}
              >
                {schedules.map((student, idx) => (
                  <div
                    key={student.id}
                    style={{
                      ...getScheduleStyle(student, studentColorMap.get(student.studentName)),
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      lineHeight: '1.2',
                      borderTop: idx > 0 ? '1px solid #fff' : 'none',
                      padding: '2px 4px',
                      textAlign: 'center'
                    }}
                  >
                    {(() => {
                      const displayName = getDisplayName(student);
                      return (
                        <span>
                          {displayName}
                        </span>
                      );
                    })()}
                  </div>
                ))}
                {/* 右上角的删除选择标记 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '12px',
                    height: '12px',
                    border: isSelected ? '2px solid #fa8c16' : '1px solid #d9d9d9',
                    borderRadius: '2px',
                    backgroundColor: isSelected ? '#fa8c16' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    color: isSelected ? 'white' : '#ccc'
                  }}
                >
                  {isSelected ? '✓' : ''}
                </div>
              </div>
            );
          }

          // 检查是否有半小时课程
          const hasHalfHourCourse = schedules.some(s => isHalfHourSchedule(s));
          
          if (hasHalfHourCourse) {
            // 如果有半小时课程，需要根据课程的实际位置来渲染
            // 分别查找前半小时和后半小时的课程
            const [slotStart] = record.time.split('-');
            const slotStartTime = dayjs(slotStart, 'HH:mm');
            
            const firstHalfCourse = schedules.find(s => {
              if (!isHalfHourSchedule(s)) return false;
              const scheduleStartTime = s.startTime.substring(0, 5);
              const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
              const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
              return minutesFromSlotStart < 30;
            });
            
            const secondHalfCourse = schedules.find(s => {
              if (!isHalfHourSchedule(s)) return false;
              const scheduleStartTime = s.startTime.substring(0, 5);
              const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
              const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
              return minutesFromSlotStart >= 30;
            })
            
            return (
              <div className="schedule-cell-content" style={{ position: 'relative', height: '48px' }}>
                {/* 前半小时区域 */}
                <div style={{ height: '50%', position: 'relative' }}>
                  {firstHalfCourse ? (
                    (() => {
                      const isBlocked = !!firstHalfCourse.isTimeBlock;
                      const isManualAdded = viewMode === 'instance' && firstHalfCourse.isManualAdded;
                      const isModified = viewMode === 'instance' && firstHalfCourse.isModified;
                      let borderColor = '';
                      let titleText = '点击查看详情或删除';
                      
                      // 占用时间段使用蓝色边框
                      if (isBlocked) {
                        borderColor = '#1890ff';
                        titleText = '占用时间段 - 点击查看详情或删除';
                      } else {
                        // 完全依赖比较逻辑的结果
                        const comparisonBorderColor = getScheduleBorderColor(firstHalfCourse);
                        borderColor = comparisonBorderColor;
                        
                        if (comparisonBorderColor === '#52c41a') {
                          titleText = '手动添加的课程 - 点击查看详情或删除';
                        } else if (comparisonBorderColor === '#faad14') {
                          titleText = '已修改的课程 - 点击查看详情或删除';
                        }
                      }
                      
                      return (
                        <Popover
                          placement={getSmartPlacement(index, record.key)}
                          title={null}
                          content={
                            <div>
                              <SchedulePopoverContent
                                schedule={firstHalfCourse}
                                onDelete={() => handleDeleteSchedule(firstHalfCourse.id)}
                                onUpdateName={(newName) => handleSaveStudentName(firstHalfCourse, newName)}
                                onUpdateField={(fieldName, fieldValue, halfHourPosition) => handleUpdateScheduleField(firstHalfCourse, fieldName, fieldValue, halfHourPosition)}
                                onMove={handleStartMove}
                                onCopy={handleStartCopy}
                                onSwap={handleStartSwap}
                                timetable={timetable}
                                isArchived={timetable?.isArchived}
                                onClose={() => {
                      setOpenPopoverKey(null);
                      setOpenScheduleId(null);
                    }}
                                deleteLoading={deleteLoading}
                                updateLoading={updateLoading}
                                templateSchedules={templateSchedules}
                                viewMode={viewMode}
                                allSchedules={allSchedules}
                                hasOtherHalf={!!secondHalfCourse}
                                onRemoveSchedule={(id) => {
                                  setAllSchedules(prev => prev.filter(s => s.id !== id));
                                }}
                              />
                            </div>
                          }
                          trigger="click"
                          open={!swapMode && (openPopoverKey === `${cellKey}-first-half` || openScheduleId === firstHalfCourse.id)}
                          onOpenChange={(newOpen) => {
                            if (!swapMode) {
                              setOpenPopoverKey(newOpen ? `${cellKey}-first-half` : null);
                              setOpenScheduleId(newOpen ? firstHalfCourse.id : null);
                            }
                          }}
                          styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                          overlayStyle={{ maxWidth: '90vw' }}
                    >
                      <div
                        style={{
                          ...getScheduleStyle(firstHalfCourse, studentColorMap.get(firstHalfCourse.studentName)),
                          height: '100%',
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          right: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          wordBreak: 'break-word',
                          lineHeight: '1.2',
                          cursor: 'pointer',
                          border: borderColor ? `2px solid ${borderColor}` : 'none',
                          boxSizing: 'border-box',
                          zIndex: 1
                        }}
                        title={titleText}
                      >
                        {(() => {
                          const displayName = getDisplayName(firstHalfCourse);
                          const isTruncated = displayName.length > 4;
                          const content = isTruncated ? `${displayName.substring(0, 3)}…` : displayName;
                          return (
                            <span
                              className={isTruncated ? 'student-name-truncated' : ''}
                              title={isTruncated ? displayName : undefined}
                            >
                              {content}
                            </span>
                          );
                        })()}
                      </div>
                    </Popover>
                  );
                })()
                  ) : (
                    // 前半小时区域为空，添加可点击的空白区域
                    <Popover
                      placement={getSmartPlacement(index, record.key)}
                      title={null}
                      content={
                        <NewSchedulePopoverContent 
                          onAdd={(scheduleInfo) => handleAddSchedule(day.key, record.key, { ...scheduleInfo, isHalfHour: true, halfHourPosition: 'first' })} 
                          onBlock={(scheduleInfo) => handleBlockTime(day.key, record.key, { ...scheduleInfo, isHalfHour: true, halfHourPosition: 'first' })}
                          onCancel={() => setOpenPopoverKey(null)} 
                          addLoading={addLoading} 
                          timeInfo={`${record.time} 前半小时`}
                          hasHalfHourCourse={false}
                          defaultIsHalfHour={true}
                          defaultHalfHourPosition="first"
                          fixedTimeSlot={`${record.time} 前半`}
                          studentOptions={studentOptions}
                          disableHalfHourSwitch={true}
                        />
                      }
                      trigger="click"
                      open={!timetable?.isArchived && openPopoverKey === `${cellKey}-first-half-empty`}
                      onOpenChange={(newOpen) => setOpenPopoverKey(newOpen ? `${cellKey}-first-half-empty` : null)}
                      styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                      overlayStyle={{ maxWidth: '90vw' }}
                    >
                      <div style={{
                        height: '100%',
                        cursor: 'pointer'
                      }} />
                    </Popover>
                  )}
                </div>
                
                {/* 后半小时区域 */}
                <div style={{ height: '50%', position: 'relative' }}>
                  {secondHalfCourse ? (
                    (() => {
                      const isBlocked = !!secondHalfCourse.isTimeBlock;
                      const isManualAdded = viewMode === 'instance' && secondHalfCourse.isManualAdded;
                      const isModified = viewMode === 'instance' && secondHalfCourse.isModified;
                      let borderColor = '';
                      let titleText = '点击查看详情或删除';
                      
                      // 占用时间段使用蓝色边框
                      if (isBlocked) {
                        borderColor = '#1890ff';
                        titleText = '占用时间段 - 点击查看详情或删除';
                      } else {
                        // 完全依赖比较逻辑的结果
                        const comparisonBorderColor = getScheduleBorderColor(secondHalfCourse);
                        borderColor = comparisonBorderColor;
                        
                        if (comparisonBorderColor === '#52c41a') {
                          titleText = '手动添加的课程 - 点击查看详情或删除';
                        } else if (comparisonBorderColor === '#faad14') {
                          titleText = '已修改的课程 - 点击查看详情或删除';
                        }
                      }
                      
                      return (
                        <Popover
                          placement={getSmartPlacement(index, record.key)}
                          title={null}
                          content={
                            <div>
                              <SchedulePopoverContent
                                schedule={secondHalfCourse}
                                onDelete={() => handleDeleteSchedule(secondHalfCourse.id)}
                                onUpdateName={(newName) => handleSaveStudentName(secondHalfCourse, newName)}
                                onUpdateField={(fieldName, fieldValue, halfHourPosition) => handleUpdateScheduleField(secondHalfCourse, fieldName, fieldValue, halfHourPosition)}
                                onMove={handleStartMove}
                                onCopy={handleStartCopy}
                                onSwap={handleStartSwap}
                                timetable={timetable}
                                isArchived={timetable?.isArchived}
                                onClose={() => {
                      setOpenPopoverKey(null);
                      setOpenScheduleId(null);
                    }}
                                deleteLoading={deleteLoading}
                                updateLoading={updateLoading}
                                templateSchedules={templateSchedules}
                                viewMode={viewMode}
                                allSchedules={allSchedules}
                                hasOtherHalf={!!firstHalfCourse}
                                onRemoveSchedule={(id) => {
                                  setAllSchedules(prev => prev.filter(s => s.id !== id));
                                }}
                              />
                            </div>
                          }
                          trigger="click"
                          open={!swapMode && (openPopoverKey === `${cellKey}-second-half` || openScheduleId === secondHalfCourse.id)}
                          onOpenChange={(newOpen) => {
                            if (!swapMode) {
                              setOpenPopoverKey(newOpen ? `${cellKey}-second-half` : null);
                              setOpenScheduleId(newOpen ? secondHalfCourse.id : null);
                            }
                          }}
                          styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                          overlayStyle={{ maxWidth: '90vw' }}
                    >
                      <div
                        style={{
                          ...getScheduleStyle(secondHalfCourse, studentColorMap.get(secondHalfCourse.studentName)),
                          height: '100%',
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          right: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          wordBreak: 'break-word',
                          lineHeight: '1.2',
                          cursor: 'pointer',
                          border: borderColor ? `2px solid ${borderColor}` : 'none',
                          boxSizing: 'border-box',
                          zIndex: 1
                        }}
                        title={titleText}
                      >
                        {(() => {
                          const displayName = getDisplayName(secondHalfCourse);
                          const isTruncated = displayName.length > 4;
                          const content = isTruncated ? `${displayName.substring(0, 3)}…` : displayName;
                          return (
                            <span
                              className={isTruncated ? 'student-name-truncated' : ''}
                              title={isTruncated ? displayName : undefined}
                            >
                              {content}
                            </span>
                          );
                        })()}
                      </div>
                    </Popover>
                  );
                })()
                  ) : (
                    // 后半小时区域为空，添加可点击的空白区域
                    <Popover
                      placement={getSmartPlacement(index, record.key)}
                      title={null}
                      content={
                        <NewSchedulePopoverContent 
                          onAdd={(scheduleInfo) => handleAddSchedule(day.key, record.key, { ...scheduleInfo, isHalfHour: true, halfHourPosition: 'second' })} 
                          onBlock={(scheduleInfo) => handleBlockTime(day.key, record.key, { ...scheduleInfo, isHalfHour: true, halfHourPosition: 'second' })}
                          onCancel={() => setOpenPopoverKey(null)} 
                          addLoading={addLoading} 
                          timeInfo={`${record.time} 后半小时`}
                          hasHalfHourCourse={false}
                          defaultIsHalfHour={true}
                          defaultHalfHourPosition="second"
                          fixedTimeSlot={`${record.time} 后半`}
                          studentOptions={studentOptions}
                          disableHalfHourSwitch={true}
                        />
                      }
                      trigger="click"
                      open={!timetable?.isArchived && openPopoverKey === `${cellKey}-second-half-empty`}
                      onOpenChange={(newOpen) => setOpenPopoverKey(newOpen ? `${cellKey}-second-half-empty` : null)}
                      styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
                      overlayStyle={{ maxWidth: '90vw' }}
                    >
                      <div style={{
                        height: '100%',
                        cursor: 'pointer'
                      }} />
                    </Popover>
                  )}
                </div>
              </div>
            );
          }
          
          // 没有半小时课程的情况，使用原来的逻辑
          return (
            <Popover
              placement={getSmartPlacement(index, record.key)}
              title={null}
              content={popoverContent}
              trigger="click"
              open={openPopoverKey === cellKey}
              onOpenChange={handleOpenChange}
              styles={{ body: { maxHeight: '80vh', maxWidth: '90vw', overflow: 'auto', overflowX: 'hidden' } }}
              overlayStyle={{ maxWidth: '90vw' }}
            >
              <div className="schedule-cell-content" style={{ position: 'relative', height: '48px' }}>
                {schedules.map((student, idx) => {
                  // 在周实例视图中检查课程的特殊状态
                  const isBlocked = !!student.isTimeBlock;
                  const isManualAdded = viewMode === 'instance' && student.isManualAdded;
                  const isModified = viewMode === 'instance' && student.isModified;
                  
                  // 根据状态设置不同的样式
                  let borderColor = '';
                  let titleText = '点击查看详情或删除';
                  
                  // 占用时间段使用蓝色边框
                  if (isBlocked) {
                    borderColor = '#1890ff';
                    titleText = '占用时间段 - 点击查看详情或删除';
                  } else {
                    // 完全依赖比较逻辑的结果
                    const comparisonBorderColor = getScheduleBorderColor(student);
                    borderColor = comparisonBorderColor;
                    
                    if (comparisonBorderColor === '#52c41a') {
                      titleText = '手动添加的课程 - 点击查看详情或删除';
                    } else if (comparisonBorderColor === '#faad14') {
                      titleText = '已修改的课程 - 点击查看详情或删除';
                    }
                  }
                  
                  // 计算课程在时间槽中的位置和高度
                  const isHalfHourCourse = isHalfHourSchedule(student);
                  const scheduleStartTime = student.startTime.substring(0, 5);
                  const [slotStart] = record.time.split('-');
                  const scheduleStart = dayjs(scheduleStartTime, 'HH:mm');
                  const slotStartTime = dayjs(slotStart, 'HH:mm');
                  const minutesFromSlotStart = scheduleStart.diff(slotStartTime, 'minute');
                  
                  // 计算高度和位置
                  const height = isHalfHourCourse ? '50%' : (schedules.length > 1 ? `${100 / schedules.length}%` : '100%');
                  const top = isHalfHourCourse ? (minutesFromSlotStart >= 30 ? '50%' : '0%') : `${(idx * 100) / schedules.length}%`;
                  
                  return (
                    <div
                      key={student.id}
                      style={{
                        ...getScheduleStyle(student, studentColorMap.get(student.studentName)),
                        height: height,
                        position: 'absolute',
                        top: top,
                        left: '0',
                        right: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        border: borderColor ? `2px solid ${borderColor}` : 'none',
                        zIndex: 1,
                        cursor: 'pointer'
                      }}
                      title={titleText}
                    >
                      {(() => {
                        const displayName = getDisplayName(student);
                        const isTruncated = displayName.length > 4;
                        const content = isTruncated ? `${displayName.substring(0, 3)}…` : displayName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? displayName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </Popover>
          );
        },
      });
    });

    return columns;
  };

  const tableDataSource = timeSlots.map((time, index) => ({
    key: index,
    time: time,
  }));

  // 为初始加载状态准备空数据
  const displayTimetable = timetable || { name: '课表加载中...', isWeekly: true };
  const displayTableDataSource = isInitialLoading ? 
    // 生成空的时间表格结构
    Array.from({ length: 11 }, (_, i) => {
      const hour = 9 + i;
      return {
        key: i,
        time: `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`
      };
    }) : tableDataSource;
  
  // 为初始加载生成与实际列结构一致的列头
  const generateInitialColumns = () => {
    const columns = [
      { 
        title: '时间', 
        dataIndex: 'time', 
        key: 'time', 
        className: 'timetable-time-column',
        render: (time) => (
          <div className="time-cell">
            {time.split('-').map((t, i) => (
              <div key={i} className="time-part">{t}</div>
            ))}
          </div>
        )
      }
    ];

    // 生成一周的列头，确保与实际数据加载后的结构一致
    weekDays.forEach((day, index) => {
      let columnTitle;
      let isToday = false;
      
      // 初始加载时，始终显示周几和当前周日期（类似固定课表但带日期）
      const today = dayjs();
      // 手动计算本周周一（更可靠的方法）
      const dayOfWeek = today.day(); // 0=周日, 1=周一, ..., 6=周六
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 距离周一的天数
      const mondayOfThisWeek = today.clone().subtract(daysFromMonday, 'day');
      const currentDate = mondayOfThisWeek.clone().add(index, 'day');
      isToday = currentDate.isSame(today, 'day');
      
      columnTitle = (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {day.label}
          </div>
          <div className="day-date">
            {currentDate.format('MM/DD')}
          </div>
        </div>
      );

      columns.push({
        title: columnTitle,
        dataIndex: day.key,
        key: day.key,
        className: 'timetable-day-column',
        onHeaderCell: () => ({
          className: isToday ? 'today-header' : '',
          style: isToday
            ? { backgroundColor: '#4a90e2', color: '#ffffff', fontWeight: 500 }
            : undefined,
        }),
        onCell: () => ({
          style: { padding: '0px' }
        }),
        render: () => null // 初始加载时不渲染内容
      });
    });

    return columns;
  };

  const displayColumns = isInitialLoading ? generateInitialColumns() : generateColumns();
  
  // 为初始加载提供默认值
  const displayWeeklyInstances = isInitialLoading ? [] : weeklyInstances;
  const displayWeeklyStats = isInitialLoading 
    ? { count: 0, students: 0 } 
    : (switchToInstanceLoading || switchToTemplateLoading) && tempWeeklyStats 
      ? tempWeeklyStats 
      : weeklyStats;
  const displayTotalWeeks = isInitialLoading ? 1 : totalWeeks;
  const displayCurrentWeek = isInitialLoading ? 1 : currentWeek;

  // 是否已存在"下周"实例（用于控制"删除下周课表"菜单项显示）
  const hasNextWeekInstance = useMemo(() => {
    try {
      if (!timetable?.isWeekly || !Array.isArray(weeklyInstances) || weeklyInstances.length === 0) {
        return false;
      }
      const nextMonday = dayjs().startOf('week').add(7, 'day');
      return weeklyInstances.some(inst => dayjs(inst.weekStartDate).isSame(nextMonday, 'day'));
    } catch (_) {
      return false;
    }
  }, [timetable, weeklyInstances]);
  return (
    <div className="page-container" onTouchStart={isInitialLoading ? undefined : handleTouchStart} onTouchEnd={isInitialLoading ? undefined : handleTouchEnd} style={{ overflowX: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => {
            navigate(-1);
          }}
          icon={<LeftOutlined style={{ fontSize: 20 }} />}
          style={{
            position: 'absolute',
            left: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Space align="center" size="large">
            <CalendarOutlined style={{ fontSize: '24px', color: '#8a2be2' }} />
            <h1 style={{ margin: 0 }}>{displayTimetable?.name}</h1>
          </Space>

        </div>
        {!isWeChatBrowser() && (
          <div style={{
            position: 'absolute',
            right: 0
          }}>
            <a
              onClick={handleExportTable}
              style={{
                color: '#1890ff',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 8px',
                textDecoration: 'none'
              }}
            >
              导出
            </a>
          </div>
        )}
      </div>

      {/* 图例说明和视图切换按钮 */}
      {(timetable || isInitialLoading) && (
        <div style={{ 
          marginBottom: '12px', 
          padding: '8px 12px', 
          backgroundColor: '#f6f8fa', 
          borderRadius: '6px',
          border: '1px solid #e1e4e8',
          fontSize: '12px',
          color: '#586069',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* 第一行：图例和视图切换按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* 在周固定课表的实例视图中显示图例和提示信息 */}
              {((timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate && displayViewMode === 'instance') || (isInitialLoading && displayViewMode === 'instance')) ? (
                <>
                  {/* 图例说明 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #52c41a',
                      borderRadius: '2px',
                      backgroundColor: 'transparent'
                    }}></div>
                    <span>新增 {legendStats ? `(${legendStats.added})` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #faad14',
                      borderRadius: '2px',
                      backgroundColor: 'transparent'
                    }}></div>
                    <span>修改 {legendStats ? `(${legendStats.modified})` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '1px dashed #ff4d4f',
                      borderRadius: '2px',
                      backgroundColor: 'transparent'
                    }}></div>
                    <span>取消 {legendStats ? `(${legendStats.cancelled})` : ''}</span>
                  </div>
                </>
              ) : null}
            </div>
            
            {/* 视图切换按钮和多选删除按钮 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* 视图切换按钮只在周固定课表中显示 */}
              {Boolean((timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) || (isInitialLoading && displayTimetable?.isWeekly)) ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Button
                      type="default"
                      size="small"
                    onClick={handleTopButtonClick}
                    disabled={switchToInstanceLoading || switchToTemplateLoading || instanceLoading}
                    style={displayViewMode === 'instance' ? { 
                      fontSize: '12px',
                      backgroundColor: '#fa8c16',
                      borderColor: '#fa8c16',
                      color: 'white',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRightStyle: 'none'
                    } : { 
                      fontSize: '12px',
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      borderRightStyle: 'none'
                    }}
                  >
                    {instanceWeekLabel}
                  </Button>
                  <Dropdown
                    disabled={switchToInstanceLoading || switchToTemplateLoading}
                    menu={{
                      items: [
                        // 第一项：本周课表
                        instanceWeekLabel !== '本周' && {
                          key: 'thisWeek',
                          label: '本周课表',
                          icon: <UndoOutlined />,
                          onClick: async () => {
                            // 检查是否有本周实例
                            const today = dayjs();
                            const thisWeekStart = today.startOf('week');
                            const thisWeekEnd = thisWeekStart.add(6, 'day');
                            const hasThisWeek = weeklyInstances.some(inst => {
                              const start = dayjs(inst.weekStartDate);
                              const end = dayjs(inst.weekEndDate);
                              return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
                            });
                            
                            if (!hasThisWeek) {
                              message.warning('本周没有实例，请先生成本周实例');
                              return;
                            }
                            
                            await switchToCurrentWeekInstance();
                            message.success('已切换到本周课表');
                          }
                        },
                        // 第二项：下周课表
                        instanceWeekLabel !== '下周' && {
                          key: 'nextWeek',
                          label: '下周课表',
                          icon: <UndoOutlined />,
                          disabled: (() => {
                            // 当本周没有实例时，下周选项置灰
                            const today = dayjs();
                            const thisWeekStart = today.startOf('week');
                            const thisWeekEnd = thisWeekStart.add(6, 'day');
                            const hasThisWeek = weeklyInstances.some(inst => {
                              const start = dayjs(inst.weekStartDate);
                              const end = dayjs(inst.weekEndDate);
                              return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
                            });
                            return !hasThisWeek;
                          })(),
                          onClick: async () => {
                            setInstanceLoading(true);
                            try {
                              // 统一逻辑：先获取最新实例列表
                              let listResp = await getWeeklyInstances(timetableId);
                              let instances = [];
                              if (listResp.success && Array.isArray(listResp.data)) {
                                instances = listResp.data.sort((a, b) => 
                                  dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
                                );
                                // 在这里更新 weeklyInstances 状态，确保UI同步
                                setWeeklyInstances(instances);
                              }

                              const nextMonday = dayjs().startOf('week').add(7, 'day');
                              let nextWeekIndex = instances.findIndex(inst => dayjs(inst.weekStartDate).isSame(nextMonday, 'day'));

                              let generated = false;
                              // 如果没有找到下周实例，则生成一个
                              if (nextWeekIndex === -1) {
                                const genResp = await generateNextWeekInstance(timetableId);
                                if (!genResp.success) {
                                  message.error(genResp.message || '生成下周课表失败');
                                  setInstanceLoading(false);
                                  return;
                                }
                                generated = true;
                                // 生成后，重新获取实例列表并更新状态
                                listResp = await getWeeklyInstances(timetableId);
                                if (listResp.success && Array.isArray(listResp.data)) {
                                  instances = listResp.data.sort((a, b) => 
                                    dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
                                  );
                                  setWeeklyInstances(instances);
                                  nextWeekIndex = instances.findIndex(inst => dayjs(inst.weekStartDate).isSame(nextMonday, 'day'));
                                }
                              }

                              // 切换到下周实例（传入最新的实例数组，避免状态未及时更新）
                              if (nextWeekIndex !== -1) {
                                await switchToWeekInstanceByIndex(nextWeekIndex, instances);
                                message.success(generated ? '已生成并切换到下周课表' : '已切换到下周课表');
                              } else {
                                message.error('无法找到或生成下周课表，请刷新重试');
                              }
                            } catch (e) {
                              const errorMsg = e.response?.data?.message || e.message || '操作失败，请稍后重试';
                              message.error(errorMsg);
                              console.error('Switch to next week failed:', e);
                            } finally {
                              setInstanceLoading(false);
                            }
                          }
                        },
                        // 删除下周课表（仅当真的存在下周实例时显示）
                        instanceWeekLabel !== '下周' && hasNextWeekInstance && {
                          key: 'deleteNextWeek',
                          label: '删除下周课表',
                          icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
                          onClick: async () => {
                            try {
                              // 检查是否存在下周实例
                              const listResp = await getWeeklyInstances(timetableId);
                              if (!listResp.success) {
                                message.error('获取实例列表失败');
                                return;
                              }
                              const instances = (listResp.data || []).sort((a, b) => dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate)));
                              const nextMonday = dayjs().startOf('week').add(7, 'day');
                              const nextWeekIndex = instances.findIndex(inst => dayjs(inst.weekStartDate).isSame(nextMonday, 'day'));
                              if (nextWeekIndex === -1) {
                                message.warning('未找到下周课表，无需删除');
                                return;
                              }
                              Modal.confirm({
                                title: '删除下周课表',
                                content: '确定删除下周课表实例及其所有课程吗？此操作不可恢复。',
                                okText: '删除',
                                okType: 'danger',
                                cancelText: '取消',
                                onOk: async () => {
                                  const resp = await deleteNextWeekInstance(timetableId);
                                  if (resp.success) {
                                    const refreshed = await getWeeklyInstances(timetableId);
                                    if (refreshed.success) {
                                      // 按日期排序，确保索引顺序正确
                                      const newInstances = (refreshed.data || []).sort((a, b) => 
                                        dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))
                                      );
                                      setWeeklyInstances(newInstances);
                                      
                                      // 重新计算当前实例的索引并更新currentWeekInstance
                                      if (currentWeekInstance?.id && newInstances.length > 0) {
                                        const newIndex = newInstances.findIndex(inst => inst.id === currentWeekInstance.id);
                                        if (newIndex >= 0) {
                                          // 当前实例仍然存在（删除的不是当前实例）
                                          setCurrentInstanceIndex(newIndex);
                                          setCurrentWeekInstance(newInstances[newIndex]);
                                          updateDisplayRange(newIndex, newInstances);
                                        } else {
                                          // 当前实例被删除了，查找本周实例
                                          const today = dayjs();
                                          const thisWeekStart = today.startOf('week');
                                          const thisWeekEnd = thisWeekStart.add(6, 'day');
                                          const thisWeekIndex = newInstances.findIndex(inst => {
                                            const start = dayjs(inst.weekStartDate);
                                            const end = dayjs(inst.weekEndDate);
                                            return start.isSame(thisWeekStart, 'day') && end.isSame(thisWeekEnd, 'day');
                                          });
                                          
                                          if (thisWeekIndex >= 0) {
                                            // 有本周实例，切换过去
                                            await switchToWeekInstanceByIndex(thisWeekIndex);
                                          } else if (newInstances.length > 0) {
                                            // 没有本周实例但有其他实例，切换到最后一个
                                            await switchToWeekInstanceByIndex(newInstances.length - 1);
                                          } else {
                                            // 没有任何实例，切换到模板视图
                                            await switchToTemplateView();
                                          }
                                        }
                                      } else if (newInstances.length === 0) {
                                        // 删除后没有任何实例，切换到模板视图
                                        await switchToTemplateView();
                                      }
                                    }
                                    message.success('已删除下周课表');
                                  } else {
                                    message.error(resp.message || '删除下周课表失败');
                                  }
                                }
                              });
                            } catch (e) {
                              message.error('删除失败，请稍后重试');
                            }
                          }
                        },
                        // 第二项：清空本周
                        {
                          key: 'clear',
                          label: '清空本周',
                          icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
                          onClick: async () => {
                            Modal.confirm({
                              title: '清空本周课表',
                              content: '确定清空当前周实例中的所有课程吗？此操作不可恢复。',
                              okText: '清空',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: async () => {
                                const resp = await clearCurrentWeekInstanceSchedules(timetableId);
                                if (resp.success) {
                                  message.success('已清空本周课表');
                                  // 直接刷新实例数据，避免影响固定课表
                                  if (currentWeekInstance && currentWeekInstance.id) {
                                    const r = await getInstanceSchedules(currentWeekInstance.id);
                                    if (r && r.success) {
                                      setAllSchedules(r.data || []);
                                      setCurrentWeekInstance(prev => ({
                                        ...prev,
                                        schedules: r.data || []
                                      }));
                                    }
                                  }
                                } else {
                                  message.error(resp.message || '操作失败');
                                }
                              }
                            });
                          }
                        },
                        {
                          key: 'restore',
                          label: '恢复固定课表',
                          icon: <UndoOutlined />,
                          onClick: async () => {
                            Modal.confirm({
                              title: '恢复固定课表',
                              content: '将完全清空本周实例中的所有课程，并重新从固定课表同步。此操作不可恢复，确定继续？',
                              okText: '恢复',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: async () => {
                                const res2 = await restoreCurrentWeekInstanceToTemplate(timetableId);
                                if (res2.success) {
                                  message.success('已完全恢复为固定课表');
                                  // 直接刷新实例数据，避免影响固定课表
                                  if (currentWeekInstance && currentWeekInstance.id) {
                                    const r = await getInstanceSchedules(currentWeekInstance.id);
                                    if (r && r.success) {
                                      setAllSchedules(r.data || []);
                                      setCurrentWeekInstance(prev => ({
                                        ...prev,
                                        schedules: r.data || []
                                      }));
                                    }
                                  }
                                } else {
                                  message.error(res2.message || '恢复失败');
                                }
                              }
                            });
                          }
                        },
                        // 删除当前周实例（管理员功能）
                        currentWeekInstance?.id && user?.position === 'MANAGER' && {
                          key: 'deleteInstance',
                          label: '删除当前周实例',
                          icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
                          danger: true,
                          onClick: async () => {
                            Modal.confirm({
                              title: '删除当前周实例',
                              content: '确定删除当前周实例及其所有课程吗？删除后需要重新生成实例。此操作不可恢复。',
                              okText: '删除',
                              okType: 'danger',
                              cancelText: '取消',
                              onOk: async () => {
                                try {
                                  const resp = await deleteWeeklyInstance(currentWeekInstance.id);
                                  if (resp.success) {
                                    message.success('已删除当前周实例');
                                    // 刷新实例列表
                                    const refreshed = await getWeeklyInstances(timetableId);
                                    if (refreshed.success) {
                                      setWeeklyInstances(refreshed.data || []);
                                    }
                                    // 切换回固定课表视图
                                    await switchToTemplateView();
                                  } else {
                                    message.error(resp.message || '删除失败');
                                  }
                                } catch (e) {
                                  message.error('删除失败，请稍后重试');
                                  console.error('删除当前周实例失败:', e);
                                }
                              }
                            });
                          }
                        }
                      ].filter(Boolean)
                    }}
                  >
                    <Button
                      type="default"
                      size="small"
                      disabled={switchToInstanceLoading || switchToTemplateLoading}
                      style={viewMode === 'instance' ? { 
                        fontSize: '12px',
                        backgroundColor: '#fa8c16',
                        borderColor: '#fa8c16',
                        color: 'white',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        padding: '4px 8px'
                      } : { 
                        fontSize: '12px',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        padding: '4px 8px'
                      }}
                    >
                      <DownOutlined style={{ fontSize: 10 }} />
                    </Button>
                  </Dropdown>
                </div>
                <Button
                  type={displayViewMode === 'template' ? 'primary' : 'default'}
                  size="small"
                  onClick={switchToTemplateView}
                  disabled={switchToInstanceLoading || switchToTemplateLoading}
                  style={{ fontSize: '12px' }}
                >
                  固定课表
                </Button>
                </div>
              ) : null}
            </div>
          </div>
          
          {/* 分隔线 - 只在固定课表时显示 */}
          {((timetable?.isWeekly && !timetable?.startDate && !timetable?.endDate) || (isInitialLoading && displayTimetable?.isWeekly)) && (
            <div style={{
              height: '1px',
              backgroundColor: '#e1e4e8',
              margin: '8px 0'
            }}></div>
          )}
          
          {/* 第二行：多选排课按钮和课时信息 */}
          {(moveMode || copyMode || swapMode) ? (
            /* 移动、复制和调换模式的提示信息 - 占满整行 */
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: moveMode ? '#e6f4ff' : copyMode ? '#f6ffed' : '#f6ffed',
              borderRadius: '4px',
              border: moveMode ? '1px solid #91caff' : copyMode ? '1px solid #b7eb8f' : '1px solid #b7eb8f',
              minHeight: '40px'
            }}>
              <span style={{ 
                fontSize: '14px', 
                color: moveMode ? '#1890ff' : copyMode ? '#722ed1' : '#52c41a', 
                fontWeight: 'bold',
                flex: 1
              }}>
                {moveMode ? moveTargetText : copyMode ? `已选择 ${selectedCopyTargets.size} 个时间段` : (swapMode ? (
                  scheduleToSwap ? 
                    (selectedSwapTarget ? `调换: ${scheduleToSwap.studentName} ↔ ${selectedSwapTarget.studentName}` : `已选择源课程: ${scheduleToSwap.studentName}，请选择目标课程`) :
                    '请选择要调换的源课程'
                ) : swapTargetText)}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  type="default"
                  size="small"
                  onClick={moveMode ? handleCancelMove : copyMode ? handleCancelCopy : handleCancelSwap}
                  style={{
                    backgroundColor: '#fff2f0',
                    borderColor: '#ffccc7',
                    color: '#cf1322'
                  }}
                >
                  {moveMode ? '取消移动' : copyMode ? '取消复制' : '取消调换'}
                </Button>
                {moveMode && selectedMoveTarget && (
                  <Button
                    type="primary"
                    size="small"
                    loading={moveLoading}
                    onClick={handleConfirmMove}
                    disabled={moveLoading}
                  >
                    确认移动
                  </Button>
                )}
                {copyMode && (
                  <Button
                    type="primary"
                    size="small"
                    loading={copyLoading}
                    onClick={handleConfirmCopy}
                    disabled={selectedCopyTargets.size === 0 || copyLoading}
                  >
                    确认复制 ({selectedCopyTargets.size})
                  </Button>
                )}
                {swapMode && selectedSwapTarget && (
                  <Button
                    type="primary"
                    size="small"
                    loading={swapLoading}
                    onClick={handleConfirmSwap}
                    disabled={swapLoading}
                    style={{
                      backgroundColor: '#52c41a',
                      borderColor: '#52c41a'
                    }}
                  >
                    确认调换
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '32px' }}>
              {/* 左侧：多选排课按钮 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                {(!timetable?.isArchived || isInitialLoading) && !deleteMode ? (
                  <Button
                    type={multiSelectMode ? 'default' : 'default'}
                    size="small"
                    onClick={toggleMultiSelectMode}
                    style={multiSelectMode ? {
                      backgroundColor: '#fff2f0',
                      borderColor: '#ffccc7',
                      color: '#cf1322'
                    } : {}}
                  >
                    {multiSelectMode ? '退出多选' : '多选排课'}
                  </Button>
                ) : null}
              </div>
              
              {/* 中间：多选状态信息 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {multiSelectMode && selectedCells.size > 0 ? (
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    {timetable?.isWeekly ? (
                      `已选择 ${selectedCells.size} 个时间段`
                    ) : (
                      (() => {
                        const currentPageCount = getCurrentPageSelectionCount();
                        return currentPageCount > 0 
                          ? `共选择 ${selectedCells.size} 个时间段 (本页 ${currentPageCount} 个)`
                          : `共选择 ${selectedCells.size} 个时间段`;
                      })()
                    )}
                  </span>
                ) : null}
                {deleteMode && selectedSchedulesForDelete.size > 0 ? (
                  <span style={{ fontSize: '14px', color: '#fa8c16' }}>
                    已选择 {selectedSchedulesForDelete.size} 个课程
                  </span>
                ) : null}
                {/* 非多选模式时显示课时信息 */}
                {!multiSelectMode && !deleteMode ? (
                  <span style={{ 
                    fontSize: '14px', 
                    color: '#666',
                    whiteSpace: 'nowrap'
                  }}>
                    {/* 日期范围课表和实例视图显示"本周"，周固定课表的模板视图显示"每周" */}
                    {(timetable?.startDate && timetable?.endDate) || displayViewMode === 'instance' ? '本周' : '每周'}
                    <span style={{ color: '#8a2be2', fontWeight: 'bold', margin: '0 2px' }}>
                      {isInitialLoading ? '0' : displayWeeklyStats.count}
                    </span>
                    节课
                    <span style={{ margin: '0 4px' }}>学员</span>
                    <span style={{ color: '#52c41a', fontWeight: 'bold', margin: '0 2px' }}>
                      {isInitialLoading ? '0' : displayWeeklyStats.students}
                    </span>
                    <span>个</span>
                    {displayViewMode === 'instance' && !isInitialLoading && weeklyLeaveCount > 0 && (
                      <>
                        <span style={{ margin: '0 4px' }}>请假</span>
                        <span style={{ color: '#fa8c16', fontWeight: 'bold', margin: '0 2px' }}>
                          {weeklyLeaveCount}
                        </span>
                        <span>课时</span>
                      </>
                    )}
                  </span>
                ) : null}
              </div>
              
              {/* 右侧：多选删除按钮、批量排课按钮和批量删除按钮 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {(!timetable?.isArchived || isInitialLoading) && !multiSelectMode ? (
                  <Button
                    type={deleteMode ? 'default' : 'default'}
                    size="small"
                    onClick={toggleDeleteMode}
                    style={deleteMode ? {
                      backgroundColor: '#fff2f0',
                      borderColor: '#ffccc7',
                      color: '#cf1322'
                    } : {}}
                  >
                    {deleteMode ? '退出删除' : '多选删除'}
                  </Button>
                ) : null}
                {multiSelectMode && selectedCells.size > 0 ? (
                  <Button
                    type="primary"
                    size="small"
                    onClick={openBatchScheduleModal}
                  >
                    批量排课
                  </Button>
                ) : null}
                {deleteMode && selectedSchedulesForDelete.size > 0 ? (
                  <Button
                    type="primary"
                    danger
                    size="small"
                    onClick={handleBatchDelete}
                  >
                    批量删除
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="compact-timetable-container" ref={tableRef} style={{ position: 'relative' }}>
        <Table
          columns={displayColumns}
          dataSource={displayTableDataSource}
          pagination={false}
          size="small"
          bordered
          className="compact-timetable"
          style={{ tableLayout: 'fixed' }}
          scroll={{ x: 'max-content' }}
        />
        {/* 统一的loading蒙板 */}
        {(loading || isInitialLoading || instancesLoading || switchToInstanceLoading || switchToTemplateLoading) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '6px'
          }}>
            <Spin size="small" description={
              loading ? "正在加载课表..." :
              isInitialLoading ? "正在初始化..." :
              instancesLoading ? "切换周实例中..." : 
              switchToInstanceLoading ? "切换到本周..." :
              switchToTemplateLoading ? "切换到固定课表..." :
              "正在加载课表数据..."
            } />
          </div>
        )}
      </div>

      {/* 每周实例分页控件 - 仅周固定课表且为实例视图时显示 */}
      {(timetable?.isWeekly && displayViewMode === 'instance' && displayWeeklyInstances.length > 0 && !isInitialLoading) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginTop: '1.5rem', 
          gap: '1rem',
          padding: '8px 0'
        }}>
          <Button
            type="text"
            onClick={() => !isInitialLoading && switchToWeekInstanceByIndex(currentInstanceIndex - 1)}
            disabled={isInitialLoading || currentInstanceIndex <= 0 || instancesLoading}
            icon={<LeftOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(
              isInitialLoading
                ? [{ id: 'loading', weekStartDate: dayjs().format('YYYY-MM-DD') }]
                : getDisplayInstances(displayWeeklyInstances)
                    .slice()
                    .sort((a, b) => dayjs(a.weekStartDate).diff(dayjs(b.weekStartDate))) // 确保左到右日期递增
            ).map((instance, displayIndex) => {
              // 找到该实例在原始列表中的真实索引
              const actualIndex = displayWeeklyInstances.findIndex(inst => inst.id === instance.id);
              const isSelected = instance.id === currentWeekInstance?.id;
              return (
                <Button
                  key={instance.id}
                  type="default"
                  size="small"
                  onClick={() => {
                    // 如果点击的是当前选中的实例，不做任何操作
                    if (isSelected) {
                      return;
                    }
                    switchToWeekInstanceByIndex(actualIndex);
                  }}
                  disabled={instancesLoading}
                  style={{
                    minWidth: '80px',
                    fontSize: '12px',
                    ...(isSelected && {
                      backgroundColor: '#fa8c16 !important',
                      borderColor: '#fa8c16 !important',
                      color: '#fff !important'
                    })
                  }}
                  className={isSelected ? 'selected-instance-btn' : ''}
                >
                  {dayjs(instance.weekStartDate).format('MM/DD')}
                </Button>
              );
            })}
          </div>
          
          <Button
            type="text"
            onClick={() => !isInitialLoading && switchToWeekInstanceByIndex(currentInstanceIndex + 1)}
            disabled={isInitialLoading || currentInstanceIndex >= displayWeeklyInstances.length - 1 || instancesLoading}
            icon={<RightOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      )}

      {(!timetable?.isWeekly && totalWeeks > 1 && !isInitialLoading) && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem', gap: '1rem' }}>
          <Button
            type="text"
            onClick={() => !isInitialLoading && displayCurrentWeek > 1 && handleWeekChange(displayCurrentWeek - 1)}
            disabled={isInitialLoading || displayCurrentWeek <= 1}
            icon={<LeftOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
          <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
            第 {displayCurrentWeek} 周 / 共 {displayTotalWeeks} 周
          </Tag>
          <Button
            type="text"
            onClick={() => !isInitialLoading && displayCurrentWeek < displayTotalWeeks && handleWeekChange(displayCurrentWeek + 1)}
            disabled={isInitialLoading || displayCurrentWeek >= displayTotalWeeks}
            icon={<RightOutlined style={{ fontSize: 14 }} />}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>
      )}

      <Modal
        title={
          <span>
            <span style={{ color: studentTextColorMap.get(exportingStudentName) || '#000' }}>
              {exportingStudentName}
            </span>
            的课程安排
          </span>
        }
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        width={350}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} type="primary" onClick={() => copyToClipboard(exportContent)}>
            复制
          </Button>,
          <Button key="close" onClick={() => setExportModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>{exportContent}</pre>
      </Modal>

      {editingSchedule && (
        <EditScheduleModal
          visible={editModalVisible}
          schedule={editingSchedule}
          timetable={timetable}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingSchedule(null);
          }}
          onOk={(data) => {
            // 完整编辑课程
            if (editingSchedule) {
              handleEditSchedule(editingSchedule, data);
            }
          }}
        />
      )}

      {/* 请假申请弹窗 */}
      <LeaveRequestModal
        visible={leaveModalVisible}
        schedule={leaveSchedule}
        onCancel={handleCancelLeave}
        onOk={handleConfirmLeave}
      />

      {/* 批量排课模态框 */}
      <Modal
        title="批量排课"
        open={batchScheduleModalVisible}
        onOk={handleBatchSchedule}
        onCancel={cancelBatchSchedule}
        okText="确认排课"
        cancelText="取消"
        width={400}
      >
        <div style={{ marginBottom: '16px' }}>
          <p style={{ marginBottom: '8px', color: '#666' }}>
            将为以下 {selectedCells.size} 个时间段批量排课：
          </p>
          <div style={{
            maxHeight: '120px',
            overflowY: 'auto',
            backgroundColor: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
                         {Array.from(selectedCells).map(cellKey => {
               // 解析cellKey格式
               const parts = cellKey.split('-');
               let dayKey, timeIndex, weekNum, displayText;

               if (timetable?.isWeekly) {
                 // 周固定课表：weekly-dayKey-timeIndex
                 [, dayKey, timeIndex] = parts;
                 const dayLabel = weekDays.find(day => day.key === dayKey)?.label;
                 const timeSlot = timeSlots[parseInt(timeIndex)];
                 displayText = `${dayLabel} ${timeSlot}`;
               } else {
                 // 日期范围课表：week-weekNum-dayKey-timeIndex
                 [, weekNum, dayKey, timeIndex] = parts;
                 const dayLabel = weekDays.find(day => day.key === dayKey)?.label;
                 const timeSlot = timeSlots[parseInt(timeIndex)];
                 displayText = `第${weekNum}周 ${dayLabel} ${timeSlot}`;
               }

               return (
                 <div key={cellKey} style={{ marginBottom: '4px' }}>
                   {displayText}
                 </div>
               );
             })}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            学生姓名：
          </label>
          <Input
            value={batchStudentName}
            onChange={(e) => setBatchStudentName(e.target.value)}
            placeholder="请输入学生姓名"
            onPressEnter={handleBatchSchedule}
          />
        </div>
      </Modal>

      <Modal
        title={
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
              {timetable?.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
              {timetableOwner?.nickname || timetableOwner?.username || '未知用户'} · {dayScheduleTitle?.split(' - ')[1] || dayScheduleTitle}
            </div>
          </div>
        }
        open={dayScheduleModalVisible}
        onCancel={() => {
          setDayScheduleModalVisible(false);
          setCopyOtherCoachesInModal(true);
          setOtherCoachesDataInModal([]);
          setLoadingOtherCoachesInModal(false);
          setOtherCoachesExpanded(false);
        }}
        footer={[
          <div key="footer-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={copyOtherCoachesInModal}
                onChange={(e) => handleCopyOtherCoachesInModalChange(e.target.checked)}
                disabled={loadingOtherCoachesInModal}
              >
                复制其他教练课程
              </Checkbox>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="primary" onClick={() => copyToClipboard(generateCopyTextForDay(daySchedulesForCopy, currentDayDate, currentDayLabel, copyOtherCoachesInModal, otherCoachesDataInModal))}>
                复制课程
              </Button>
              <Button onClick={() => {
                setDayScheduleModalVisible(false);
                setCopyOtherCoachesInModal(true);
                setOtherCoachesDataInModal([]);
                setLoadingOtherCoachesInModal(false);
                setOtherCoachesExpanded(false);
              }}>
                关闭
              </Button>
            </div>
          </div>
        ]}
        width={600}
      >
        {/* 显示其他教练课程信息 */}
        {(loadingOtherCoachesInModal || (otherCoachesDataInModal && otherCoachesDataInModal.timetables && otherCoachesDataInModal.timetables.length > 0)) && (
          <div style={{ marginBottom: '16px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
            {/* 折叠标题栏 */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fafafa',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: otherCoachesExpanded ? '1px solid #f0f0f0' : 'none'
              }}
              onClick={() => setOtherCoachesExpanded(!otherCoachesExpanded)}
            >
              <div style={{ fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                其他教练课程 ({otherCoachesDataInModal?.date || (currentDayDate ? currentDayDate.format('YYYY-MM-DD') : '')})
              </div>
              <div style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {loadingOtherCoachesInModal && (
                  <Spin size="small" />
                )}
                {otherCoachesExpanded ? <UpOutlined /> : <DownOutlined />}
              </div>
            </div>

            {/* 可折叠的内容区域 */}
            {!loadingOtherCoachesInModal && otherCoachesDataInModal && otherCoachesDataInModal.timetables && (
              <div
                style={{
                  maxHeight: otherCoachesExpanded ? '200px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease-in-out'
                }}
              >
                <div style={{ padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {otherCoachesDataInModal.timetables
                    .filter(timetableInfo => {
                      const notCurrentTimetable = timetableInfo.timetableId.toString() !== timetableId;
                      console.log(`过滤1 - ${timetableInfo.ownerName}: timetableId=${timetableInfo.timetableId}, 当前ID=${timetableId}, 通过=${notCurrentTimetable}`);
                      return notCurrentTimetable;
                    })
                    .filter(timetableInfo => {
                      const isOwnerAdmin = timetableInfo.ownerRole === 'ADMIN';
                      const shouldShow = !isOwnerAdmin;
                      console.log(`过滤2 - ${timetableInfo.ownerName}: 教练是管理员=${isOwnerAdmin}, 显示=${shouldShow}`);
                      return shouldShow;
                    })
                    .map((timetableInfo, index) => (
                      <div key={index} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1890ff', marginBottom: '4px' }}>
                          {timetableInfo.ownerName} - {timetableInfo.timetableName}
                        </div>
                        {(() => {
                          // 每行显示两个课程
                          const lines = [];
                          for (let i = 0; i < timetableInfo.schedules.length; i += 2) {
                            const lineItems = timetableInfo.schedules.slice(i, i + 2);
                            lines.push(lineItems);
                          }
                          return lines.map((lineItems, lineIndex) => (
                            <div key={lineIndex} style={{ 
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: lineIndex < lines.length - 1 ? '2px' : '0',
                              marginLeft: '8px'
                            }}>
                              <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                {lineItems[0] ? `${lineItems[0].startTime.substring(0,5)}-${lineItems[0].endTime.substring(0,5)} ${lineItems[0].isOnLeave ? `${lineItems[0].studentName}（请假）` : lineItems[0].studentName}` : ''}
                              </span>
                              <span style={{ width: '48%', fontSize: '12px', color: '#666' }}>
                                {lineItems[1] ? `${lineItems[1].startTime.substring(0,5)}-${lineItems[1].endTime.substring(0,5)} ${lineItems[1].isOnLeave ? `${lineItems[1].studentName}（请假）` : lineItems[1].studentName}` : ''}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Table
          columns={[
            { title: '时间', dataIndex: 'time1', key: 'time1', width: '20%', align: 'center' },
            {
              title: '学员',
              dataIndex: 'studentName1',
              key: 'studentName1',
              width: '30%',
              align: 'center',
              onCell: (record) => ({
                style: {
                  backgroundColor: record.studentName1 ? studentColorMap.get(record.studentName1) : 'transparent',
                }
              }),
              render: (text) => text,
            },
            { title: '时间', dataIndex: 'time2', key: 'time2', width: '20%', align: 'center' },
            {
              title: '学员',
              dataIndex: 'studentName2',
              key: 'studentName2',
              width: '30%',
              align: 'center',
              onCell: (record) => ({
                style: {
                  backgroundColor: record.studentName2 ? studentColorMap.get(record.studentName2) : 'transparent',
                }
              }),
              render: (text) => text,
            },
          ]}
          dataSource={(() => {
            // 将单行数据转换为双列显示
            const result = [];
            for (let i = 0; i < dayScheduleData.length; i += 2) {
              const row1 = dayScheduleData[i];
              const row2 = dayScheduleData[i + 1];
              result.push({
                key: i,
                time1: row1?.time || '',
                studentName1: row1?.studentName || '',
                time2: row2?.time || '',
                studentName2: row2?.studentName || '',
              });
            }
            return result;
          })()}
          pagination={false}
          size="small"
          bordered
        />
      </Modal>

      {/* 可供排课时段模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{availableSlotsTitle}</span>
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>
              （合计 {availableTimeSlots.length} 课时）
            </span>
          </div>
        }
        open={availableTimeModalVisible}
        onCancel={() => setAvailableTimeModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={() => {
            // 分组复制：周一：16:00-17:00、18:00-19:00
            const grouped = availableTimeSlots.reduce((acc, s) => {
              const key = `${s.day}${s.date ? ` ${s.date}` : ''}`;
              (acc[key] ||= []).push(s.timeSlot);
              return acc;
            }, {});
            const lines = Object.entries(grouped).map(([k, arr]) => {
              const sorted = arr.slice().sort((a, b) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
              return `${k}：${sorted.join('、')}`;
            });
            const text = `${availableSlotsTitle} (合计${availableTimeSlots.length}课时)\n\n${lines.join('\n')}`;
            
            // 兼容的复制方法，支持手机浏览器
            const copyToClipboard = (text) => {
              // 方法1：使用现代 Clipboard API
              if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(text);
              } else {
                // 方法2：使用传统的 execCommand 方法（兼容手机）
                return new Promise((resolve, reject) => {
                  const textArea = document.createElement('textarea');
                  textArea.value = text;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  textArea.style.top = '-999999px';
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                      resolve();
                    } else {
                      reject(new Error('execCommand failed'));
                    }
                  } catch (err) {
                    reject(err);
                  } finally {
                    document.body.removeChild(textArea);
                  }
                });
              }
            };
            
            copyToClipboard(text).then(() => {
              message.success('已复制到剪贴板');
            }).catch(() => {
              message.error('复制失败，请手动复制');
            });
          }}>
            复制
          </Button>,
          <Button key="close" onClick={() => setAvailableTimeModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {availableTimeSlots.length > 0 ? (
            (() => {
              const grouped = availableTimeSlots.reduce((acc, s) => {
                const key = `${s.day}${s.date ? ` ${s.date}` : ''}`;
                (acc[key] ||= []).push(s.timeSlot);
                return acc;
              }, {});
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(grouped).map(([title, times]) => {
                    const sorted = times.slice().sort((a, b) => parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]));
                    return (
                      <div key={title}>
                        <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 8, fontSize: '15px' }}>{title}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sorted.map(t => (
                            <span key={t} style={{ padding: '4px 10px', background: '#f5f5f5', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 13, color: '#444' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              暂无空闲时段
            </div>
          )}
        </div>
      </Modal>
      
      {/* 版权信息 */}
      <Footer />
    </div>
  );
};

export default ViewTimetable;