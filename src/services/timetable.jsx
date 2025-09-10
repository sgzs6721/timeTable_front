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

// 获取日期范围课表的周列表与课程数量
export const getWeeksWithCountsApi = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/weeks`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取课表的课程数据
export const getTimetableSchedules = async (timetableId, week = null, templateOnly = false) => {
  try {
    let url = `/timetables/${timetableId}/schedules`;
    const params = new URLSearchParams();
    
    if (week !== null) {
      params.append('week', week);
    }
    
    if (templateOnly) {
      params.append('templateOnly', 'true');
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await api.get(url);
    return response;
  } catch (error) {
    throw error;
  }
};

// 根据学生姓名获取课表的课程数据
export const getTimetableSchedulesByStudent = async (timetableId, studentName, week = null) => {
  try {
    const url = week
      ? `/timetables/${timetableId}/schedules/student/${encodeURIComponent(studentName)}?week=${week}`
      : `/timetables/${timetableId}/schedules/student/${encodeURIComponent(studentName)}`;
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

// 清空课表的所有课程
export const clearTimetableSchedules = async (timetableId, options = {}) => {
  try {
    const { alsoClearCurrentWeek = false } = options;
    const response = await api.delete(`/timetables/${timetableId}/schedules/clear`, { params: { alsoClearCurrentWeek } });
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
export const getAllTimetables = async (activeOnly = false) => {
  try {
    const response = await api.get(`/admin/timetables?activeOnly=${activeOnly}`);
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

// 设为活动课表
export const setActiveTimetable = async (timetableId) => {
  try {
    const response = await api.put(`/timetables/${timetableId}/active`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 转换：日期范围 -> 周固定
export const convertDateToWeeklyApi = async (timetableId, weekStart) => {
  try {
    const response = await api.post(`/timetables/${timetableId}/convert/date-to-weekly`, { weekStart });
    return response;
  } catch (error) {
    throw error;
  }
};

// 转换：周固定 -> 日期范围
export const convertWeeklyToDateApi = async (timetableId, startDate, endDate) => {
  try {
    const response = await api.post(`/timetables/${timetableId}/convert/weekly-to-date`, { startDate, endDate });
    return response;
  } catch (error) {
    throw error;
  }
};

// 复制并转换（保留原课表）
export const copyConvertDateToWeeklyApi = async (timetableId, weekStart, newName) => {
  try {
    const response = await api.post(`/timetables/${timetableId}/convert/date-to-weekly/copy`, { weekStart, newName });
    return response;
  } catch (error) { throw error; }
};

export const copyConvertWeeklyToDateApi = async (timetableId, startDate, endDate, newName) => {
  try {
    const response = await api.post(`/timetables/${timetableId}/convert/weekly-to-date/copy`, { startDate, endDate, newName });
    return response;
  } catch (error) { throw error; }
};

// 获取所有活动课表的指定日期课程信息
export const getActiveSchedulesByDate = async (date) => {
  try {
    const response = await api.get(`/admin/active-timetables/schedules?date=${date}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 合并/缓存版：同一日期在短时间内只发起一次请求
const activeSchedulesCache = new Map(); // date -> { time, promise, data }
const MERGE_WINDOW_MS = 800; // 合并窗口

export const getActiveSchedulesByDateMerged = async (date) => {
  const now = Date.now();
  const cached = activeSchedulesCache.get(date);

  if (cached) {
    // 已有数据且不过期，直接返回数据
    if (cached.data && now - cached.time < 60_000) {
      return cached.data;
    }
    // 合并在飞的请求
    if (cached.promise && now - cached.time < MERGE_WINDOW_MS) {
      return cached.promise;
    }
  }

  const prom = api
    .get(`/admin/active-timetables/schedules?date=${date}`)
    .then((resp) => {
      activeSchedulesCache.set(date, { time: Date.now(), data: resp, promise: null });
      return resp;
    })
    .catch((err) => {
      activeSchedulesCache.delete(date);
      throw err;
    });

  activeSchedulesCache.set(date, { time: now, promise: prom, data: null });
  return prom;
};

// 归档课表
export const archiveTimetableApi = async (timetableId) => {
  try {
    const response = await api.put(`/timetables/${timetableId}/archive`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 恢复归档课表
export const restoreTimetableApi = async (timetableId) => {
  try {
    const response = await api.put(`/timetables/${timetableId}/restore`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 批量恢复课表
export const bulkRestoreTimetables = async (ids) => {
  try {
    const response = await api.post('/timetables/batch-restore', { ids });
    return response;
  } catch (error) {
    throw error;
  }
};

// 批量删除课表
export const bulkDeleteTimetables = async (ids) => {
  try {
    const response = await api.post('/timetables/batch-delete', { ids });
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取归档课表
export const getArchivedTimetables = async (scope) => {
  try {
    const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    const response = await api.get(`/timetables/archived${query}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 复制课表到指定用户
export const copyTimetableToUser = async (sourceTimetableId, targetUserId, newTimetableName) => {
  try {
    const response = await api.post('/admin/timetables/copy', {
      sourceTimetableId,
      targetUserId,
      newTimetableName
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// 批量删除课程
export const deleteSchedulesBatch = async (timetableId, scheduleIds) => {
  try {
    const response = await api.delete(`/timetables/${timetableId}/schedules/batch/ids`, { data: scheduleIds });
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取今日课程
export const getTodaySchedules = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/schedules/today`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取明日课程
export const getTomorrowSchedules = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/schedules/tomorrow`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取本周课程
export const getThisWeekSchedules = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/schedules/this-week`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取固定课表模板
export const getTemplateSchedules = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/schedules/template`);
    return response;
  } catch (error) {
    throw error;
  }
};

// ====== 每个区块的合并/缓存版（同一课表ID短时间只请求一次） ======
const cacheBox = {
  today: new Map(), // id -> {time, promise, data}
  tomorrow: new Map(),
  week: new Map(),
  template: new Map(),
};
const MERGE_MS = 800;       // 合并窗口
const SOFT_TTL_MS = 60_000; // 软缓存1分钟

function getMerged(map, key, doRequest) {
  const now = Date.now();
  const item = map.get(key);
  if (item) {
    if (item.data && now - item.time < SOFT_TTL_MS) return Promise.resolve(item.data);
    if (item.promise && now - item.time < MERGE_MS) return item.promise;
  }
  const p = doRequest()
    .then((resp) => {
      map.set(key, { time: Date.now(), data: resp, promise: null });
      return resp;
    })
    .catch((e) => { map.delete(key); throw e; });
  map.set(key, { time: now, promise: p, data: null });
  return p;
}

export const getTodaySchedulesOnce = (timetableId) =>
  getMerged(cacheBox.today, String(timetableId), () => getTodaySchedules(timetableId));

export const getTomorrowSchedulesOnce = (timetableId) =>
  getMerged(cacheBox.tomorrow, String(timetableId), () => getTomorrowSchedules(timetableId));

export const getThisWeekSchedulesOnce = (timetableId) =>
  getMerged(cacheBox.week, String(timetableId), () => getThisWeekSchedules(timetableId));

export const getTemplateSchedulesOnce = (timetableId) =>
  getMerged(cacheBox.template, String(timetableId), () => getTemplateSchedules(timetableId));

// 使某个课表的短缓存立即失效（用于新增/修改/删除后实时刷新）
export const invalidateTimetableCache = (timetableId) => {
  try {
    const key = String(timetableId);
    cacheBox.today.delete(key);
    cacheBox.tomorrow.delete(key);
    cacheBox.week.delete(key);
    cacheBox.template.delete(key);
  } catch (e) {
    // 忽略缓存删除异常
  }
};

// 统一获取概览：今日/明日/本周/固定
export const getSchedulesOverview = async (timetableId) => {
  try {
    const response = await api.get(`/timetables/${timetableId}/schedules/overview`);
    return response;
  } catch (error) { throw error; }
};