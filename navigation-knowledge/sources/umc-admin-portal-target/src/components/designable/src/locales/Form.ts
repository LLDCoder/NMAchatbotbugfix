import { createLocales } from '@designable/core'
import { Component } from './Component'

export const Form = createLocales(Component, {

  'en-US': {
    title: 'Form',
    settings: {
      labelCol: 'Label Col',
      wrapperCol: 'Wrapper Col',
      colon: 'Colon',
      labelAlign: {
        title: 'Label Align',
        dataSource: ['Left', 'Right', 'Inherit'],
      },
      wrapperAlign: {
        title: 'Wrapper Align',
        dataSource: ['Left', 'Right', 'Inherit'],
      },
      labelWrap: 'Label Wrap',
      wrapperWrap: 'Wrapper Wrap',
      labelWidth: 'Label Width',
      wrapperWidth: 'Wrapper Width',
      fullness: 'Fullness',
      inset: 'Inset',
      shallow: 'Shallow',
      bordered: 'Bordered',
      size: {
        title: 'Size',
        dataSource: ['Large', 'Small', 'Default', 'Inherit'],
      },
      layout: {
        title: 'Layout',
        dataSource: ['Vertical', 'Horizontal', 'Inline', 'Inherit'],
      },
      feedbackLayout: {
        title: 'Feedback Layout',
        dataSource: ['Loose', 'Terse', 'Popup', 'None', 'Inherit'],
      },
      tooltipLayout: {
        title: 'Tooltip Layout',
        dataSource: ['Icon', 'Text', 'Inherit'],
      },
    },
  },
  'ar-AE': {
    title: 'نموذج',
    settings: {
      labelCol: 'Label Col',
      wrapperCol: 'Wrapper Col',
      colon: 'Colon',
      labelAlign: {
        title: 'محاذاة التسمية',
        dataSource: ['Left', 'Right', 'Inherit'],
      },
      wrapperAlign: {
        title: 'محاذاة الغلاف',
        dataSource: ['Left', 'Right', 'Inherit'],
      },
      labelWrap: 'Label Wrap',
      wrapperWrap: 'Wrapper Wrap',
      labelWidth: 'Label Width',
      wrapperWidth: 'Wrapper Width',
      fullness: 'Fullness',
      inset: 'Inset',
      shallow: 'Shallow',
      bordered: 'Bordered',
      size: {
        title: 'الحجم',
        dataSource: ['Large', 'Small', 'Default', 'Inherit'],
      },
      layout: {
        title: 'التخطيط',
        dataSource: ['Vertical', 'Horizontal', 'Inline', 'Inherit'],
      },
      feedbackLayout: {
        title: 'تخطيط التغذية الراجعة',
        dataSource: ['Loose', 'Terse', 'Popup', 'None', 'Inherit'],
      },
      tooltipLayout: {
        title: 'تخطيط التلميح',
        dataSource: ['Icon', 'Text', 'Inherit'],
      },
    },
  },
  'ko-KR': {
    title: '폼',
    settings: {
      labelCol: 'Label Col',
      wrapperCol: 'Wrapper Col',
      colon: 'Colon',
      labelAlign: {
        title: 'Label 정렬',
        dataSource: ['왼쪽', '오른쪽', '상속'],
      },
      wrapperAlign: {
        title: 'Wrapper 정렬',
        dataSource: ['왼쪽', '오른쪽', '상속'],
      },
      labelWrap: 'Label Wrap',
      wrapperWrap: 'Wrapper Wrap',
      labelWidth: 'Label Width',
      wrapperWidth: 'Wrapper Width',
      fullness: 'Fullness',
      inset: 'Inset',
      shallow: 'Shallow',
      bordered: 'Bordered',
      size: {
        title: '크기',
        dataSource: ['크게', '작게', '보통', '상속'],
      },
      layout: {
        title: '레이아웃',
        dataSource: ['수직', '수평', '인라인', '상속'],
      },
      feedbackLayout: {
        title: '피드백 레이아웃',
        dataSource: ['Loose', 'Terse', '팝업', '없음', '상속'],
      },
      tooltipLayout: {
        title: '툴팁 레이아웃',
        dataSource: ['아이콘', '텍스트', '상속'],
      },
    },
  },
})
