import React from 'react'
import './DividerStyleSetter.less'

export type DividerStyleValue = 'solid' | 'dashed'

export interface DividerStyleSetterProps {
  value?: DividerStyleValue
  onChange?: (value: DividerStyleValue) => void
  defaultValue?: DividerStyleValue
}

const DividerStyleSetter: React.FC<DividerStyleSetterProps> = (props) => {
  const { value, onChange, defaultValue = 'solid' } = props
  const current = value ?? defaultValue ?? 'solid'

  const handleSelect = (val: DividerStyleValue) => {
    onChange?.(val)
  }

  return (
    <div className="divider-style-setter">
      <div
        className={`divider-style-option ${current === 'solid' ? 'active' : ''}`}
        onClick={() => handleSelect('solid')}
      >
        <div className="divider-line-preview solid" />
      </div>
      <div
        className={`divider-style-option ${current === 'dashed' ? 'active' : ''}`}
        onClick={() => handleSelect('dashed')}
      >
        <div className="divider-line-preview dashed" />
      </div>
    </div>
  )
}

export default DividerStyleSetter
