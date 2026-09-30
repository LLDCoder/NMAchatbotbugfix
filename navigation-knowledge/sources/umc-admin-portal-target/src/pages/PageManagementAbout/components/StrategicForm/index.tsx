import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { StrategicObjectives } from "@/services/cms";
import DocumentViewer from "@/components/common/DocumentViewer";
import FileUpload from "@/components/common/FileUpload";
import ArrowRight from "@/assets/images/arrow-right.svg";
import ArrowDown from "@/assets/images/arrow-down.svg";
import Doubt from "@/assets/images/doubt.svg";

import DragHandler from '@/assets/icons/DragHandler';
import { fileUpload } from "@/services/media";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface StrategicParamProps {
    strategicParam: StrategicObjectives;
    strategicInputChange: (value: string, key: string, lang: 'en' | 'ar', index?:number) => void;
    changeStrategic: (value: StrategicObjectives) => void;
};

const DraggableHighlightItem = memo<{
    index: number;
    moveHanld: (dragIndex: number, hoverIndex: number) => void;
    children: React.ReactNode;
    disabled?: boolean;
}>(({ index, moveHanld, children, disabled = false }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    const [{ isDragging }, drag] = useDrag({
        type: 'highlight',
        item: () => ({ index }),
        canDrag: !disabled,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'highlight',
        hover(dragItem: { index: number }, monitor) {
            if (!ref.current) {
                return;
            }
            const dragIndex = dragItem.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) {
                return;
            }

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return;
            }
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return;
            }

            moveHanld(dragIndex, hoverIndex);
            dragItem.index = hoverIndex;
        },
    });

    drag(drop(ref));

    return (
        <div ref={ref} className={`collapse-item ${isDragging ? 'dragging' : ''}`}>
            {children}
        </div>
    );
});

const StrategicForm = memo<StrategicParamProps>(({
    strategicParam,
    strategicInputChange,
    changeStrategic
}) => {
    const { t } = useTranslation();
    const [strategicForm] = Form.useForm();
    const [openList, setOpenList] = useState<boolean[]>(Array(3).fill(false));
    const highlightsExpand = (index: number) => {
        setOpenList(prev => {
            const newList = [...prev];
            newList[index] = !newList[index];
            return newList;
        }
        )
    };
    const deleteImage = (index: number) => {
        const images = strategicParam?.images || [];
        images[index] = "";
        changeStrategic({...strategicParam, images: images });
    };
    const fileChange = (value: any, index: number) => {
        const images = strategicParam?.images || [];
        images[index] = value[0].url;
        changeStrategic({...strategicParam, images: images });
    };
    const moverHighlight = (dragIndex: number, hoverIndex: number) => {
        const newList = [...strategicParam.images];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changeStrategic({...strategicParam, images: newList });
    };
    // Built-in upload method
    const uploadFile = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append("files", file);
        try {
            const res = await fileUpload(formData);
            if (res.data && res.data.length > 0) {
                onSuccess(res.data[0]);
            }
        } catch (error) {
            if (onError) {
                onError(error);
            }
        }
    };
    return (
        <div className="about-form">
            <div className="form-head">
                <div className="title">{t("CMS.pageManagementAbout.modules.strategicObjectives")}</div>
            </div>
            <div className="form-list">
                <Form form={strategicForm} layout="vertical" className="custom-form">
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={strategicParam?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => strategicInputChange(e.target.value, 'title', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={strategicParam?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => strategicInputChange(e.target.value, 'title', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                            value={strategicParam?.description?.en ?? ''}
                            onChange={(e) => strategicInputChange(e.target.value, 'description', 'en')}
                            showCount
                            maxLength={100}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                            value={strategicParam?.description?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => strategicInputChange(e.target.value, 'description', 'ar')}
                            showCount
                            maxLength={100}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.images")} required>
                        <DndProvider backend={HTML5Backend}>
                        <div className="highlights-list">
                            {strategicParam?.images.map((item, index) => (<DraggableHighlightItem
                                index={index}
                                key={index}
                                disabled={openList[index]}
                                moveHanld={moverHighlight}
                            >
                                <div className="collapse-label" onClick={() => highlightsExpand(index)}>
                                    <DragHandler />
                                    <img src={openList[index] ? ArrowDown: ArrowRight} alt="" />
                                    <div className="label-name">{t("CMS.forms.image")} {index + 1}</div>
                                </div>
                                {openList[index] && <div className="collapse-content">
                                    <div className='img-form-item'>
                                        <div className='img-label'>
                                            <div className='label-name'>{t("CMS.forms.image")}</div>
                                            <Tooltip title={t("CMS.forms.recommendedImageSizeHover")}>
                                                <img src={Doubt} alt="" />
                                            </Tooltip>
                                            <span>*</span>
                                        </div>
                                        {item ? 
                                        <DocumentViewer
                                            fileName={item}
                                            onDelete={() => deleteImage(index)}
                                            hasDelete
                                            hasView
                                        />:
                                        <FileUpload
                                            maxSize={5}
                                            maxCount={1}
                                            customRequest={uploadFile}
                                            onChange={(value) => fileChange(value, index)}
                                            accept={".jpg,.jpeg,.png"}
                                        />}
                                    </div>
                                </div>}
                            </DraggableHighlightItem>))}
                        </div>
                        </DndProvider>
                    </Form.Item>
                    <div className="primary-title">{t("CMS.forms.strategies")}</div>
                    {strategicParam?.strategies.map((item, index) => (
                    <React.Fragment key={index}>
                        <Form.Item label={`${t("CMS.forms.strategy")} ${index + 1} ${t("CMS.forms.inEnglishSuffix")}`} required>
                            <Input.TextArea
                                className="custom-textarea"
                                placeholder={t("CMS.forms.enterStrategyEnglish")}
                                value={item?.en ?? ''}
                                onChange={(e) => strategicInputChange(e.target.value, 'strategies', 'en', index)}
                                showCount
                                maxLength={300}
                            />
                        </Form.Item>
                        <Form.Item label={`${t("CMS.forms.strategy")} ${index + 1} ${t("CMS.forms.inArabicSuffix")}`} required>
                            <Input.TextArea
                                className="custom-textarea"
                                placeholder={t("CMS.forms.enterStrategyArabic")}
                                value={item?.ar ?? ''}
                                dir="rtl"
                                onChange={(e) => strategicInputChange(e.target.value, 'strategies', 'ar', index)}
                                showCount
                                maxLength={300}
                            />
                        </Form.Item>
                    </React.Fragment>))}
                </Form>
            </div>
        </div>
    )
});

export default StrategicForm;