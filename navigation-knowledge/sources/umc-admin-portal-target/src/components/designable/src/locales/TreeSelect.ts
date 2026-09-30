export const TreeSelect = {

  'en-US': {
    title: 'TreeSelect',
    settings: {
      'x-component-props': {
        mode: {
          title: 'Mode',
          dataSource: ['Multiple', 'Tags', 'Single'],
        },
        autoClearSearchValue: {
          title: 'Auto Clear Search Value',
          tooltip: 'Only used to multiple and tags mode',
        },
        defaultActiveFirstOption: 'Default Active First Option',
        defaultOpen: 'Default Open',
        filterOption: 'Filter Option',
        filterSort: 'Filter Sort',
        labelInValue: 'Label In Value',
        listHeight: 'List Height',
        maxTagCount: 'Max Tag Count',
        maxTagPlaceholder: {
          title: 'Max Tag Placeholder',
          tooltip: 'Content displayed when tag is hidden',
        },
        maxTagTextLength: 'Max Tag Text Length',
        notFoundContent: 'Not Found Content',
        showArrow: 'Show Arrow',
        virtual: 'Use Virtual Scroll',
        dropdownMatchSelectWidth: {
          title: 'Dropdown Match Select Width',
          tooltip:
            'By default, min-width will be set, and it will be ignored when the value is less than the width of the selection box. false will turn off virtual scrolling',
        },
        showCheckedStrategy: {
          title: 'Show Checked Strategy',
          tooltip:
            'When configuring treeCheckable, define how to backfill the selected item. TreeSelect.SHOW_ALL: Show all selected nodes (including parent nodes). TreeSelect.SHOW_PARENT: Only display the parent node (when all child nodes under the parent node are selected). Only show child nodes by default',
          dataSource: ['Show All', 'Show Parent Node', 'Show Child Nodes'],
        },
        treeCheckable: 'Tree Checkable',
        treeDefaultExpandAll: 'Tree Default Expand All',
        treeDefaultExpandedKeys: {
          title: 'Tree Default Expanded Keys',
          tooltip: 'Format：Array<string | number>',
        },
        treeNodeFilterProp: {
          title: 'Tree Node Filter Properties',
          tooltip:
            'The treeNode attribute corresponding to the input item filter',
        },
        treeDataSimpleMode: {
          title: 'Tree Data Simple Mode',
          tooltip: `Use treeData in a simple format. For specific settings, refer to the settable type (the treeData should be a data structure like this: [{id:1, pId:0, value:'1', title:"test1",...} ,...], pId is the id of the parent node)`,
        },
        treeNodeLabelProp: {
          title: 'Tree Node Label Properties',
          tooltip: 'The default is title',
        },
        filterTreeNode: 'Filter Tree Node',
      },
    },
  },
  'ar-AE': {
    title: 'اختيار شجري',
    settings: {
      'x-component-props': {
        mode: {
          title: 'الوضع',
          dataSource: ['Multiple', 'Tags', 'Single'],
        },
        autoClearSearchValue: {
          title: 'مسح قيمة البحث تلقائياً',
          tooltip: 'Only used to multiple and tags mode',
        },
        defaultActiveFirstOption: 'Default Active First Option',
        defaultOpen: 'Default Open',
        filterOption: 'Filter Option',
        filterSort: 'Filter Sort',
        labelInValue: 'Label In Value',
        listHeight: 'List Height',
        maxTagCount: 'Max Tag Count',
        maxTagPlaceholder: {
          title: 'نص وسوم مخفية',
          tooltip: 'Content displayed when tag is hidden',
        },
        maxTagTextLength: 'Max Tag Text Length',
        notFoundContent: 'Not Found Content',
        showArrow: 'Show Arrow',
        virtual: 'Use Virtual Scroll',
        dropdownMatchSelectWidth: {
          title: 'مطابقة عرض القائمة',
          tooltip:
            'By default, min-width will be set, and it will be ignored when the value is less than the width of the selection box. false will turn off virtual scrolling',
        },
        showCheckedStrategy: {
          title: 'استراتيجية إظهار المحدد',
          tooltip:
            'When configuring treeCheckable, define how to backfill the selected item. TreeSelect.SHOW_ALL: Show all selected nodes (including parent nodes). TreeSelect.SHOW_PARENT: Only display the parent node (when all child nodes under the parent node are selected). Only show child nodes by default',
          dataSource: ['Show All', 'Show Parent Node', 'Show Child Nodes'],
        },
        treeCheckable: 'Tree Checkable',
        treeDefaultExpandAll: 'Tree Default Expand All',
        treeDefaultExpandedKeys: {
          title: 'مفاتيح التوسيع الافتراضية للشجرة',
          tooltip: 'Format：Array<string | number>',
        },
        treeNodeFilterProp: {
          title: 'خصائص تصفية عقد الشجرة',
          tooltip:
            'The treeNode attribute corresponding to the input item filter',
        },
        treeDataSimpleMode: {
          title: 'وضع بيانات الشجرة المبسط',
          tooltip: `Use treeData in a simple format. For specific settings, refer to the settable type (the treeData should be a data structure like this: [{id:1, pId:0, value:'1', title:"test1",...} ,...], pId is the id of the parent node)`,
        },
        treeNodeLabelProp: {
          title: 'خصائص تسمية عقد الشجرة',
          tooltip: 'The default is title',
        },
        filterTreeNode: 'Filter Tree Node',
      },
    },
  },
  'ko-KR': {
    title: '트리 셀렉터',
    settings: {
      'x-component-props': {
        mode: {
          title: '모드',
          dataSource: ['다중', '태그', '단일'],
        },
        autoClearSearchValue: {
          title: '검색값 자동 삭제',
          tooltip: '다중 모드와 태그 모드에서만 사용 가능',
        },
        defaultActiveFirstOption: '기본 활성값으로 첫번째 옵션 사용',
        defaultOpen: '기본 오픈',
        filterOption: '옵션 필터',
        filterSort: '정렬 필터',
        labelInValue: '레이블 입력 값',
        listHeight: '리스트 높이',
        maxTagCount: '최대 태그 개수',
        maxTagPlaceholder: {
          title: '최대 태그 Placeholder',
          tooltip: '태그가 숨김일때 보여줍니다.',
        },
        maxTagTextLength: '최대 태그 문자 길이',
        notFoundContent: '내용 없음',
        showArrow: '화살표 보기',
        virtual: '수직 스크롤 사용',
        dropdownMatchSelectWidth: {
          title: '드롭다운 너비 맞추기',
          tooltip:
            '기본적으로 최소 너비가 설정되며 값이 선택 상자의 너비보다 작으면 무시됩니다.',
        },
        showCheckedStrategy: {
          title: '선택한 전략 표시',
          tooltip:
            'treeCheckable을 구성할 때 선택한 항목을 다시 채우는 방법을 정의합니다. TreeSelect.SHOW_ALL: 선택한 모든 노드(상위 노드 포함)를 표시합니다. TreeSelect.SHOW_PARTE: 상위 노드 아래의 모든 하위 노드를 선택한 경우에만 상위 노드를 표시합니다. 기본적으로 하위 노드만 표시합니다',
          dataSource: ['모두 보기', '부모 노드만 보기', '자식 노드만 보기'],
        },
        treeCheckable: '트리 체크 가능 여부',
        treeDefaultExpandAll: '트리 기본 모두 확장',
        treeDefaultExpandedKeys: {
          title: '트리 기본 확장 키',
          tooltip: '형식：Array<string | number>',
        },
        treeNodeFilterProp: {
          title: '트리 노드 필터 속성',
          tooltip: '입력 항목 필터에 해당하는 treeNode 속성',
        },
        treeDataSimpleMode: {
          title: '트리 데이터 심플 모드',
          tooltip: `treeData를 간단한 형식으로 사용합니다. 특정 설정은 설정가능한 유형을 참조하세요 (트리데이터는 다음과 같은 데이터 구조여야 합니다: [{id:1, pId:0, value:'1', title:"test1",...} ,...], pId는 id의 상위 노드입니다).`,
        },
        treeNodeLabelProp: {
          title: '트리 노드 레이블 속성',
          tooltip: '기본 값은 제목',
        },
        filterTreeNode: '트리 노드 필터',
      },
    },
  },
}
