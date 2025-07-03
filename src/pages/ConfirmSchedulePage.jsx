import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createSchedulesBatch } from '../services/timetable';
import { Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import './ConfirmSchedulePage.css';

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
  // First, check our comprehensive map for all formats (numbers, Chinese chars)
  const mappedValue = dayOfWeekInputMap[trimmedInput] || dayOfWeekInputMap[trimmedInput.toUpperCase()];
  if (mappedValue) {
    return mappedValue;
  }
  // If no match, it might be in the canonical format already (e.g., 'MONDAY')
  const upperInput = trimmedInput.toUpperCase();
  if (dayOfWeekMap[upperInput]) {
    return upperInput;
  }
  // Return the original input, uppercased, as a last resort
  return upperInput;
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  const dateParts = dateStr.split('-');
  if (dateParts.length === 3) {
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);
    return `${month}-${day}`;
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

const ConfirmSchedulePage = ({ setTextInputValue }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
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
      // If no data, maybe direct access, redirect to the previous page or a safe default
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

    setLoading(true);
    try {
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

      const response = await createSchedulesBatch(timetableId, schedulesToCreate);
      
      if (response && response.success) {
        message.success('排课已成功添加！');
        setTextInputValue(''); // Clear the input in App.jsx
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

  const handleCancel = () => {
    navigate(-1); // Go back to the previous page to modify
  };

  return (
    <div className="confirm-schedule-container">
      <h2>确认排课信息</h2>
      <p>请检查以下由AI识别的排课信息，您可以直接在表格中进行修改。</p>
      <div className="schedule-table-container">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>姓名</th>
              {timetableType === 'WEEKLY' && <th>星期</th>}
              {timetableType === 'DATE_RANGE' && <th>日期</th>}
              <th>时间</th>
              <th>操作</th>
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
                      placeholder="YYYY-MM-DD"
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
                    className="delete-btn-small"
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
          loading={loading}
        >
          确认
        </Button>
      </div>
    </div>
  );
};

export default ConfirmSchedulePage; 