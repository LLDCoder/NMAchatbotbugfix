import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomButton, CustomMessage } from "@/components/common";
import SortTop from '@/assets/icons/SortTop';
import SortDown from '@/assets/icons/SortDown';
import { categoriesUpdateSort } from "@/services/serviceApi";
import { serviceCategoryIconList } from "../categoryIcons";
import type { ServiceCategory } from "@/services/serviceApi";
import { Button, Modal, Table } from 'antd';
import { HolderOutlined } from "@ant-design/icons";
import GameImg from "@/assets/images/game.png";
import type { SortableContainerProps, SortEnd } from 'react-sortable-hoc';
import { SortableContainer, SortableElement, SortableHandle } from 'react-sortable-hoc';
import { arrayMoveImmutable } from 'array-move';
import { useTranslation } from "react-i18next";
import {
    type ResponsiveActionColumnButtonWidthMap,
    useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";

interface SortModalProps {
    show: boolean;
    close: () => void;
    tableData: ServiceCategory[];
    updateData: () => void;
}

interface DraggableBodyRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    'data-row-key'?: string;
}

type SortModalActionKey = "sortUp" | "sortDown";

const SORT_MODAL_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<SortModalActionKey> = {
    sortUp: {
        default: 24,
        compact: 24,
    },
    sortDown: {
        default: 24,
        compact: 24,
    },
};

const SORT_MODAL_ACTION_COLUMN_DESKTOP_CONFIG = {
    gap: 8,
    padding: 32,
    minWidth: 88,
    maxWidth: 112,
};

const SORT_MODAL_ACTION_COLUMN_COMPACT_CONFIG = {
    gap: 8,
    padding: 32,
    minWidth: 88,
    maxWidth: 112,
};

const normalizeListData = (source?: ServiceCategory[] | null) => {
    if (!Array.isArray(source)) {
        return [];
    }

    return source.filter((item): item is ServiceCategory => Boolean(item?.id));
};

const DragHandle = SortableHandle(() => (
    <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        className="sort-modal-drag-handler"
    />
));
const SortableItem = SortableElement((props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} />
));
const SortableBody = SortableContainer((props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
));

const SortModal: React.FC<SortModalProps> = ({ show, close, tableData, updateData }) => {
    const { t, i18n } = useTranslation();
    const [listData, setListData] = useState<ServiceCategory[]>([]);
    const [saveLoading, setSaveLoading] = useState(false);
    const getVisibleSortModalActions = useCallback(
        () => ["sortUp", "sortDown"] as const,
        []
    );
    const sortModalActionColumnWidth = useResponsiveActionColumnWidth<
        ServiceCategory,
        SortModalActionKey
    >({
        rows: listData,
        buttonWidthMap: SORT_MODAL_ACTION_WIDTH_MAP,
        getVisibleActions: getVisibleSortModalActions,
        desktopConfig: SORT_MODAL_ACTION_COLUMN_DESKTOP_CONFIG,
        compactConfig: SORT_MODAL_ACTION_COLUMN_COMPACT_CONFIG,
    });

    useEffect(() => {
        setListData(normalizeListData(tableData));
    }, [tableData]);

    const resetDisplayOrder = useCallback((source: ServiceCategory[]) => {
        return source.map((item, index) => ({
            ...item,
            displayOrder: index + 1,
        }));
    }, []);

    const handleCancel = useCallback(() => {
        close();
    }, [close]);

    const sortUp = useCallback((targetIndex: number) => {
        setListData((prevList) => {
            if (!Array.isArray(prevList) || targetIndex <= 0 || targetIndex >= prevList.length) {
                return prevList;
            }

            const nextList = [...prevList];
            [nextList[targetIndex - 1], nextList[targetIndex]] = [nextList[targetIndex], nextList[targetIndex - 1]];

            return resetDisplayOrder(nextList);
        });
    }, [resetDisplayOrder]);

    const sortDown = useCallback((targetIndex: number) => {
        setListData((prevList) => {
            if (!Array.isArray(prevList) || targetIndex < 0 || targetIndex >= prevList.length - 1) {
                return prevList;
            }

            const nextList = [...prevList];
            [nextList[targetIndex], nextList[targetIndex + 1]] = [nextList[targetIndex + 1], nextList[targetIndex]];

            return resetDisplayOrder(nextList);
        });
    }, [resetDisplayOrder]);

    const columns = useMemo(() => [
        {
            title: '',
            key: 'dragHandler',
            className: 'drag-visible',
            render: ()=><DragHandle />
        },
        {
            title: t("serviceCategories.sortModal.order"),
            key: "displayOrder",
            dataIndex: "displayOrder",
            className: 'drag-visible',
            width: 150,
        },
        {
            title: t("serviceCategories.sortModal.categoryName"),
            dataIndex: "nameEn",
            key: "nameEn",
            className: 'drag-visible',
            width: 800,
            render(text: string, record: ServiceCategory) {
                return <div className='sort-modal-icon'>
                    {record.iconUri ? serviceCategoryIconList[record.iconUri as keyof typeof serviceCategoryIconList] : <img src={GameImg} alt="" />}
                    {i18n.resolvedLanguage === "ar" ? record.nameAr : text}
                </div>
            }
        },
        {
            title: t("serviceCategories.sortModal.actions"),
            width: sortModalActionColumnWidth,
            render: (_: unknown, _row: ServiceCategory, index: number) => {
                return (
                    <div className='action-group'>
                        <div className={index === 0 ? 'sort-top-disabled' : 'sort-icon'} onClick={() => sortUp(index)}>
                            <SortTop />
                        </div>
                        <div className={index === listData.length - 1 ? 'sort-down-disabled' : 'sort-icon'} onClick={() => sortDown(index)}>
                            <SortDown />
                        </div>
                    </div>
                )
            }
        }
    ], [i18n.language, listData.length, sortDown, sortModalActionColumnWidth, sortUp, t]);

    const saveHanld = useCallback(async () => {
        if (saveLoading) {
            return;
        }

        const data = normalizeListData(listData).map((item) => ({
            id: item.id,
            displayOrder: Number(item.displayOrder) || 0,
        }));

        setSaveLoading(true);
        try {
            await categoriesUpdateSort(data);
            updateData();
            CustomMessage.success(t("serviceCategories.messages.sortSuccess"));
            close();
        } catch (error) {
            console.error("Failed to update service category sort order:", error);
            CustomMessage.error(t("common.operationFailed"));
        } finally {
            setSaveLoading(false);
        }
    }, [close, listData, saveLoading, t, updateData]);

    const onSortEnd = useCallback(({ oldIndex, newIndex }: SortEnd) => {
        if (
            oldIndex === newIndex ||
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex >= listData.length ||
            newIndex >= listData.length
        ) {
            return;
        }

        const nextData = arrayMoveImmutable(listData, oldIndex, newIndex).filter(
            (item): item is ServiceCategory => Boolean(item?.id)
        );

        setListData(resetDisplayOrder(nextData));
    }, [listData, resetDisplayOrder]);

    const DraggableContainer = (props: SortableContainerProps) => (
        <SortableBody
            useDragHandle
            disableAutoscroll
            helperClass="sortable-helper"
            onSortEnd={onSortEnd}
            {...props}
        />
    );

    const DraggableBodyRow: React.FC<DraggableBodyRowProps> = ({ ...restProps }) => {
        const rowKey = restProps['data-row-key'];
        const index = listData.findIndex((item) => item.id === rowKey);

        if (index < 0) {
            return <tr {...restProps} />;
        }

        return <SortableItem index={index} {...restProps} />;
    };

    return (
        <Modal
            centered
            width={800}
            wrapClassName="service-modal"
            title={t("serviceCategories.sortModal.title")}
            visible={show}
            onCancel={handleCancel}
            footer={
                <div>
                    <CustomButton
                        text={t("common.cancel")}
                        variant="outline"
                        customClassName='footer-btn'
                        onClick={handleCancel}
                    />
                    <CustomButton
                        text={t("common.save")}
                        variant="primary"
                        customClassName='footer-btn'
                        customStyle={{ marginLeft: '16px' }}
                        loading={saveLoading}
                        onClick={saveHanld}
                    />
                </div>
            }
        >
            <Table
                components={{
                    body: {
                        wrapper: DraggableContainer,
                        row: DraggableBodyRow,
                    },
                }}
                rowKey="id"
                columns={columns}
                dataSource={listData}
                className="service-table admin-table"
                pagination={false}
            />
        </Modal>
    )
};

export default SortModal;
