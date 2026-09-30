import type { ComponentProps } from 'react'
import { Address as AddressComponent } from './Address'
import { createBehavior, createResource } from '@designable/core'
import { connect, mapProps } from '@formily/react'
import type { DnFC } from '@designable/react'
import { AllSchemas } from '../../schemas'
import { createVoidFieldSchema } from '../Field'
import { AllLocales } from '../../locales'

// export const Address: DnFC<React.ComponentProps<typeof AntdCard>> = (props) => {
//   return (
//     <AntdCard
//       {...props}
//       title={
//         <span data-content-editable="x-component-props.title">
//           Address
//         </span>
//       }
//     >
//       {props.children}
//     </AntdCard>
//   )
// }

export const Address = connect(
  AddressComponent,
  mapProps(
    (props) => {
      return { ...props }
    }
  )
) as DnFC<ComponentProps<typeof AddressComponent>>

Address.Behavior = createBehavior({
  name: 'Address',
  extends: ['Field'],
  selector: (node) => node.props?.['x-component'] === 'Address',
  designerProps: {
    droppable: true,
    propsSchema: createVoidFieldSchema(AllSchemas.Address),
  },
  designerLocales: AllLocales.Address,
})

Address.Resource = createResource({
  title: {'en-US': 'Address' },
  icon: 'SelectSource',
  elements: [
    {
      componentName: 'Field',
      props: {
        type: 'void',
        'x-component': 'Card',
        'x-decorator': 'FormItem',
        properties: {
          grid: {
            type: "void",
            "x-component": "FormGrid",
            "x-component-props": {
              maxColumns: 2,
              minColumns: 2
            },
            properties: {
              emirate: {
                type: 'string',
                title: 'Emirate',
                'x-decorator': 'FormItem',
                'x-component': 'Select',
                'x-component-props': {
                  placeholder: 'Select emirate',
                },
                enum: [
                  { label: 'Abu Dhabi', value: 'abu dhabi' },
                  { label: 'Dubai', value: 'dubai' },
                  { label: 'Sharjah', value: 'sharjah' },
                  { label: 'Ajman', value: 'ajman' },
                  { label: 'Umm Al Quwain', value: 'umm al quwain' },
                  { label: 'Ras Al Khaimah', value: 'ras al khaimah' },
                  { label: 'Fujairah', value: 'fujairah' },
                ],
                "x-reactions": {
                  dependencies: ['.emirate'],
                  fulfill: {
                    state: {
                      required: 'true',
                    },
                  },
                },
              },
              region: {
                type: 'string',
                title: 'Region',
                'x-decorator': 'FormItem',
                'x-component': 'Select',
                'x-component-props': {
                  placeholder: 'Select region',
                },
                enum: [
                  { label: 'Abu Dhabi Island', value: 'abu dhabi island' },
                  { label: 'Al Khalidiyah', value: 'al khalidiyah' },
                  { label: 'Al Bateen', value: 'al bateen' },
                  { label: 'Corniche Area', value: 'corniche area' },
                  { label: 'Electra Street / Tourist Club Area（TCA）', value: 'electra street / tourist club area' },
                  { label: 'Al Zahiyah', value: 'al zahiyah' },
                  { label: 'Madinat Zayed', value: 'madinat zayed' },
                  { label: 'Al Markaziyah', value: 'al markaziyah' },
                ],
                'x-reactions': {
                  dependencies: ['.emirate'],
                  fulfill: {
                    state: {
                      visible: '{{$deps[0] === "abu dhabi"}}',
                      "required": '{{$deps[0] === "abu dhabi"}}',
                    },
                  },
                },
              },
              area: {
                type: 'string',
                title: 'Area',
                'x-decorator': 'FormItem',
                'x-component': 'Select',
                'x-component-props': {
                  placeholder: 'Select area',
                },
                'x-reactions': {
                  dependencies: ['.emirate', '.region'],
                  fulfill: {
                    state: {
                      visible: '{{$deps[0] === "abu dhabi" && $deps[1]}}',
                      "required": '{{$deps[0] === "abu dhabi" && $deps[1]}}',
                      dataSource: `{{(() => {
                        const region = $deps[1];
                        if (!region) return [];
                        const regionLower = region.toLowerCase();
                        const areaOptions = {
                          'abu dhabi island': [
                            { label: 'Area 1', value: 'area1' },
                            { label: 'Area 2', value: 'area2' }
                          ],
                          'al khalidiyah': [
                            { label: 'Area 3', value: 'area3' },
                            { label: 'Area 4', value: 'area4' }
                          ],
                          'al bateen': [
                            { label: 'Area 5', value: 'area5' },
                            { label: 'Area 6', value: 'area6' }
                          ],
                          'corniche area': [
                            { label: 'Area 7', value: 'area7' },
                            { label: 'Area 8', value: 'area8' }
                          ],
                          'electra street / tourist club area': [
                            { label: 'Area 9', value: 'area9' },
                            { label: 'Area 10', value: 'area10' }
                          ],
                          'al zahiyah': [
                            { label: 'Area 11', value: 'area11' },
                            { label: 'Area 12', value: 'area12' }
                          ],
                          'madinat zayed': [
                            { label: 'Area 13', value: 'area13' },
                            { label: 'Area 14', value: 'area14' }
                          ],
                          'al markaziyah': [
                            { label: 'Area 15', value: 'area15' },
                            { label: 'Area 16', value: 'area16' }
                          ]
                        };
                        return areaOptions[regionLower] || [];
                      })()}}`,
                    },
                  },
                },
              },
              street: {
                type: 'string',
                title: 'Street',
                'x-decorator': 'FormItem',
                'x-component': 'Input',
                'x-component-props': {
                  placeholder: 'Enter street',
                },
                "x-reactions": {
                  dependencies: ['.emirate', '.region', '.area'],
                  fulfill: {
                    state: {
                      required: "true",
                    },
                  },
                },
              },
            }
          }
        },
      },
    },
  ],
})
