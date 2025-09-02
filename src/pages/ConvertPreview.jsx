import React, { useState, useEffect } from 'react';
import { Button, message, Space, Tag, Modal, Table, Spin } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { copyConvertDateToWeeklyApi, copyConvertWeeklyToDateApi, deleteTimetable, getTimetableSchedules } from '../services/timetable';
import dayjs from 'dayjs';
import './ViewTimetable.css';

const ConvertPreview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [converting, setConverting] = useState(false);
  const [convertModeModalVisible, setConvertModeModalVisible] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);

  useEffect(() => {
    if (!location.state) {
      message.error('缺少必要参数');
      navigate(-1);
      return;
    }
    generatePreview();
  }, [location.state, currentWeek]);

  const generatePreview = async () => {
    const { type, sourceTimetable, weekStart, weekEnd, startDate, endDate, newTimetableName } = location.state;
    

    
    try {
      setLoading(true);
      const all = await getTimetableSchedules(sourceTimetable.id);
      if (!all.success) {
        message.error('获取课程数据失败');
        return;
      }

      // 定义与ViewTimetable相同的颜色调色板
      const colorPalette = [
        '#E6F7FF', '#F0F5FF', '#F6FFED', '#FFFBE6', '#FFF1F0', '#FCF4FF',
        '#FFF0F6', '#F9F0FF', '#FFF7E6', '#FFFAE6', '#D9F7BE', '#B5F5EC',
        '#ADC6FF', '#D3ADF7', '#FFADD2', '#FFD8BF'
      ];

      const textColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];

      const studentColorMap = new Map();
      const studentTextColorMap = new Map();

      const allStudentNames = [...new Set(all.data.map(s => s.studentName).filter(Boolean))];
      allStudentNames.forEach((name, index) => {
        studentColorMap.set(name, colorPalette[index % colorPalette.length]);
        studentTextColorMap.set(name, textColorPalette[index % textColorPalette.length]);
      });

      if (type === 'date-to-weekly') {
        // 日期范围转周固定：显示选定周的课程
        const ws = dayjs(weekStart);
        const we = dayjs(weekEnd);
        const weekAll = (all.data || [])
          .filter(s => s.scheduleDate && dayjs(s.scheduleDate).isBetween(ws.subtract(1,'ms'), we.add(1,'ms'), null, '[]'))
          .sort((a,b)=>a.dayOfWeek?.localeCompare(b.dayOfWeek)||a.startTime.localeCompare(b.startTime));
        
        const timeSlots = ['09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00','19:00-20:00'];
        const weekDays = [
          { key: 'monday', label: '周一' },
          { key: 'tuesday', label: '周二' },
          { key: 'wednesday', label: '周三' },
          { key: 'thursday', label: '周四' },
          { key: 'friday', label: '周五' },
          { key: 'saturday', label: '周六' },
          { key: 'sunday', label: '周日' }
        ];
        
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
          },
        ].concat(
          weekDays.map((day, idx) => ({
            title: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {day.label}
                </div>
              </div>
            ),
            dataIndex: day.key,
            key: day.key,
            className: 'timetable-day-column',
            onCell: () => ({
              style: { padding: '0px' }
            }),
            render: (text, record) => {
              const schedules = weekAll.filter(s => {
                const timeKey = `${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`;
                const dow = dayjs(s.scheduleDate).day();
                const dayIndex = (dow + 6) % 7; // 转换为周一到周日的索引
                return timeKey === record.time && dayIndex === idx;
              });

              if (!schedules || schedules.length === 0) {
                return <div style={{ height: '48px' }} />;
              }

              return (
                <div className="schedule-cell-content">
                  {schedules.map((student, idx) => (
                    <div
                      key={student.id || idx}
                      style={{
                        backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#333',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        borderTop: idx > 0 ? '1px solid #fff' : 'none',
                      }}
                    >
                      {(() => {
                        const isTruncated = student.studentName.length > 4;
                        const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? student.studentName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            }
          }))
        );
        
        const dataSource = timeSlots.map((t, idx) => ({
          key: idx,
          time: t
        }));

        setPreviewData({
          type: 'date-to-weekly',
          title: `将按 ${ws.format('YYYY-MM-DD')} ~ ${we.format('YYYY-MM-DD')} 的课程\n生成周固定课表`,
          columns,
          dataSource,
          weekStart,
          weekEnd,
          newTimetableName,
          sourceTimetable: location.state.sourceTimetable,
          currentUserId: location.state.currentUserId
        });
      } else {
        // 周固定转日期范围：显示当前周的预览，支持分页
        const weekly = (all.data || []).filter(s => s.dayOfWeek);
        
        // 计算总周数 - 修复版本
        // 确保第1周第1天始终是周一
        const startDateObj = dayjs(location.state.startDate);
        const endDateObj = dayjs(location.state.endDate);
        
        // 找到开始日期所在周的周一作为第1周第1天
        // 直接计算到最近的周一
        const currentWeekday = startDateObj.day(); // 0=周日, 1=周一, ..., 6=周六
        let daysToMonday;
        if (currentWeekday === 1) { // 如果已经是周一
          daysToMonday = 0;
        } else if (currentWeekday === 0) { // 如果是周日
          daysToMonday = 1; // 下一天就是周一
        } else { // 其他情况，找到本周的周一
          daysToMonday = 1 - currentWeekday; // 计算到本周周一的天数
        }
        
        const firstWeekMonday = startDateObj.add(daysToMonday, 'day');
        
        // 计算从第1周周一到结束日期的总天数
        const totalDays = endDateObj.diff(firstWeekMonday, 'day') + 1;
        const totalWeeks = Math.ceil(totalDays / 7);
        setTotalWeeks(totalWeeks);
        
        // 直接验证日期计算
        for (let week = 1; week <= Math.min(5, totalWeeks); week++) {
          for (let day = 0; day < 7; day++) {
            const testDate = firstWeekMonday.add((week - 1) * 7 + day, 'day');
            const weekDayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][testDate.day()];
          }
        }
        
        const timeSlots = ['09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00','19:00-20:00'];
        const weekDays = [
          { key: 'monday', label: '周一' },
          { key: 'tuesday', label: '周二' },
          { key: 'wednesday', label: '周三' },
          { key: 'thursday', label: '周四' },
          { key: 'friday', label: '周五' },
          { key: 'saturday', label: '周六' },
          { key: 'sunday', label: '周日' }
        ];
        
        // 生成列：时间列 + 当前周的每一天
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
          },
        ];
        
        // 为当前周的每一天创建列 - 修复版本
        weekDays.forEach((day, dayIdx) => {
          columns.push({
            title: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {day.label}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {/* 修复的逻辑：确保日期和星期正确对应 */}
                  {(() => {
                    // 使用firstWeekMonday变量计算当前日期
                    const currentDate = firstWeekMonday.add((currentWeek - 1) * 7 + dayIdx, 'day');
                    
                    // 只显示日期，不显示星期几
                    return currentDate.format('MM/DD');
                  })()}
                </div>
              </div>
            ),
            dataIndex: day.key,
            key: day.key,
            className: 'timetable-day-column',
            onCell: () => ({
              style: { padding: '0px' }
            }),
            render: (text, record) => {
              // 最简单的逻辑：列1=周一，列2=周二，列3=周三，列4=周四，列5=周五，列6=周六，列7=周日
              const schedules = weekly.filter(s => {
                const timeKey = `${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`;
                return timeKey === record.time && s.dayOfWeek.toLowerCase() === day.key;
              });

              if (!schedules || schedules.length === 0) {
                return <div style={{ height: '48px' }} />;
              }

              return (
                <div className="schedule-cell-content">
                  {schedules.map((student, idx) => (
                    <div
                      key={student.id || idx}
                      style={{
                        backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#333',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        borderTop: idx > 0 ? '1px solid #fff' : 'none',
                      }}
                    >
                      {(() => {
                        const isTruncated = student.studentName.length > 4;
                        const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? student.studentName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            }
          });
        });
        
        const dataSource = timeSlots.map((t, idx) => ({
          key: idx,
          time: t
        }));

        setPreviewData({
          type: 'weekly-to-date',
          title: `展开至${startDateObj.format('YYYY.MM.DD')} ~ ${endDateObj.format('YYYY.MM.DD')}`,
          columns,
          dataSource,
          startDate: startDateObj,
          endDate: endDateObj,
          newTimetableName: location.state.newTimetableName,
          sourceTimetable: location.state.sourceTimetable,
          currentUserId: location.state.currentUserId
        });
      }
    } catch (error) {
      message.error('生成预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmConvert = () => {
    if (!previewData) return;
    setConvertModeModalVisible(true);
  };

  const handleWeekChange = (week) => {
    console.log('分页切换:', week);
    setCurrentWeek(week);
    
    // 立即重新生成预览，传递新的周次参数
    generatePreviewWithWeek(week);
  };
  
  // 新增函数：根据指定周次生成预览
  const generatePreviewWithWeek = async (targetWeek) => {
    if (!location.state) {
      message.error('缺少必要参数');
      return;
    }
    
    try {
      setLoading(true);
      const all = await getTimetableSchedules(location.state.sourceTimetable.id);
      if (!all.success) {
        message.error('获取课程数据失败');
        return;
      }

      // 定义与ViewTimetable相同的颜色调色板
      const colorPalette = [
        '#E6F7FF', '#F0F5FF', '#F6FFED', '#FFFBE6', '#FFF1F0', '#FCF4FF',
        '#FFF0F6', '#F9F0FF', '#FFF7E6', '#FFFAE6', '#D9F7BE', '#B5F5EC',
        '#ADC6FF', '#D3ADF7', '#FFADD2', '#FFD8BF'
      ];

      const textColorPalette = ['#1890ff', '#722ed1', '#52c41a', '#faad14', '#eb2f96', '#fa541c', '#13c2c2', '#d4380d'];

      const studentColorMap = new Map();
      const studentTextColorMap = new Map();

      const allStudentNames = [...new Set(all.data.map(s => s.studentName).filter(Boolean))];
      allStudentNames.forEach((name, index) => {
        studentColorMap.set(name, colorPalette[index % colorPalette.length]);
        studentTextColorMap.set(name, textColorPalette[index % textColorPalette.length]);
      });

      if (location.state.type === 'date-to-weekly') {
        // 日期范围转周固定：显示选定周的课程
        const ws = dayjs(location.state.weekStart);
        const we = dayjs(location.state.weekEnd);
        const weekAll = (all.data || [])
          .filter(s => s.scheduleDate && dayjs(s.scheduleDate).isBetween(ws.subtract(1,'ms'), we.add(1,'ms'), null, '[]'))
          .sort((a,b)=>a.dayOfWeek?.localeCompare(b.dayOfWeek)||a.startTime.localeCompare(b.startTime));
        
        const timeSlots = ['09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00','19:00-20:00'];
        const weekDays = [
          { key: 'monday', label: '周一' },
          { key: 'tuesday', label: '周二' },
          { key: 'wednesday', label: '周三' },
          { key: 'thursday', label: '周四' },
          { key: 'friday', label: '周五' },
          { key: 'saturday', label: '周六' },
          { key: 'sunday', label: '周日' }
        ];
        
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
          },
        ].concat(
          weekDays.map((day, idx) => ({
            title: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {day.label}
                </div>
              </div>
            ),
            dataIndex: day.key,
            key: day.key,
            className: 'timetable-day-column',
            onCell: () => ({
              style: { padding: '0px' }
            }),
            render: (text, record) => {
              const schedules = weekAll.filter(s => {
                const timeKey = `${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`;
                const dow = dayjs(s.scheduleDate).day();
                const dayIndex = (dow + 6) % 7; // 转换为周一到周日的索引
                return timeKey === record.time && dayIndex === idx;
              });

              if (!schedules || schedules.length === 0) {
                return <div style={{ height: '48px' }} />;
              }

              return (
                <div className="schedule-cell-content">
                  {schedules.map((student, idx) => (
                    <div
                      key={student.id || idx}
                      style={{
                        backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#333',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        borderTop: idx > 0 ? '1px solid #fff' : 'none',
                      }}
                    >
                      {(() => {
                        const isTruncated = student.studentName.length > 4;
                        const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? student.studentName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            }
          }))
        );
        
        const dataSource = timeSlots.map((t, idx) => ({
          key: idx,
          time: t
        }));

        setPreviewData({
          type: 'date-to-weekly',
          title: `${location.state.weekStart} ~ ${location.state.weekEnd}`,
          columns,
          dataSource,
          weekStart: location.state.weekStart,
          weekEnd: location.state.weekEnd,
          newTimetableName: location.state.newTimetableName,
          sourceTimetable: location.state.sourceTimetable,
          currentUserId: location.state.currentUserId
        });
      } else {
        // 周固定转日期范围：显示当前周的预览，支持分页
        const weekly = (all.data || []).filter(s => s.dayOfWeek);
        
        // 计算总周数 - 修复版本
        // 确保第1周第1天始终是周一
        const startDateObj = dayjs(location.state.startDate);
        const endDateObj = dayjs(location.state.endDate);
        
        // 找到开始日期所在周的周一作为第1周第1天
        // 直接计算到最近的周一
        const currentWeekday = startDateObj.day(); // 0=周日, 1=周一, ..., 6=周六
        let daysToMonday;
        if (currentWeekday === 1) { // 如果已经是周一
          daysToMonday = 0;
        } else if (currentWeekday === 0) { // 如果是周日
          daysToMonday = 1; // 下一天就是周一
        } else { // 其他情况，找到本周的周一
          daysToMonday = 1 - currentWeekday; // 计算到本周周一的天数
        }
        
        const firstWeekMonday = startDateObj.add(daysToMonday, 'day');
        
        // 计算从第1周周一到结束日期的总天数
        const totalDays = endDateObj.diff(firstWeekMonday, 'day') + 1;
        const totalWeeks = Math.ceil(totalDays / 7);
        setTotalWeeks(totalWeeks);
        
        // 直接验证日期计算
        for (let week = 1; week <= Math.min(5, totalWeeks); week++) {
          for (let day = 0; day < 7; day++) {
            const testDate = firstWeekMonday.add((week - 1) * 7 + day, 'day');
            const weekDayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][testDate.day()];
          }
        }
        
        const timeSlots = ['09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00','19:00-20:00'];
        const weekDays = [
          { key: 'monday', label: '周一' },
          { key: 'tuesday', label: '周二' },
          { key: 'wednesday', label: '周三' },
          { key: 'thursday', label: '周四' },
          { key: 'friday', label: '周五' },
          { key: 'saturday', label: '周六' },
          { key: 'sunday', label: '周日' }
        ];
        
        // 生成列：时间列 + 当前周的每一天
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
          },
        ];
        
        // 为当前周的每一天创建列 - 修复版本
        weekDays.forEach((day, dayIdx) => {
          columns.push({
            title: (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {day.label}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {/* 修复的逻辑：确保日期和星期正确对应 */}
                  {(() => {
                    // 使用firstWeekMonday变量计算当前日期
                    const currentDate = firstWeekMonday.add((targetWeek - 1) * 7 + dayIdx, 'day');
                    
                    // 只显示日期，不显示星期几
                    return currentDate.format('MM/DD');
                  })()}
                </div>
              </div>
            ),
            dataIndex: day.key,
            key: day.key,
            className: 'timetable-day-column',
            onCell: () => ({
              style: { padding: '0px' }
            }),
            render: (text, record) => {
              // 最简单的逻辑：列1=周一，列2=周二，列3=周三，列4=周四，列5=周五，列6=周六，列7=周日
              const schedules = weekly.filter(s => {
                const timeKey = `${s.startTime.substring(0,5)}-${s.endTime.substring(0,5)}`;
                return timeKey === record.time && s.dayOfWeek.toLowerCase() === day.key;
              });

              if (!schedules || schedules.length === 0) {
                return <div style={{ height: '48px' }} />;
              }

              return (
                <div className="schedule-cell-content">
                  {schedules.map((student, idx) => (
                    <div
                      key={student.id || idx}
                      style={{
                        backgroundColor: studentColorMap.get(student.studentName) || 'transparent',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#333',
                        fontSize: '12px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        borderTop: idx > 0 ? '1px solid #fff' : 'none',
                      }}
                    >
                      {(() => {
                        const isTruncated = student.studentName.length > 4;
                        const content = isTruncated ? `${student.studentName.substring(0, 3)}…` : student.studentName;
                        return (
                          <span
                            className={isTruncated ? 'student-name-truncated' : ''}
                            title={isTruncated ? student.studentName : undefined}
                          >
                            {content}
                          </span>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            }
          });
        });
        
        const dataSource = timeSlots.map((t, idx) => ({
          key: idx,
          time: t
        }));

        setPreviewData({
          type: 'weekly-to-date',
          title: `展开至${startDateObj.format('YYYY.MM.DD')} ~ ${endDateObj.format('YYYY.MM.DD')}`,
          columns,
          dataSource,
          startDate: startDateObj,
          endDate: endDateObj,
          newTimetableName: location.state.newTimetableName,
          sourceTimetable: location.state.sourceTimetable,
          currentUserId: location.state.currentUserId
        });
      }
    } catch (error) {
      message.error('生成预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertModeSelect = async (mode) => {
    setConvertModeModalVisible(false);
    
    try {
      setConverting(true);
      let resp;
      
      if (mode === 'new') {
        // 生成新课表
        if (previewData.type === 'date-to-weekly') {
          resp = await copyConvertDateToWeeklyApi(
            previewData.sourceTimetable.id,
            previewData.weekStart,
            `新${previewData.sourceTimetable.name}`
          );
        } else {
          resp = await copyConvertWeeklyToDateApi(
            previewData.sourceTimetable.id,
            previewData.startDate,
            previewData.endDate,
            `新${previewData.sourceTimetable.name}`
          );
        }
        
        if (resp.success) {
          message.success('新课表创建成功！');
          
          // 直接返回原页面（用户已选择保留原课表）
          const currentUserId = location.state.currentUserId;
          if (currentUserId === 1) {
            navigate('/admin/timetables');
          } else {
            navigate('/dashboard');
          }
        } else {
          message.error(resp.message || '创建新课表失败');
        }
      } else if (mode === 'replace') {
        // 替换原课表：创建新课表，删除原课表
        if (previewData.type === 'date-to-weekly') {
          resp = await copyConvertDateToWeeklyApi(
            previewData.sourceTimetable.id,
            previewData.weekStart,
            previewData.sourceTimetable.name
          );
        } else {
          resp = await copyConvertWeeklyToDateApi(
            previewData.sourceTimetable.id,
            previewData.startDate,
            previewData.endDate,
            previewData.sourceTimetable.name
          );
        }
        
        if (resp.success) {
          message.success('新课表创建成功，原课表已删除！');
          
          // 直接删除原课表
          try {
            const deleteResp = await deleteTimetable(previewData.sourceTimetable.id);
            if (deleteResp.success) {
              message.success('原课表已删除');
            } else {
              message.error('删除原课表失败');
            }
          } catch (error) {
            message.error('删除原课表时发生错误');
          }
          
          // 返回原页面
          const currentUserId = location.state.currentUserId;
          if (currentUserId === 1) {
            navigate('/admin/timetables');
          } else {
            navigate('/dashboard');
          }
        } else {
          message.error(resp.message || '创建新课表失败');
        }
      } else {
        // 未知模式
        message.error('未知的转换模式');
        return;
      }
    } catch (error) {
      message.error('转换过程中发生错误');
    } finally {
      setConverting(false);
    }
  };

  if (!previewData) {
    return null;
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <Button
          type="text"
          onClick={() => navigate(-1)}
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
            justifyContent: 'center'
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
            <h1 style={{ margin: 0 }}>转换预览</h1>
          </Space>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '8px 12px',
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        border: '1px solid #f0f0f0'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {previewData.title.split('\n').map((line, index) => (
            <div key={index}>
              {line}
              {index < previewData.title.split('\n').length - 1 && <br />}
            </div>
          ))}
        </div>
        <Button
          type="primary"
          loading={converting}
          onClick={handleConfirmConvert}
          style={{
            backgroundColor: '#52c41a',
            borderColor: '#52c41a'
          }}
        >
          确认转换
        </Button>
      </div>

      {/* 转换模式选择模态框 */}
      <Modal
        title="选择转换方式"
        open={convertModeModalVisible}
        onCancel={() => setConvertModeModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ marginBottom: '20px', fontSize: '16px', color: '#333' }}>
            请选择您希望如何转换课表：
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => handleConvertModeSelect('new')}
              style={{
                backgroundColor: '#52c41a',
                borderColor: '#52c41a',
                minWidth: '120px'
              }}
            >
              生成新课表
            </Button>
            
            <Button
              size="large"
              onClick={() => handleConvertModeSelect('replace')}
              style={{
                minWidth: '120px',
                backgroundColor: '#ff4d4f',
                borderColor: '#ff4d4f',
                color: 'white'
              }}
            >
              替换原课表
            </Button>
          </div>
          
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            <p style={{ margin: '8px 0' }}>
              <strong>生成新课表：</strong>创建新的课表，保留原课表
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>替换原课表：</strong>创建新的课表，删除原课表
            </p>
          </div>
        </div>
      </Modal>

      <div className="compact-timetable-container">
        <Table
          columns={previewData.columns}
          dataSource={previewData.dataSource}
          pagination={false}
          loading={loading}
          size="small"
          bordered
          className="compact-timetable"
          style={{ tableLayout: 'fixed' }}
        />
      </div>

      {/* 分页控制 - 只在周固定转日期范围时显示 */}
      {previewData?.type === 'weekly-to-date' && totalWeeks > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem', gap: '1rem' }}>
          <Button
            type="text"
            onClick={() => currentWeek > 1 && handleWeekChange(currentWeek - 1)}
            disabled={currentWeek <= 1}
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
            第 {currentWeek} 周 / 共 {totalWeeks} 周
          </Tag>
          <Button
            type="text"
            onClick={() => currentWeek < totalWeeks && handleWeekChange(currentWeek + 1)}
            disabled={currentWeek >= totalWeeks}
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
    </div>
  );
};

export default ConvertPreview;
