import { ISchema } from '@formily/react'

export const Address: ISchema = {
  type: 'object',
  properties: {
    title: {
      "type": "string",
      "x-decorator": "FormItem",
      "x-component": "Input"
    }
  }
}