import { ISchema } from '@formily/react'

export const Divider: ISchema = {
  type: 'object',
  properties: {
    lineStyle: {
      type: 'string',
      'x-decorator': 'FormItem',
      'x-decorator-props': {
        label: 'Style',
      },
      'x-component': 'DividerStyleSetter',
      'x-component-props': {
        defaultValue: 'solid',
      },
    },
  },
}
