import axios from 'axios';
import { getApiBaseUrl, TIMEOUT, HEADERS } from '../config/api.js';

// 使用统一配置
const API_BASE_URL = getApiBaseUrl();

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: HEADERS,
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 为指定课表生成当前周实例
export const generateCurrentWeekInstance = (timetableId) => {
  return api.post(`/weekly-instances/generate/${timetableId}`, {});
};

// 获取指定课表的当前周实例
export const getCurrentWeekInstance = (timetableId) => {
  return api.get(`/weekly-instances/current/${timetableId}`);
};

// 获取指定课表的当前周实例（包含请假课程）
export const getCurrentWeekInstanceIncludingLeaves = (timetableId) => {
  return api.get(`/weekly-instances/current/${timetableId}/including-leaves`);
};

// 获取指定课表的所有周实例
export const getWeeklyInstances = (timetableId) => {
  return api.get(`/weekly-instances/list/${timetableId}`);
};

// 切换到指定的周实例
export const switchToWeekInstance = (instanceId) => {
  return api.put(`/weekly-instances/switch/${instanceId}`, {});
};

// 获取周实例的课程安排
export const getInstanceSchedules = (instanceId) => {
  return api.get(`/weekly-instances/${instanceId}/schedules`);
};

// 在周实例中创建课程
export const createInstanceSchedule = (instanceId, scheduleData) => {
  return api.post(`/weekly-instances/${instanceId}/schedules`, scheduleData);
};

// 在周实例中批量创建课程
export const createInstanceSchedulesBatch = (instanceId, schedulesData) => {
  return api.post(`/weekly-instances/${instanceId}/schedules/batch`, schedulesData);
};

// 更新周实例中的课程
export const updateInstanceSchedule = (scheduleId, scheduleData) => {
  return api.put(`/weekly-instances/schedules/${scheduleId}`, scheduleData);
};

// 删除周实例中的课程
export const deleteInstanceSchedule = (scheduleId) => {
  return api.delete(`/weekly-instances/schedules/${scheduleId}`);
};

// 同步模板课表到周实例
export const syncTemplateToInstances = (timetableId) => {
  return api.post(`/weekly-instances/sync/${timetableId}`, {});
};

export const restoreCurrentWeekInstanceToTemplate = (timetableId) => {
  return api.post(`/weekly-instances/restore/${timetableId}`, {});
};

// 检查课表是否有当前周实例
export const checkCurrentWeekInstance = (timetableId) => {
  return api.get(`/weekly-instances/check/${timetableId}`);
};

// 清空当前周实例中的课程
export const clearCurrentWeekInstanceSchedules = (timetableId) => {
  return api.delete(`/weekly-instances/current/${timetableId}/schedules`);
};

// 手动生成下周实例
export const generateNextWeekInstance = (timetableId) => {
  return api.post(`/weekly-instances/next-week/generate/${timetableId}`, {});
};

// 删除下周实例
export const deleteNextWeekInstance = (timetableId) => {
  return api.delete(`/weekly-instances/next-week/${timetableId}`);
};

// 批量删除周实例中的课程
export const deleteInstanceSchedulesBatch = (scheduleIds) => {
  return api.delete('/weekly-instances/schedules/batch', { data: scheduleIds });
};

// 学生请假
export const requestLeave = (scheduleId, leaveReason) => {
  return api.post('/weekly-instances/schedules/leave', {
    scheduleId,
    leaveReason
  });
};

// 取消请假
export const cancelLeave = (scheduleId) => {
  return api.post(`/weekly-instances/schedules/cancel-leave/${scheduleId}`);
};

// 获取所有请假记录
export const getLeaveRecords = () => {
  return api.get('/weekly-instances/leave-records');
};

// 删除请假记录
export const deleteLeaveRecord = (recordId) => {
  return api.delete(`/weekly-instances/leave-records/${recordId}`);
};

// 批量删除请假记录
export const deleteLeaveRecordsBatch = (recordIds) => {
  return api.delete('/weekly-instances/leave-records/batch', { data: recordIds });
};

// 获取学员记录
export const getStudentRecords = (studentName, coachName) => {
  return api.get('/weekly-instances/student-records', {
    params: { studentName, coachName }
  });
};

// 获取学员汇总（返回 [{ studentName, attendedCount }]，已按 attendedCount 倒序）
export const getAllStudents = (showAll = false, timestamp, coachId = null) => {
  const params = { showAll };
  if (timestamp) {
    params._t = timestamp; // 添加时间戳参数避免缓存
  }
  if (coachId) {
    params.coachId = coachId; // 添加教练ID参数
  }
  return api.get('/weekly-instances/students', {
    params
  });
};

// 调换两个周实例课程
export const swapInstanceSchedules = (scheduleId1, scheduleId2) => {
  return api.post('/weekly-instances/schedules/swap', {
    scheduleId1,
    scheduleId2
  });
};

// 删除周实例（管理员功能）
export const deleteWeeklyInstance = (instanceId) => {
  return api.delete(`/weekly-instances/${instanceId}`);
};
