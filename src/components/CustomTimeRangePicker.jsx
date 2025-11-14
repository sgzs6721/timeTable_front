import React, { useState } from 'react';
import { TimePicker } from 'antd';
import dayjs from 'dayjs';

const CustomTimeRangePicker = (props) => {
  const { value, onChange, ...restProps } = props;

  const handleChange = (dates) => {
    if (onChange) {
      onChange(dates);
    }
  };

  return (
    <TimePicker.RangePicker
      value={value}
      onChange={handleChange}
      {...restProps}
      renderExtraFooter={() => null}
    />
  );
};

export default CustomTimeRangePicker;
