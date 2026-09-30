import React from 'react'
import { Divider as AntdDivider } from 'antd'
import './index.less'

export type DividerStyleType = 'solid' | 'dashed'

export interface IDesignableDividerProps {
  lineStyle?: DividerStyleType
  className?: string
}

export const Divider: React.FC<IDesignableDividerProps> = (props) => {
  const { lineStyle = 'solid', className, ...rest } = props

  const dashed = lineStyle === 'dashed'

  return (
    <div className="Formliy_AntdDivider">
      <AntdDivider dashed={dashed} className={className} {...rest} />
    </div>
  )
}
