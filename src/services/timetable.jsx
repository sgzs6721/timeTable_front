import api from './auth';

// 获取用户的课表列表
export const getTimetables = async () => {
  try {
    const response = await api.get('/timetables');
    return response;
  } catch (error) {
    throw error;
  }
};

// 创建新课表
export const createTimetable = async (timetableData) => {
  try {
    const response = await api.post('/timetables', timetableData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取单个课表详情
export const getTimetable = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取课表的课程数据
export const getTimetableSchedules = async (timetableId, week = null) => {
  try {
    const url = week
      ? `/timetables/${timetableId}/schedules?week=${week}`
      : `/timetables/${timetableId}/schedules`;
    const response = await api.get(url);
    return response;
  } catch (error) {
    throw error;
  }
};

// 创建新排课
export const createSchedule = async (timetableId, scheduleData) => {
  try {
    const response = await api.post(
        `/timetables/${timetableId}/schedules`,
        scheduleData
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 检查排课冲突
export const checkScheduleConflicts = async (timetableId, schedulesData) => {
  try {
    const response = await api.post(
      `/timetables/${timetableId}/schedules/batch/check-conflicts`,
      schedulesData
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 批量创建新排课
export const createSchedulesBatch = async (timetableId, schedulesData) => {
  try {
    const response = await api.post(
      `/timetables/${timetableId}/schedules/batch`,
      schedulesData
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 强制批量创建新排课（忽略冲突）
export const createSchedulesBatchForce = async (timetableId, schedulesData) => {
  try {
    const response = await api.post(
      `/timetables/${timetableId}/schedules/batch/force`,
      schedulesData
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 通过语音输入课程安排
export const addScheduleByVoice = async (timetableId, audioData, type) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioData);
    formData.append('type', type);

    const response = await api.post(
      `/timetables/${timetableId}/schedules/voice`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 通过文本输入课程安排
export const addScheduleByText = async (timetableId, text, type, parser = 'ai') => {
  try {
    const response = await api.post(
      `/timetables/${timetableId}/schedules/text`,
      { text, type, parser }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 通过格式化文本输入课程安排
export const addScheduleByFormat = async (timetableId, text, type) => {
  try {
    const response = await api.post(
      `/timetables/${timetableId}/schedules/format`,
      { text, type, parser: 'format' }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 删除课表
export const deleteTimetable = async (timetableId) => {
  try {
    const response = await api.delete(`/timetables/${timetableId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新课表
export const updateTimetable = async (timetableId, timetableData) => {
  try {
    const response = await api.put(`/timetables/${timetableId}`, timetableData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 删除课程安排
export const deleteSchedule = async (timetableId, scheduleId) => {
  try {
    const response = await api.delete(`/timetables/${timetableId}/schedules/${scheduleId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新课程安排
export const updateSchedule = async (timetableId, scheduleId, scheduleData) => {
  try {
    const response = await api.put(
      `/timetables/${timetableId}/schedules/${scheduleId}`,
      scheduleData
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员功能：获取所有用户的课表
export const getAllTimetables = async () => {
  try {
    const response = await api.get('/admin/timetables');
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员功能：批量获取课表信息（包含用户信息）- 用于合并预览
export const getBatchTimetablesInfo = async (timetableIds) => {
  try {
    const response = await api.post('/admin/timetables/batch-info', {
      timetableIds
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员功能：合并课表
export const mergeTimetables = async (timetableIds, mergedName) => {
  try {
    const response = await api.post('/admin/timetables/merge', {
      timetableIds,
      mergedName
    });
    return response;
  } catch (error) {
    throw error;
  }
};