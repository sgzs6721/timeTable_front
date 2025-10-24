import api from './auth';

// 获取所有课表
export const getAllTimetables = async (activeOnly = false) => {
  try {
    const response = await api.get(`/admin/timetables?activeOnly=${activeOnly}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 有课表（活动或归档）的教练列表，按注册时间倒序
export const getCoachesWithTimetables = async () => {
  try {
    const response = await api.get('/admin/coaches/with-timetables');
    return response;
  } catch (error) {
    throw error;
  }
};

export const updateTimetableStatus = async (id, data) => {
  try {
    const response = await api.put(`/admin/timetables/${id}`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员更新课表详情（名称、描述等）
export const updateTimetableDetails = async (id, data) => {
  try {
    const response = await api.put(`/admin/timetables/${id}/details`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取所有用户列表
export const getAllUsers = async () => {
  try {
    const response = await api.get('/admin/users');
    return response;
  } catch (error) {
    throw error;
  }
};

// 创建新用户
export const createUser = async (userData) => {
  try {
    const response = await api.post('/admin/users/create', userData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员为指定用户创建课表
export const createTimetableForUser = async (timetableData) => {
  try {
    const response = await api.post('/admin/timetables/create-for-user', timetableData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新用户权限
// 统一接口：更新用户信息（角色、用户名等）
export const updateUserInfo = async (userId, data) => {
  try {
    const response = await api.put(`/admin/users/${userId}`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

// 兼容旧用法：仅更新角色
export const updateUserRole = async (userId, role) => updateUserInfo(userId, { role });

// 重置用户密码
export const resetUserPassword = async (userId, password) => {
  try {
    const response = await api.put(`/admin/users/${userId}/password`, { password });
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新用户昵称
export const updateUserNickname = async (userId, nickname) => {
  try {
    const response = await api.put(`/admin/users/${userId}/nickname`, { nickname });
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新用户名（用户名用于登录）
// 已合并到 updateUserInfo：保留占位以兼容导入，但调用统一接口
export const updateUserUsername = async (userId, username) => updateUserInfo(userId, { username });

// 软删除用户
export const deleteUser = async (userId) => {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 合并课表
export const mergeTimetables = async (mergeData) => {
  try {
    const response = await api.post('/admin/timetables/merge', mergeData);
    return response;
  } catch (error) {
    throw error;
  }
};

// 批量获取课表信息
export const getBatchTimetablesInfo = async (timetableIds) => {
  try {
    const response = await api.post('/admin/timetables/batch-info', { timetableIds });
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取待审批的用户注册申请（已废弃，使用 getAllRegistrationRequests 代替）
// export const getPendingUsers = async () => {
//   try {
//     const response = await api.get('/admin/users/pending');
//     return response;
//   } catch (error) {
//     throw error;
//   }
// };

// 批准用户注册申请
export const approveUserRegistration = async (userId, position) => {
  try {
    const response = await api.put(`/admin/users/${userId}/approve`, { position });
    return response;
  } catch (error) {
    throw error;
  }
};

// 拒绝用户注册申请
export const rejectUserRegistration = async (userId) => {
  try {
    const response = await api.put(`/admin/users/${userId}/reject`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取所有注册申请记录（包括已处理的）
export const getAllRegistrationRequests = async () => {
  try {
    const response = await api.get('/admin/users/registration-requests');
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

// 管理员删除课表
export const deleteTimetableByAdmin = async (timetableId) => {
  try {
    const response = await api.delete(`/admin/timetables/${timetableId}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 管理员清空课表的所有课程
export const clearTimetableSchedulesByAdmin = async (timetableId, options = {}) => {
  try {
    const { alsoClearCurrentWeek = false } = options;
    const response = await api.delete(`/admin/timetables/${timetableId}/schedules/clear`, { params: { alsoClearCurrentWeek } });
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取所有教练的课程统计信息
export const getCoachesStatistics = async () => {
  try {
    const response = await api.get('/admin/coaches/statistics');
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取指定教练的上月课程明细（分页）
export const getCoachLastMonthRecords = async (coachId, page = 1, size = 10) => {
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    const response = await api.get(`/admin/coaches/${coachId}/last-month-records?${params.toString()}`);
    return response;
  } catch (error) {
    throw error;
  }
};

// 获取基于实例逻辑的指定日期课程（今日/明日）
// 加合并/短缓存，避免同日期多次请求
const byDateCache = new Map(); // date -> {time, promise, data}
const BYDATE_MERGE_MS = 800;
const BYDATE_TTL_MS = 60_000;

// 清除指定日期的缓存
export const clearByDateCache = (date) => {
  if (date) {
    byDateCache.delete(date);
  } else {
    byDateCache.clear();
  }
};

export const getInstanceSchedulesByDate = async (date) => {
  const now = Date.now();
  const hit = byDateCache.get(date);
  if (hit) {
    if (hit.data && now - hit.time < BYDATE_TTL_MS) return hit.data;
    if (hit.promise && now - hit.time < BYDATE_MERGE_MS) return hit.promise;
  }
  const prom = api.get(`/weekly-instances/by-date?date=${date}`)
    .then(resp => { 
      const result = { success: true, data: resp.data }; 
      byDateCache.set(date, { time: Date.now(), data: result, promise: null }); 
      return result; 
    })
    .catch(e => { 
      byDateCache.delete(date); 
      return { success: false, data: { timetableSchedules: [] }, error: e.message }; 
    });
  byDateCache.set(date, { time: now, promise: prom, data: null });
  return prom;
};

// 获取活动课表本周排课信息（周一到周日）- 优化版，一次性获取所有数据
export const getActiveWeeklySchedules = async () => {
  try {
    const now = Date.now();
    // 检查缓存
    if (weeklySchedulesCache && now - weeklySchedulesCacheTime < CACHE_TTL) {
      return { success: true, data: weeklySchedulesCache };
    }
    
    // 使用新的优化接口，一次性获取所有活动课表的本周数据
    const response = await api.get('/admin/active-timetables/this-week');
    
    if (!response.success) {
      throw new Error('获取活动课表本周数据失败');
    }
    
    
    // 更新缓存
    weeklySchedulesCache = response.data || [];
    weeklySchedulesCacheTime = now;
    
    return {
      success: true,
      data: weeklySchedulesCache
    };
  } catch (error) {
    console.error('getActiveWeeklySchedules 错误:', error);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
};

// 全局缓存，避免重复调用
let weeklySchedulesCache = null;
let weeklySchedulesCacheTime = 0;
const CACHE_TTL = 30000; // 30秒缓存

// 基于聚合接口：按课表ID过滤本周课程（单接口、前端过滤）
export const getThisWeekSchedulesForTimetable = async (timetableId) => {
  try {
    const now = Date.now();
    // 检查缓存
    if (weeklySchedulesCache && now - weeklySchedulesCacheTime < CACHE_TTL) {
      const filtered = weeklySchedulesCache.filter(s => String(s.timetableId) === String(timetableId));
      return { success: true, data: filtered };
    }
    
    // 缓存过期，重新获取
    const res = await getActiveWeeklySchedules();
    if (!res || !res.success) return res;
    const all = Array.isArray(res.data) ? res.data : [];
    
    // 更新缓存
    weeklySchedulesCache = all;
    weeklySchedulesCacheTime = now;
    
    const filtered = all.filter(s => String(s.timetableId) === String(timetableId));
    return { success: true, data: filtered };
  } catch (error) {
    return { success: false, data: [], error: error.message };
  }
};

// 获取活动课表本周排课信息（周一到周日）- 原版本，保留作为备用
export const getActiveWeeklySchedulesLegacy = async () => {
  try {
    // 获取所有活动课表
    const activeTimetablesResponse = await api.get('/admin/active-timetables');
    if (!activeTimetablesResponse.success) {
      throw new Error('获取活动课表失败');
    }
    
    const activeTimetables = activeTimetablesResponse.data || [];
    
    // 为每个活动课表获取本周数据
    const weekResponses = await Promise.all(
      activeTimetables.map(async (timetable) => {
        try {
          const weekResponse = await api.get(`/timetables/${timetable.id}/schedules/this-week`);
          return {
            timetableId: timetable.id,
            timetableName: timetable.name,
            ownerNickname: timetable.nickname,
            ownerUsername: timetable.username,
            isWeekly: timetable.isWeekly,
            schedules: weekResponse.success ? weekResponse.data : []
          };
        } catch (error) {
          console.warn(`获取课表 ${timetable.id} 本周数据失败:`, error);
          return {
            timetableId: timetable.id,
            timetableName: timetable.name,
            ownerNickname: timetable.nickname,
            ownerUsername: timetable.username,
            isWeekly: timetable.isWeekly,
            schedules: []
          };
        }
      })
    );
    
    
    // 合并所有课表的课程数据
    const allSchedules = [];
    weekResponses.forEach(timetableData => {
      if (timetableData.schedules && timetableData.schedules.length > 0) {
        timetableData.schedules.forEach(schedule => {
          allSchedules.push({
            ...schedule,
            timetableId: timetableData.timetableId,
            timetableName: timetableData.timetableName,
            ownerNickname: timetableData.ownerNickname,
            ownerUsername: timetableData.ownerUsername,
            isWeekly: timetableData.isWeekly
          });
        });
      }
    });
    
    
    return {
      success: true,
      data: allSchedules
    };
  } catch (error) {
    console.error('getActiveWeeklySchedulesLegacy 错误:', error);
    return {
      success: false,
      data: { dates: [], schedules: [] },
      error: error.message
    };
  }
};

// 紧急修复：批量生成所有缺失的当前周实例
export const emergencyFixWeeklyInstances = async () => {
  try {
    const response = await api.post('/admin/emergency-fix/weekly-instances');
    return response;
  } catch (error) {
    throw error;
  }
};

// 自动检查并修复缺失的当前周实例
export const autoFixWeeklyInstances = async () => {
  try {
    const response = await api.post('/admin/auto-fix/weekly-instances');
    return response;
  } catch (error) {
    throw error;
  }
};

// 清理所有周实例中的重复课程数据
export const cleanDuplicateSchedules = async () => {
  try {
    const response = await api.post('/admin/clean-duplicate-schedules');
    return response;
  } catch (error) {
    throw error;
  }
};

// 全局缓存，避免重复调用
let weeklyTemplatesCache = null;
let weeklyTemplatesCacheTime = 0;
export const invalidateWeeklyTemplatesCache = () => {
  weeklyTemplatesCache = null;
  weeklyTemplatesCacheTime = 0;
};
const TEMPLATE_CACHE_TTL = 30000; // 30秒缓存

// 获取活动课表固定模板信息（周一到周日）- 优化版，一次性获取所有数据
export const getActiveWeeklyTemplates = async () => {
  try {
    const now = Date.now();
    // 检查缓存
    if (weeklyTemplatesCache && now - weeklyTemplatesCacheTime < TEMPLATE_CACHE_TTL) {
      return { success: true, data: weeklyTemplatesCache };
    }
    
    // 使用新的优化接口，一次性获取所有活动课表的模板数据
    const response = await api.get('/admin/active-timetables/templates');
    
    if (!response.success) {
      throw new Error('获取活动课表模板数据失败');
    }
    
    
    // 新接口返回的是扁平化的课程数组，直接返回给前端使用新的处理逻辑
    const templateSchedules = response.data || [];
    
    // 更新缓存
    weeklyTemplatesCache = templateSchedules;
    weeklyTemplatesCacheTime = now;
    
    return {
      success: true,
      data: weeklyTemplatesCache // 直接返回扁平化数组，让前端统一处理
    };
  } catch (error) {
    console.error('获取活动课表模板数据失败:', error);
    return {
      success: false,
      data: { dates: [], schedules: [] },
      error: error.message
    };
  }
};

// 基于聚合接口：按课表ID过滤模板课程（单接口、前端过滤）
export const getTemplateSchedulesForTimetable = async (timetableId) => {
  try {
    const res = await getActiveWeeklyTemplates();
    if (!res || !res.success) return res;
    const all = Array.isArray(res.data) ? res.data : [];
    const filtered = all.filter(s => String(s.timetableId) === String(timetableId));
    return { success: true, data: filtered };
  } catch (error) {
    return { success: false, data: [], error: error.message };
  }
};

// 获取活动课表固定模板信息（周一到周日）- 原版本，保留作为备用
export const getActiveWeeklyTemplatesLegacy = async () => {
  try {
    // 获取所有活动课表
    const activeTimetablesResponse = await api.get('/admin/active-timetables');
    if (!activeTimetablesResponse.success) {
      throw new Error('获取活动课表失败');
    }
    
    const activeTimetables = activeTimetablesResponse.data || [];
    
    // 为每个活动课表获取模板数据
    const templateResponses = await Promise.all(
      activeTimetables.map(async (timetable) => {
        try {
          const templateResponse = await api.get(`/timetables/${timetable.id}/schedules/template`);
          return {
            timetableId: timetable.id,
            timetableName: timetable.name,
            ownerNickname: timetable.nickname,
            ownerUsername: timetable.username,
            isWeekly: timetable.isWeekly,
            schedules: templateResponse.success ? templateResponse.data : []
          };
        } catch (error) {
          console.warn(`获取课表 ${timetable.id} 模板数据失败:`, error);
          return {
            timetableId: timetable.id,
            timetableName: timetable.name,
            ownerNickname: timetable.nickname,
            ownerUsername: timetable.username,
            isWeekly: timetable.isWeekly,
            schedules: []
          };
        }
      })
    );
    
    
    // 按星期几组织数据
    const weekDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const schedulesByDay = weekDays.map(dayOfWeek => {
      const daySchedules = templateResponses.map(timetableData => ({
        ...timetableData,
        schedules: timetableData.schedules.filter(schedule => 
          schedule.dayOfWeek === dayOfWeek
        )
      }));
      
      const filteredSchedules = daySchedules.filter(t => t.schedules.length > 0);
      
      return {
        timetableSchedules: filteredSchedules
      };
    });
    
    
    return {
      success: true,
      data: {
        dates: [], // 模板数据不需要具体日期
        schedules: schedulesByDay
      }
    };
  } catch (error) {
    console.error('获取活动课表模板数据失败:', error);
    return {
      success: false,
      data: { dates: [], schedules: [] },
      error: error.message
    };
  }
};