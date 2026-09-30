export const ArrayTable = {

  'en-US': {
    title: 'Array Table',
    defaultColumnTitle: 'Title',
    addSortHandle: 'Add Sort Handle',
    addColumn: 'Add Column',
    addIndex: 'Add Index',
    addOperation: 'Add Operations',
    settings: {
      'x-component-props': {
        showHeader: 'Show Header',
        sticky: 'Sticky',
        align: {
          title: 'Align',
          dataSource: ['Left', 'Right', 'Center'],
        },
        colSpan: 'Col Span',
        fixed: { title: 'Fixed', dataSource: ['Left', 'Right', 'None'] },
        width: 'Width',
        defaultValue: 'Default Value',
        tableLayout: {
          title: 'Table Layout',
          dataSource: ['Auto', 'Fixed'],
        },
      },
    },
  },
  'ar-AE': {
    title: 'جدول مصفوفة',
    defaultColumnTitle: 'العنوان',
    addSortHandle: 'Add Sort Handle',
    addColumn: 'Add Column',
    addIndex: 'Add Index',
    addOperation: 'Add Operations',
    settings: {
      'x-component-props': {
        showHeader: 'Show Header',
        sticky: 'Sticky',
        align: {
          title: 'المحاذاة',
          dataSource: ['Left', 'Right', 'Center'],
        },
        colSpan: 'Col Span',
        fixed: { title: 'ثابت', dataSource: ['Left', 'Right', 'None'] },
        width: 'Width',
        defaultValue: 'Default Value',
        tableLayout: {
          title: 'تخطيط الجدول',
          dataSource: ['Auto', 'Fixed'],
        },
      },
    },
  },
  'ko-KR': {
    title: '배열 테이블',
    addSortHandle: '정렬 핸들 추가',
    addColumn: '열 추가',
    addIndex: '색인 추가',
    addOperation: '작업 추가',
    settings: {
      'x-component-props': {
        showHeader: '헤더 보여주기',
        sticky: '고정',
        align: {
          title: '정렬',
          dataSource: ['왼쪽', '오른쪽', '가운데'],
        },
        colSpan: 'colSpan',
        fixed: { title: '고정', dataSource: ['왼쪽', '오른쪽', '없음'] },
        width: '너비',
        defaultValue: '기본 값',
      },
    },
  },
}

export const ArrayTableColumn = {

  'en-US': {
    title: 'Column',
    settings: {
      'x-component-props': {
        title: 'Title',
        align: {
          title: 'Align',
          dataSource: ['Left', 'Right', 'Center'],
        },
        colSpan: 'Col Span',
        width: 'Width',
        fixed: {
          title: 'Fixed',
          dataSource: ['Left', 'Right', 'None'],
        },
      },
    },
  },
  'ar-AE': {
    title: 'عمود',
    settings: {
      'x-component-props': {
        title: 'العنوان',
        align: {
          title: 'المحاذاة',
          dataSource: ['يسار', 'يمين', 'وسط'],
        },
        colSpan: 'امتداد العمود',
        width: 'العرض',
        fixed: {
          title: 'ثابت',
          dataSource: ['يسار', 'يمين', 'بلا تثبيت'],
        },
      },
    },
  },
  'ko-KR': {
    title: '열',
    settings: {
      'x-component-props': {
        title: '제목',
        align: {
          title: '정렬',
          dataSource: ['왼쪽', '오른쪽', '가운데'],
        },
        colSpan: 'Col Span',
        width: '너비',
        fixed: {
          title: '고정',
          dataSource: ['왼쪽', '오른족', '없음'],
        },
      },
    },
  },
}
