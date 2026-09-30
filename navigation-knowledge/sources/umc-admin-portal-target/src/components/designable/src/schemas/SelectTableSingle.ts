import { ISchema } from '@formily/react'

export const SelectTableSingle: ISchema = {
  type: 'object',
  properties: {
    activityTitleEn: {
      type: 'string',
      title: 'Activity Title (EN)',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter Activity Title',
      },
      default: 'Media Activity',
    },
    activityTitleAr: {
      type: 'string',
      title: 'Activity Title (AR)',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter Activity Title (Arabic)',
      },
    },
    activityLabelNameEn: {
      type: 'string',
      title: 'Label Name (EN)',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter label name',
      },
      default: 'Activities',
    },
    activityLabelNameAr: {
      type: 'string',
      title: 'Label Name (AR)',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter label name (Arabic)',
      },
    },
    placeholderEn: {
      type: 'string',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter placeholder text',
      },
      default: 'Search or Select from the list of Activities',
    },
    placeholderAr: {
      type: 'string',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: 'Enter placeholder text (Arabic)',
      },
    },
    activityConfiguration: {
      type: 'object',
      'x-decorator': 'FormItem',
      'x-component': 'ActivityConfigurationSetter',
    },
    visible: {
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
      default: true,
    },
    editable: {
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        defaultChecked: true,
      },
      default: true,
    },
  },
}
