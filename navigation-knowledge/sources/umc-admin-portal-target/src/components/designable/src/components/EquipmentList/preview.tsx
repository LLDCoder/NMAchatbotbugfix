// DesignableEquipmentList.tsx
import { createBehavior, createResource } from '@designable/core';
import { useDesigner } from '@designable/react';
import { connect, mapProps } from '@formily/react';
import { DnFC } from '@designable/react';
import EquipmentListInner from './EquipmentList';
import { AllSchemas } from '../../schemas';
import { AllLocales } from '../../locales';
import { createVoidFieldSchema } from '../Field';

export const EquipmentList: DnFC<React.ComponentProps<typeof EquipmentListInner>> = connect(
  EquipmentListInner,
  mapProps((props, field) => {
    return {
      ...props,
      designMode: field?.designable ? true : false
    }
  }) 
);

EquipmentList.Behavior = createBehavior({
  name: 'EquipmentList',
  extends: ['Field'],
  selector: (node) => node.props['x-component'] === 'EquipmentList',
  designerProps: {
    defaultProps: {
      name: 'equipmentList'
    },
    propsSchema: {
      "type": "object",
      "properties": {
        "field-group": {
            "type": "void",
            "x-component": "CollapseItem",
            "properties": {
                // "name": {
                //     "type": "string",
                //     "x-decorator": "FormItem",
                //     "x-component": "Input"
                // },
                "title": {
                    "type": "string",
                    "x-decorator": "FormItem",
                    "x-component": "Input",
                },
                "x-decorator-props": {
                    "type": "object",
                    "properties": {
                        "tooltip": {
                            "type": "string",
                            "x-decorator": "FormItem",
                            "x-component": "Input"
                        }
                    }
                },
                "x-component-props": {
                  "type": "object",
                  "properties": {
                    addButtonText: {
                      type: "string",
                      "x-decorator": "FormItem",
                      "x-component": "Input",
                    },
                    fieldSource: {
                      type: "object",
                      "x-decorator": "FormItem",
                      "x-component": "DataSourceSetter",
                    },
                  }
                },
                "x-display": {
                  "type": "boolean",
                  "x-decorator": "FormItem",
                  "x-component": "StringSwitchSetter",
                  "default": 'visible',
                  "x-component-props": {
                    "checkedValue": "visible",
                    "unCheckedValue": "none"
                  },
                },
                "x-pattern": {
                  "type": "boolean",
                  "x-decorator": "FormItem",
                  "x-component": "StringSwitchSetter",
                  "default": 'editable',
                  "x-component-props": {
                    "checkedValue": "editable",
                    "unCheckedValue": "disabled"
                  },
                }
            }
        }
      },
    },
  },
  designerLocales: AllLocales.EquipmentList,
});

EquipmentList.Resource = createResource({
  title: {'en-US': 'Equipment List' },
  icon: 'TableOutlined',
  elements: [
    {
      componentName: 'Field',
      props: {
        type: 'array',
        'x-decorator': 'FormItem',
        'x-component': 'EquipmentList',
        title: 'Equipments',
      },
    },
  ],
});
