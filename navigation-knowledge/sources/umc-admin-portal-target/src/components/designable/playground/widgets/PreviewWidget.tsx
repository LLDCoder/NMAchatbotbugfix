import React, { useMemo } from 'react'
import { createForm } from '@formily/core'
import { createSchemaField } from '@formily/react'
import {
  Form,
  Checkbox,
  Cascader,
  Editable,
  NumberPicker,
  Switch,
  Password,
  PreviewText,
  Reset,
  Select,
  Space,
  Submit,
  TimePicker,
  Transfer,
  TreeSelect,
  Upload,
  FormGrid,
  FormLayout,
  FormTab,
  FormCollapse,
  ArrayTable,
  ArrayCards,
} from '@formily/antd'
import { Card, Slider, Rate } from 'antd'
import { DatePicker } from '../../src/components/DatePicker/preview'
import { TreeNode } from '@designable/core'
import { transformToSchema } from '@designable/formily-transformer'
import FormItemWithHtmlTooltip from '../../src/components/FormItemWithHtmlTooltip'
import { Radio, RadioGroupField } from '../../src/components/Radio/preview'
import '../../src/components/FormItemWithHtmlTooltip/index.less'
import { Input } from '../../src/components/Input/preview'
import { DurationInput } from '../../src/components/DurationInput/preview'

const Text: React.FC<{
  value?: string
  content?: string
  mode?: 'normal' | 'h1' | 'h2' | 'h3' | 'p'
}> = ({ value, mode, content, ...props }) => {
  const tagName = mode === 'normal' || !mode ? 'div' : mode
  return React.createElement(tagName, props, value || content)
}

const SchemaField = createSchemaField({
  components: {
    Space,
    FormGrid,
    FormLayout,
    FormTab,
    FormCollapse,
    ArrayTable,
    ArrayCards,
    FormItem: FormItemWithHtmlTooltip,
    DatePicker,
    Checkbox,
    Cascader,
    Editable,
    Input,
    DurationInput,
    Text,
    NumberPicker,
    Switch,
    Password,
    PreviewText,
    Radio,
    "Radio.Group": RadioGroupField,
    Reset,
    Select,
    Submit,
    TimePicker,
    Transfer,
    TreeSelect,
    Upload,
    Card,
    Slider,
    Rate,
  },
})

export interface IPreviewWidgetProps {
  tree: TreeNode
}

export const PreviewWidget: React.FC<IPreviewWidgetProps> = (props) => {
  const form = useMemo(() => createForm(), [])
  const { form: formProps, schema } = transformToSchema(props.tree)
  return (
    <Form {...formProps} form={form}>
      <SchemaField schema={schema} />
    </Form>
  )
}
