import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AboutParam } from "@/services/cms";
import { urlRegex } from "@/utils/validation";
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
    aboutParam: AboutParam;
    aboutInputChange: (value: string, key: string, lang: 'en' | 'ar' | null, index?:number) => void;
    changeAboutParam: (value: AboutParam) => void;
};

const DraggableHighlightItem = memo<{
    item: any;
    index: number;
    moveHanld: (dragIndex: number, hoverIndex: number) => void;
    children: React.ReactNode;
    disabled?: boolean;
}>(({ item, index, moveHanld, children, disabled = false }) => {
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

const AboutForm = memo<AboutFormProps>(({
    aboutParam,
    aboutInputChange,
    changeAboutParam
}) => {
    const { t } = useTranslation();
    const [aboutForm] = Form.useForm();
    const highlightsExpand = (index: number) => {
        const list = [...aboutParam.highlights];
        list[index].isOpen = !list[index].isOpen;
        changeAboutParam({...aboutParam, highlights: list });
    };
    const aboutDeleteImage = (index: number) => {
        const images = aboutParam?.images || [];
        images[index] = "";
        changeAboutParam({...aboutParam, images: images });
    };
    const aboutFileChange = (value: any, index: number) => {
        const images = aboutParam?.images || [];
        images[index] = value[0].url;
        changeAboutParam({...aboutParam, images: images });
    };
    const moverHighlight = (dragIndex: number, hoverIndex: number) => {
        const newList = [...aboutParam.highlights];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changeAboutParam({...aboutParam, highlights: newList });
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
                <div className="title">{t("CMS.pageManagementHome.modules.aboutUs")}</div>
            </div>
            <div className="form-list">
                <Form form={aboutForm} layout="vertical" className="custom-form">
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={aboutParam?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={aboutParam?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.subTitleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterSubTitleEnglish")}
                            value={aboutParam?.subTitle?.en ?? ''}
                            maxLength={200}
                            onChange={(e) => aboutInputChange(e.target.value, 'subTitle', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.subTitleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterSubTitleArabic")}
                            value={aboutParam?.subTitle?.ar ?? ''}
                            dir="rtl"
                            maxLength={200}
                            onChange={(e) => aboutInputChange(e.target.value, 'subTitle', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                            value={aboutParam?.description?.en ?? ''}
                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'en')}
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                            value={aboutParam?.description?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'ar')}
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>
                    <div className="primary-title">{t("CMS.forms.button")}</div>
                    <Form.Item label={t("CMS.forms.labelEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterButtonLabelEnglish")}
                            value={aboutParam?.button.label?.en ?? ''}
                            maxLength={50}
                            onChange={(e) => aboutInputChange(e.target.value, 'buttonLabel', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.labelArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterButtonLabelArabic")}
                            value={aboutParam?.button.label?.ar ?? ''}
                            dir="rtl"
                            maxLength={50}
                            onChange={(e) => aboutInputChange(e.target.value, 'buttonLabel', 'ar')}
                        />
                    </Form.Item>
                    <Form.Item
                        name="buttonLink"
                        label={t("CMS.forms.link")}
                        required
                        rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                    >
                        <Input
                            placeholder={t("CMS.forms.enterUrl")}
                            maxLength={500}
                            onChange={(e) => aboutInputChange(e.target.value, 'buttonLink', null)}
                            defaultValue={aboutParam?.button.link}
                        />
                    </Form.Item>
                    <div className="dashed-line"></div>
                    <Form.Item label={t("CMS.forms.highlights")} required>
                        <DndProvider backend={HTML5Backend}>
                        <div className="highlights-list">
                            {aboutParam?.highlights.map((item, index) =>
                            <DraggableHighlightItem
                                key={index}
                                item={item}
                                index={index}
                                moveHanld={moverHighlight}
                                disabled={item.isOpen}
                            >
                                <div className="collapse-label" onClick={() => highlightsExpand(index)}>
                                    <DragHandler />
                                    <img src={item.isOpen? ArrowDown: ArrowRight} alt="" />
                                    <div className="label-name">{item.title?.en || item.title?.ar}</div>
                                </div>
                                {item.isOpen && <div className="collapse-content">
                                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleEnglish")}
                                            value={item.title?.en ?? ''}
                                            maxLength={50}
                                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'en', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleArabic")}
                                            value={item.title?.ar ?? ''}
                                            dir="rtl"
                                            maxLength={50}
                                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'ar', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                                        <Input.TextArea
                                            className="custom-textarea"
                                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                                            value={item.description?.en ?? ''}
                                            showCount
                                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'en', index)}
                                            maxLength={200}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                                        <Input.TextArea
                                            className="custom-textarea"
                                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                                            value={item.description?.ar ?? ''}
                                            dir="rtl"
                                            showCount
                                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'ar', index)}
                                            maxLength={200}
                                        />
                                    </Form.Item>
                                </div>}
                            </DraggableHighlightItem> )}
                        </div>
                        </DndProvider>
                    </Form.Item>
                    <div className="primary-title">{t("CMS.forms.images")}</div>
                    {aboutParam?.images.map((item, index) =>
                        <div className='img-form-item'>
                            <div className='img-label'>
                                <div className='label-name'>{t("CMS.forms.image")} {index + 1}</div>
                                <Tooltip title={t("CMS.forms.recommendedImageSizeHover")}>
                                    <img src={Doubt} alt="" />
                                </Tooltip>
                                <span>*</span>
                            </div>
                            {item ? <DocumentViewer
                                hasDelete
                                needConcat={false}
                                fileName={item}
                                onDelete={() => aboutDeleteImage(index)}
                            />:
                            <FileUpload
                                onChange={(value) => {aboutFileChange(value, index)}}
                                maxSize={5}
                                maxCount={1}
                                customRequest={uploadFile}
                                accept={".jpg,.jpeg,.png"}
                            />
                            }
                        </div>
                    )}
                </Form>
            </div>
        </div>
    )
});

export default AboutForm;
