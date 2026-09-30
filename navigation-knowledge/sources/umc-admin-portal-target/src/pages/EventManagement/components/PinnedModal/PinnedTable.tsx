import { TablePanel } from '@/components/common';
import { usePagination } from '@/hooks/usePagination';
import { Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useState, useEffect } from 'react';
import { SortableContainer, SortableElement, SortableHandle } from 'react-sortable-hoc';
import type { SortableContainerProps, SortEnd } from 'react-sortable-hoc';
import { arrayMoveImmutable } from 'array-move';
import type { IPinnedTableProps } from './type';
import type { IPinnedNewsItem } from '@/services/cms';
import { HolderOutlined } from "@ant-design/icons"
import { useTranslation } from "react-i18next";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from '@/hooks/useResponsiveActionColumnWidth';
import './index.less'

type PinnedEventActionKey = 'remove';

const PINNED_EVENT_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<PinnedEventActionKey> = {};

const PINNED_EVENT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 72,
  maxWidth: 120,
};

const PINNED_EVENT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 72,
  maxWidth: 104,
};

const PINNED_EVENT_ACTION_TEXT_MEASURE_CONFIG = {
  font: "400 14px Inter, sans-serif",
  narrowFont: "400 12px Inter, sans-serif",
  textPadding: 0,
};

const DragHandle = SortableHandle(() => (
  <Button
    type="text"
    size="small"
    icon={<HolderOutlined />}
    className="drag-handle-button"
    style={{ cursor: 'grab' }}
  />
));

const SortableItem = SortableElement((props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} />
));

const SortableBody = SortableContainer((props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
));

export const PinnedTable: React.FC<IPinnedTableProps> = (props) => {
  const { t } = useTranslation();
  const [data, setData] = useState(props.data);
  const [pageInfo] = usePagination();
  const getVisiblePinnedEventActions = () => ['remove'] as const;
  const getPinnedEventActionLabel = () =>
    t("CMS.eventManagement.modals.managePinnedEvents.remove");
  const pinnedEventActionColumnWidth = useResponsiveActionColumnWidth<
    IPinnedNewsItem,
    PinnedEventActionKey
  >({
    rows: data,
    buttonWidthMap: PINNED_EVENT_ACTION_WIDTH_MAP,
    getVisibleActions: getVisiblePinnedEventActions,
    getActionLabel: getPinnedEventActionLabel,
    desktopConfig: PINNED_EVENT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: PINNED_EVENT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: PINNED_EVENT_ACTION_TEXT_MEASURE_CONFIG,
  });

  useEffect(() => {
    const sortedData = [...props.data].sort((a, b) => {
      const sortA = a.sort ?? 0;
      const sortB = b.sort ?? 0;
      return sortA - sortB;
    });
    setData(sortedData);
  }, [props.data]);

  const columns: ColumnsType<IPinnedNewsItem> = [
    {
      key: 'drag',
      width: 50,
      render: () => <DragHandle />,
    },
    {
      title: t("CMS.eventManagement.modals.managePinnedEvents.order"),
      dataIndex: 'sort',
      width: 100,
      key: 'sort',
      render: (text, record, index) => <div className="Order-column">{index + 1}</div>,
    },
    {
      title: t("CMS.eventManagement.modals.managePinnedEvents.pinnedNewsTitle"),
      dataIndex: 'titleEn',
      key: 'titleEn',
      ellipsis: {
        showTitle: false,
      }
    },
    {
      title: t("CMS.eventManagement.modals.managePinnedEvents.actions"),
      className: 'actions-column',
      width: pinnedEventActionColumnWidth,
      render: (_, record) => (
        <div className="pinned-table-action" onClick={()=>{props.Remove?.(record.id)}}>
          {t("CMS.eventManagement.modals.managePinnedEvents.remove")}
        </div>
      )
    },
  ];

  const onSortEnd = ({ oldIndex, newIndex }: SortEnd) => {
    if (oldIndex !== newIndex) {
      let newData = data.slice();
      newData = arrayMoveImmutable(newData, oldIndex, newIndex).filter(Boolean);
      const newListData = newData.map((item, index) => ({
        ...item,
        sort: index + 1,
      }));
      setData(newListData);
      props.onSortChange?.(newListData);
    }
  };

  const DraggableContainer = (props: SortableContainerProps) => (
    <SortableBody
      useDragHandle
      disableAutoscroll
      helperClass="sortable-helper"
      onSortEnd={onSortEnd}
      {...props}
    />
  );

  const DraggableBodyRow: React.FC<any> = ({ className, style, ...restProps }) => {
    const index = data.findIndex((x) => x.id === restProps['data-row-key']);
    return <SortableItem index={index >= 0 ? index : 0} {...restProps} />;
  };

  const components = {
    body: {
      wrapper: DraggableContainer,
      row: DraggableBodyRow,
    },
  };

  return (
    <div className='pinned-table-container'>
      <div className="pinned-table-header">
        <span className='header-order'>{t("CMS.eventManagement.modals.managePinnedEvents.currentPinnedOrder")}</span>
      </div>
      <TablePanel
        className='pinned-table'
        tableProps={{
          columns,
          dataSource: data,
          components,
          rowKey: "id",
          pagination: false
        }}
      />
    </div>
  );
};
