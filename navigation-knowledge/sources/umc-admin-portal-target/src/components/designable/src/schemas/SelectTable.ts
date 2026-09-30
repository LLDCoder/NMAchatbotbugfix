import { ISchema } from '@formily/react'

export const SelectTable: ISchema = {
  type: 'object',
  properties: {
    activityTitle: {
      type: 'string',
      title: 'Activity Title',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter Activity Title',
      },
      default: 'Media Activity',
    },
    activityLabelName: {
      type: 'string',
      title: 'Label Name',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter label name',
      },
      default: 'Activities',
    },
    placeholder: {
      title: 'Placeholder Text',
      type: 'string',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter placeholder text',
      },
      default: 'Search or Select from the list of Activities',
    },
    activityConfiguration: {
      title: 'Activity Configuration',
      type: 'object',
      'x-decorator': 'FormItem',
      'x-component': 'ActivityConfigurationSetter',
    },
    visible: {
      type: 'boolean',
      title: 'Visible',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
      default: true,
    },
    editable: {
      title: 'Editable',
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
      default: true,
    },
    allowRemovePrefilled: {
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
    },
    allowAddOtherOptions: {
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
    },
  },
}



