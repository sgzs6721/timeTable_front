// 课表、排课操作和预览共用的时间范围，结束小时不包含在开始时间内。
export const TIMETABLE_START_HOUR = 9;
export const TIMETABLE_END_HOUR = 21;

export const TIMETABLE_TIME_SLOTS = Array.from(
  { length: TIMETABLE_END_HOUR - TIMETABLE_START_HOUR },
  (_, index) => {
    const hour = TIMETABLE_START_HOUR + index;
    const formatHour = value => `${String(value).padStart(2, '0')}:00`;
    return `${formatHour(hour)}-${formatHour(hour + 1)}`;
  }
);
