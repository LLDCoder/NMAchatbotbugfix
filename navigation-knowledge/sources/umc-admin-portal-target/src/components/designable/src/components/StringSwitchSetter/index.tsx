import * as React from 'react';
import { Switch } from 'antd';
import './index.less';

export interface StringSwitchSetterProps {
  value?: string;
  onChange?: (value: string) => void;
  checkedValue?: string;
  unCheckedValue?: string;
  defaultValue?: string;
}

const StringSwitchSetter: React.FC<StringSwitchSetterProps> = (props) => {
  const {
    value,
    onChange,
    checkedValue = 'true',
    unCheckedValue = 'false',
    defaultValue
  } = props;


  const currentValue = value ?? defaultValue ?? unCheckedValue;
  

  const isChecked = currentValue === checkedValue;

  const handleChange = (checked: boolean) => {
    if (onChange) {
      const newValue = checked ? checkedValue : unCheckedValue;
      onChange(newValue);
    }
  };

  return (
    <div className="string-switch-setter">
      <Switch checked={isChecked} onChange={handleChange} />
    </div>
  );
};

export default StringSwitchSetter;

