import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { VisionMissionValues } from "@/services/cms";
import DocumentViewer from "@/components/common/DocumentViewer";
import FileUpload from "@/components/common/FileUpload";
import ArrowRight from "@/assets/images/arrow-right.svg";
import ArrowDown from "@/assets/images/arrow-down.svg";
import Doubt from "@/assets/images/doubt.svg";
import DragHandler from '@/assets/icons/DragHandler';
import { fileUpload } from "@/services/media";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
interface AboutFormProps {
    visionParam: VisionMissionValues;
    visionInputChange: (value: string, key: string, secKey: string, lang: 'en' | 'ar', index?:number) => void;
    changeVisionParam: (value: VisionMissionValues) => void;
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

const VisionForm = memo<AboutFormProps>(({
    visionParam,
    changeVisionParam,
    visionInputChange
}) => {
    const { t } = useTranslation();
    const [visonForm] = Form.useForm();
    const highlightsExpand = (index: number) => {
        const list = [...visionParam.values];
        list[index].isOpen = !list[index].isOpen;
        changeVisionParam({...visionParam, values: list });
    };
    const visionDeleteImage = () => {
        changeVisionParam({...visionParam, image: '' });
    };
    const visionFileChange = (value: any) => {
        const image = value[0].url;
        changeVisionParam({...visionParam, image });
    };
    const moverHighlight = (dragIndex: number, hoverIndex: number) => {
        const newList = [...visionParam.values];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changeVisionParam({...visionParam, values: newList });
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
                <div className="title">{t("CMS.pageManagementAbout.modules.visionMissionValues")}</div>
            </div>
            <div className="form-list">
                <Form form={visonForm} layout="vertical" className="custom-form">
                    <div className='img-form-item'>
                        <div className='img-label'>
                            <div className='label-name'>{t("CMS.forms.image")}</div>
                            <Tooltip title={t("CMS.forms.visionImageHint")}>
                                <img src={Doubt} alt="" />
                            </Tooltip>
                            <span>*</span>
                        </div>
                        {visionParam?.image &&
                        <DocumentViewer
                            fileName={visionParam.image}
                            hasDelete
                            onDelete={visionDeleteImage}
                            hasView
                        />}
                        {!visionParam?.image &&<FileUpload
                            maxSize={5}
                            maxCount={1}
                            customRequest={uploadFile}
                            onChange={(val) => visionFileChange(val)}
                            accept={".jpg,.jpeg,.png"}
                        />}
                    </div>
                    <div className="primary-title">{t("CMS.forms.vision")}</div>
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={visionParam.vision?.title?.en ?? ''}
                            maxLength={50}
                            onChange={(e) => visionInputChange(e.target.value, 'vision', 'title', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={visionParam.vision?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={50}
                            onChange={(e) => visionInputChange(e.target.value, 'vision', 'title', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                            value={visionParam.vision?.description?.en ?? ''}
                            onChange={(e) => visionInputChange(e.target.value, 'vision', 'description', 'en')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                            value={visionParam.vision?.description?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => visionInputChange(e.target.value, 'vision', 'description', 'ar')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    <div className="primary-title">{t("CMS.forms.mission")}</div>
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={visionParam.mission?.title?.en ?? ''}
                            maxLength={50}
                            onChange={(e) => visionInputChange(e.target.value, 'mission', 'title', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={visionParam.mission?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={50}
                            onChange={(e) => visionInputChange(e.target.value, 'mission', 'title', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea hight-textarea"
                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                            value={visionParam.mission?.description?.en ?? ''}
                            onChange={(e) => visionInputChange(e.target.value, 'mission', 'description', 'en')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea hight-textarea"
                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                            value={visionParam.mission?.description?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => visionInputChange(e.target.value, 'mission', 'description', 'ar')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    <div className="primary-title">{t("CMS.forms.values")}</div>
                    <Form.Item label={t("CMS.forms.values")} required>
                        <DndProvider backend={HTML5Backend}>
                        <div className="highlights-list">
                            {visionParam.values.map((item, index) => (<DraggableHighlightItem
                                index={index}
                                key={index}
                                disabled={item.isOpen}
                                moveHanld={moverHighlight}
                            >
                                <div className="collapse-label" onClick={() => highlightsExpand(index)}>
                                    <DragHandler />
                                    <img src={item.isOpen ? ArrowDown: ArrowRight} alt="" />
                                    <div className="label-name">{item.title?.en || item.title?.ar}</div>
                                </div>
                                {item.isOpen && <div className="collapse-content">
                                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleEnglish")}
                                            value={item.title?.en ?? ''}
                                            maxLength={50}
                                            onChange={(e) => visionInputChange(e.target.value, 'values', 'title', 'en', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleArabic")}
                                            value={item.title?.ar ?? ''}
                                            dir="rtl"
                                            maxLength={50}
                                            onChange={(e) => visionInputChange(e.target.value, 'values', 'title', 'ar', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                                        <Input.TextArea
                                            className="custom-textarea"
                                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                                            value={item.description?.en ?? ''}
                                            onChange={(e) => visionInputChange(e.target.value, 'values', 'description', 'en', index)}
                                            showCount
                                            maxLength={200}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                                        <Input.TextArea
                                            className="custom-textarea"
                                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                                            value={item.description?.ar ?? ''}
                                            dir="rtl"
                                            onChange={(e) => visionInputChange(e.target.value, 'values', 'description', 'ar', index)}
                                            showCount
                                            maxLength={200}
                                        />
                                    </Form.Item>
                                </div>}
                            </DraggableHighlightItem>))}
                        </div>
                        </DndProvider>
                    </Form.Item>
                </Form>
            </div>
        </div>
    )
});

export default VisionForm;