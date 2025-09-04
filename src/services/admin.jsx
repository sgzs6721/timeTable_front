import api from './auth';

// 获取所有课表
export const getAllTimetables = async () => {
  try {
    const response = await api.get('/admin/timetables');
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

// 获取所有用户列表
export const getAllUsers = async () => {
  try {
    const response = await api.get('/admin/users');
    return response;
  } catch (error) {
    throw error;
  }
};

// 更新用户权限
export const updateUserRole = async (userId, role) => {
  try {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response;
  } catch (error) {
    throw error;
  }
};

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
export const approveUserRegistration = async (userId) => {
  try {
    const response = await api.put(`/admin/users/${userId}/approve`);
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
export const clearTimetableSchedulesByAdmin = async (timetableId) => {
  try {
    const response = await api.delete(`/admin/timetables/${timetableId}/schedules/clear`);
    return response;
  } catch (error) {
    throw error;
  }
}; 