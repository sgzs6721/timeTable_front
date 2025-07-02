import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createSchedulesBatch } from '../services/timetable';
import { Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import './ConfirmSchedulePage.css';

const ConfirmSchedulePage = ({ setTextInputValue }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { timetableId } = useParams();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state && location.state.data) {
      setSchedules(location.state.data);
    } else {
      // 如果没有数据，可能直接访问了此页面，重定向回课表页
      navigate(`/timetables/${timetableId}`);
    }
  }, [location.state, navigate, timetableId]);

  const handleInputChange = (index, field, value) => {
    const newSchedules = [...schedules];
    newSchedules[index][field] = value;
    setSchedules(newSchedules);
  };

  const handleDelete = (index) => {
    const newSchedules = [...schedules];
    newSchedules.splice(index, 1);
    setSchedules(newSchedules);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const schedulesToCreate = schedules.map(schedule => {
        const [startTime, endTime] = schedule.time ? schedule.time.split('-') : [null, null];
        return {
          studentName: schedule.studentName,
          dayOfWeek: schedule.dayOfWeek,
          scheduleDate: schedule.date,
          startTime: startTime,
          endTime: endTime,
          note: '通过文本识别创建',
        };
      });

      const response = await createSchedulesBatch(timetableId, schedulesToCreate);
      
      if (response && response.success) {
        message.success('排课已成功添加！');
        setTextInputValue(''); // Clear the input in App.jsx
        navigate(`/timetables/${timetableId}`);
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
              <th>星期</th>
              <th>日期</th>
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
                <td>
                  <input
                    type="text"
                    value={schedule.dayOfWeek || ''}
                    onChange={(e) => handleInputChange(index, 'dayOfWeek', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={schedule.date || ''}
                    onChange={(e) => handleInputChange(index, 'date', e.target.value)}
                  />
                </td>
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