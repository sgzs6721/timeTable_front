import React, { useEffect } from 'react';
import { Modal, Form, Input, TimePicker, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker: TimeRangePicker } = TimePicker;

// 星期选项
const dayOptions = [
  { label: '周一', value: 'MONDAY' },
  { label: '周二', value: 'TUESDAY' },
  { label: '周三', value: 'WEDNESDAY' },
  { label: '周四', value: 'THURSDAY' },
  { label: '周五', value: 'FRIDAY' },
  { label: '周六', value: 'SATURDAY' },
  { label: '周日', value: 'SUNDAY' },
];

/**
 * 编辑排课弹窗
 * @param {boolean} visible 是否可见
 * @param {Function} onCancel 取消回调
 * @param {Function} onOk 确认回调，返回转换后的排课数据
 * @param {Object} schedule 当前排课对象
 * @param {Object} timetable 所属课表（用于判断是否 weekly）
 */
const EditScheduleModal = ({ visible, onCancel, onOk, schedule, timetable }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && schedule) {
      const initialValues = {
        studentName: schedule.studentName,
        dayOfWeek: schedule.dayOfWeek,
        scheduleDate: schedule.scheduleDate ? dayjs(schedule.scheduleDate) : null,
        timeRange: [
          dayjs(schedule.startTime, 'HH:mm:ss').isValid()
            ? dayjs(schedule.startTime, 'HH:mm:ss')
            : dayjs(schedule.startTime, 'HH:mm'),
          dayjs(schedule.endTime, 'HH:mm:ss').isValid()
            ? dayjs(schedule.endTime, 'HH:mm:ss')
            : dayjs(schedule.endTime, 'HH:mm'),
        ],
      };
      form.setFieldsValue(initialValues);
    } else {
      form.resetFields();
    }
  }, [visible, schedule]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const { studentName, dayOfWeek, scheduleDate, timeRange } = values;
      const [start, end] = timeRange;
      const payload = {
        studentName,
        dayOfWeek: timetable.isWeekly ? dayOfWeek : schedule?.dayOfWeek,
        scheduleDate: !timetable.isWeekly && scheduleDate ? scheduleDate.format('YYYY-MM-DD') : null,
        startTime: start.format('HH:mm:ss'),
        endTime: end.format('HH:mm:ss'),
        note: '修改排课',
      };
      onOk(payload);
    });
  };

  return (
    <Modal
      title="编辑排课"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="学生姓名"
          name="studentName"
          rules={[{ required: true, message: '请输入学生姓名' }]}
        >
          <Input />
        </Form.Item>

        {timetable?.isWeekly ? (
          <Form.Item
            label="星期"
            name="dayOfWeek"
            rules={[{ required: true, message: '请选择星期' }]}
          >
            <Select options={dayOptions} />
          </Form.Item>
        ) : (
          <Form.Item
            label="日期"
            name="scheduleDate"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
        )}

        <Form.Item
          label="时间段"
          name="timeRange"
          rules={[{ required: true, message: '请选择时间段' }]}
        >
          <TimeRangePicker format="HH:mm" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditScheduleModal; 