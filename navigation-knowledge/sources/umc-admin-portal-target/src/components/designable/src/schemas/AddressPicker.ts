import type { ISchema } from '@formily/react'

export const AddressPicker: ISchema = {
  type: 'object',
  properties: {
    title: {
      "type": "string",
      "x-decorator": "FormItem",
      "x-component": "Input"
    }
  }
}
