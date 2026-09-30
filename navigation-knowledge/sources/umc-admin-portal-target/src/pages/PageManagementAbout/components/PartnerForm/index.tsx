import React, { useState, useEffect, useRef, memo } from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AboutPartnership } from "@/services/cms";
import DocumentViewer from "@/components/common/DocumentViewer";
import FileUpload from "@/components/common/FileUpload";
import ArrowRight from "@/assets/images/arrow-right.svg";
import ArrowDown from "@/assets/images/arrow-down.svg";
import DragHandler from '@/assets/icons/DragHandler';
import PlusCircle from "@/assets/images/PlusCircle.svg";
import Doubt from "@/assets/images/doubt.svg";

import Delete from "@/assets/icons/Delete2";
import { fileUpload } from "@/services/media";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { urlRegex } from "@/utils/validation";

import "./index.less";

interface PartnerFormProps {
    partnerParam: AboutPartnership;
    partnerInputChange: (value: string, key: string, lang?: 'en' | 'ar', index?: number) => void;
    addPartner: () => void;
    deletePartner: (index: number) => void;
    changePartnerParam: (value: AboutPartnership) => void;
};

const DraggablePartnerItem = memo<{
    item: any;
    index: number;
    moveHanld: (dragIndex: number, hoverIndex: number) => void;
    children: React.ReactNode;
    disabled?: boolean;
}>(({ item, index, moveHanld, children, disabled = false }) => {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isDragging }, drag] = useDrag({
        type: 'partner',
        item: () => ({ index }),
        canDrag: !disabled,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'partner',
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
const PartnerForm = memo<PartnerFormProps>(({
    partnerParam,
    partnerInputChange,
    addPartner,
    deletePartner,
    changePartnerParam
}) => {
    const { t } = useTranslation();
    const [partnershipForm] = Form.useForm();
    const changePartnerExpend = (index: number) => {
        const list = [...partnerParam?.partners || []];
        list[index].isOpen = !list[index].isOpen;
        changePartnerParam({ ...partnerParam, partners: list });
    };
    const partnerFileChange = (value: any, index: number) => {
        const list = [...partnerParam?.partners || []];
        list[index].logo = value[0].url;
        changePartnerParam({ ...partnerParam, partners: list });
    };
    const partnerDeleteImage = (index: number) => {
        const list = [...partnerParam?.partners || []];
        list[index].logo = "";
        changePartnerParam({ ...partnerParam, partners: list });
    };
    const moverPartner = (dragIndex: number, hoverIndex: number) => {
        const newList = [...partnerParam.partners];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changePartnerParam({ ...partnerParam, partners: newList });
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
            console.error("Upload failed:", error);
            if (onError) {
                onError(error);
            }
        }
    };
    return (
        <div className="partnership-form">
            <div className="form-head">
                <div className="title">{t("CMS.pageManagementHome.modules.partnership")}</div>
            </div>
            <div className="form-list">
                <Form form={partnershipForm} layout="vertical" className="custom-form">
                    {/* <Form.Item name="title" label={t("CMS.forms.title")} required>
                        <Input 
                            placeholder={t("CMS.forms.enterNotes")}
                            defaultValue={partnerParam?.title}
                            onChange={(e) => partnerInputChange(e.target.value, 'title')}
                        />
                    </Form.Item> */}

                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={partnerParam?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => partnerInputChange(e.target.value, "title", 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={partnerParam?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => partnerInputChange(e.target.value, "title", 'ar')}
                        />
                    </Form.Item>
                    <div className="partner-label">
                        <div className="label-text">{t("CMS.pageManagementAbout.modules.partners")}<span>*</span></div>
                        <img className={partnerParam?.partners?.length >= 10 ? "disable" : ""} src={PlusCircle} alt="" onClick={addPartner} />
                    </div>
                    <DndProvider backend={HTML5Backend}>
                        <div className="partner-list">
                            {partnerParam?.partners.map((item, index) =>
                                <DraggablePartnerItem
                                    index={index}
                                    key={index}
                                    moveHanld={moverPartner}
                                    item={item}
                                    disabled={item.isOpen}
                                >
                                    <div className="collapse-label" onClick={() => changePartnerExpend(index)}>
                                        <DragHandler />
                                        <img src={item.isOpen ? ArrowDown : ArrowRight} alt="" />
                                        {item.logo
                                            ? <AuthenticatedDocumentImage className='label-img' src={item.logo} alt="" />
                                            : <div className="label-img"></div>}
                                        <div className="label-name">{t("CMS.forms.partnerItem", { number: index + 1 })}</div>
                                        {/* Deletable when list exceeds the 5-item minimum */}
                                        {(partnerParam?.partners?.length ?? 0) > 5 && <div className="delete-btn" onClick={(e) => {
                                            e.stopPropagation();
                                            deletePartner(index);
                                        }}><Delete /></div>}
                                    </div>
                                    {item.isOpen && <div className="collapse-content">
                                        <div className='img-form-item'>
                                            <div className='img-label'>
                                                <div className='label-name'>{t("CMS.forms.logo")}</div>
                                                <Tooltip title={t("CMS.forms.recommendedImageSizeHover")}>
                                                    <img src={Doubt} alt="" />
                                                </Tooltip>
                                                <span>*</span>
                                            </div>
                                            {item.logo ? <DocumentViewer
                                                hasDelete
                                                needConcat={false}
                                                fileName={item.logo}
                                                onDelete={() => partnerDeleteImage(index)}
                                            /> :
                                                <FileUpload
                                                    onChange={(value) => { partnerFileChange(value, index) }}
                                                    maxSize={5}
                                                    maxCount={1}
                                                    customRequest={uploadFile}
                                                    accept={".jpg,.jpeg,.png"}
                                                />}
                                        </div>
                                        <Form.Item
                                            name={'partnerlink' + index}
                                            label={t("CMS.forms.link")}
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input
                                                placeholder={t("CMS.forms.enterUrl")}
                                                maxLength={500}
                                                defaultValue={item.link}
                                                onChange={(e) => partnerInputChange(e.target.value, 'link', undefined, index)}
                                            />
                                        </Form.Item>
                                    </div>}
                                </DraggablePartnerItem>)}
                        </div>
                    </DndProvider>
                </Form>
            </div>
        </div>
    )
});

export default PartnerForm;
