import React from 'react'
import { Divider as DividerComponent } from './Divider'
import { createBehavior, createResource } from '@designable/core'
import { DnFC } from '@designable/react'
import { createVoidFieldSchema } from '../Field'
import { AllSchemas } from '../../schemas'
import { AllLocales } from '../../locales'
import { resourceIcons } from '../../assets/resource-icons'

export const Divider: DnFC<React.ComponentProps<typeof DividerComponent>> =
  DividerComponent

Divider.Behavior = createBehavior({
  name: 'Divider',
  extends: ['Field'],
  selector: (node) => node.props['x-component'] === 'Divider',
  designerProps: {
    propsSchema: AllSchemas.Divider,
    defaultProps: {
      // name: "Divider",
      'x-component-props': {
        lineStyle: 'solid',
      },
    },
  },
  designerLocales: AllLocales.Divider,
})

Divider.Resource = createResource({
  icon: resourceIcons.divider,
  elements: [
    {
      componentName: 'Field',
      props: {
        // name: "Divider",
        type: 'void',
        'x-decorator': 'FormItem',
        'x-decorator-props': { colon: false, label: false },
        'x-component': 'Divider',
        'x-component-props': {
          lineStyle: 'solid',
        },
      },
    },
  ],
})
