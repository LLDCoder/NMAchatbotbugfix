import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AboutFormParam } from "@/services/cms";
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
    aboutParam: AboutFormParam;
    aboutInputChange: (value: string, key: string, lang: 'en' | 'ar', index?:number) => void;
    changeAboutParam: (value: AboutFormParam) => void;
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

const AboutForm = memo<AboutFormProps>(({
    aboutParam,
    changeAboutParam,
    aboutInputChange
}) => {
    const { t } = useTranslation();
    const [aboutForm] = Form.useForm();
    const highlightsExpand = (index: number) => {
        const list = [...aboutParam.responsibilities];
        list[index].isOpen = !list[index].isOpen;
        changeAboutParam({...aboutParam, responsibilities: list });
    };
    const aboutDeleteImage = () => {
        changeAboutParam({...aboutParam, image: "" } as AboutFormParam);
    };
    const aboutFileChange = (value: any) => {
        let image = aboutParam?.image || '';
        image = value[0].url;
        changeAboutParam({...aboutParam, image });
        console.log(image);
    };
    const moverHighlight = (dragIndex: number, hoverIndex: number) => {
        const newList = [...aboutParam.responsibilities];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changeAboutParam({...aboutParam, responsibilities: newList });
    };
    useEffect(() => {
        console.log(aboutParam);
    }, [aboutParam]);
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
                <div className="title">{t("CMS.pageManagementAbout.modules.aboutUs")}</div>
            </div>
            <div className="form-list">
                <Form form={aboutForm}  layout="vertical" className="custom-form">
                    <div className='img-form-item'>
                        <div className='img-label'>
                            <div className='label-name'>{t("CMS.forms.image")}</div>
                            <Tooltip title={t("CMS.forms.recommendedImageSizeHover")}>
                                <img src={Doubt} alt="" />
                            </Tooltip>
                            <span>*</span>
                        </div>
                        {aboutParam?.image &&
                        <DocumentViewer 
                            hasDelete
                            hasView
                            onDelete={aboutDeleteImage}
                            fileName={aboutParam.image} 
                        />}
                        {!aboutParam?.image && 
                        <FileUpload
                            maxSize={5}
                            maxCount={1}
                            customRequest={uploadFile}
                            onChange={(value) => aboutFileChange(value)}
                            accept={".jpg,.jpeg,.png"}
                        />}
                    </div>
                    {aboutParam?.title &&
                    <>
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={aboutParam?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => aboutInputChange(e.target.value, "title", 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={aboutParam?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => aboutInputChange(e.target.value, "title", 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea hight-textarea"
                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                            value={aboutParam?.description?.en ?? ''}
                            onChange={(e) => aboutInputChange(e.target.value, "description", 'en')}
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea hight-textarea"
                            placeholder={t("CMS.forms.enterDescriptionArabic")}
                            value={aboutParam?.description?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => aboutInputChange(e.target.value, "description", 'ar')}
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>
                    </>}
                    <div className="dashed-line"></div>
                    <Form.Item label={t("CMS.forms.responsibilities")} required>
                        <DndProvider backend={HTML5Backend}>
                        <div className="highlights-list">
                            {aboutParam?.responsibilities.map((item, index) => (
                            <DraggableHighlightItem
                                key={index}
                                index={index}
                                disabled={item.isOpen}
                                moveHanld={moverHighlight}
                            >
                                <div className="collapse-label" onClick={() => highlightsExpand(index)}>
                                    <DragHandler />
                                    <img src={item.isOpen ?ArrowDown: ArrowRight} alt="" />
                                    <div className="label-name">{t("CMS.forms.responsibilities")} {index + 1}</div>
                                </div>
                                {item.isOpen && <div className="collapse-content">
                                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleEnglish")}
                                            value={item.title?.en ?? ''}
                                            maxLength={100}
                                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'en', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterTitleArabic")}
                                            value={item.title?.ar ?? ''}
                                            dir="rtl"
                                            maxLength={100}
                                            onChange={(e) => aboutInputChange(e.target.value, 'title', 'ar', index)}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                                        <Input.TextArea
                                            className="custom-textarea"
                                            placeholder={t("CMS.forms.enterDescriptionEnglish")}
                                            value={item.description?.en ?? ''}
                                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'en', index)}
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
                                            onChange={(e) => aboutInputChange(e.target.value, 'description', 'ar', index)}
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

export default AboutForm;
