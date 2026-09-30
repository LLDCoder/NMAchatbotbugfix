import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { DirectorParam } from "@/services/cms";
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
import "./index.less";

interface DirectorsFormProps {
    directorParam: DirectorParam;
    directorInputChange: (value: string, key: string, lang: 'en' | 'ar', index?: number) => void;
    addMember: () => void;
    deleteMember: (index: number) => void;
    changeDirectorParam: (value: DirectorParam) => void;
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

const DirectorsForm = memo<DirectorsFormProps>(({
    directorParam,
    directorInputChange,
    addMember,
    deleteMember,
    changeDirectorParam
}) => {
    const { t } = useTranslation();
    const [directorsForm] = Form.useForm();
    const changePartnerExpend = (index: number) => {
        const list = [...directorParam?.members || []];
        list[index].isOpen = !list[index].isOpen;
        changeDirectorParam({...directorParam, members: list });
    };
    const partnerFileChange = (value: any, index: number) => {
        const list = [...directorParam?.members || []];
        list[index].image = value[0].url;
        changeDirectorParam({...directorParam, members: list });
    };
    const partnerDeleteImage = (index: number) => {
        const list = [...directorParam?.members || []];
        list[index].image = "";
        changeDirectorParam({...directorParam, members: list });
    };
    const moverPartner = (dragIndex: number, hoverIndex: number) => {
        const newList = [...directorParam.members];
        const dragItem = newList[dragIndex];
        newList.splice(dragIndex, 1);
        newList.splice(hoverIndex, 0, dragItem);
        changeDirectorParam({...directorParam, members: newList });
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
                <div className="title">{t("CMS.pageManagementLeadership.modules.boardOfDirectors")}</div>
            </div>
            <div className="form-list">
                <Form form={directorsForm} layout="vertical" className="custom-form">
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={directorParam?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => directorInputChange(e.target.value, 'title', 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={directorParam?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => directorInputChange(e.target.value, 'title', 'ar')}
                        />
                    </Form.Item>
                    <div className="partner-label">
                        <div className="label-text">{t("CMS.forms.boardMembers")}<span>*</span></div>
                        {/* PRD: up to 8 board members */}
                        <img className={directorParam?.members?.length >= 8 ? "disable" : ""} src={PlusCircle} alt="" onClick={addMember} />
                    </div>
                    <DndProvider backend={HTML5Backend}>
                    <div className="partner-list">
                        {directorParam?.members.map((item, index) =>
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
                                    {item.image ? (
                                        <AuthenticatedDocumentImage
                                            className="label-img"
                                            src={item.image}
                                            alt={item.fullName?.en ?? ""}
                                        />
                                    ) : (
                                        <div className="label-img" />
                                    )}
                                    <div className="label-name">
                                        {t("CMS.forms.boardMember", {
                                            number: index + 1,
                                        })}
                                    </div>
                                    {/* PRD: delete disabled when only one member remains */}
                                    {directorParam?.members.length > 1 && <div className="delete-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMember(index);
                                }}><Delete /></div>}
                            </div>
                            {item.isOpen && <div className="collapse-content">
                                <div className='img-form-item'>
                                    <div className='img-label'>
                                        <div className='label-name'>{t("CMS.forms.image")}</div>
                                        <Tooltip title={t("CMS.forms.directorImageHint")}>
                                            <img src={Doubt} alt="" />
                                        </Tooltip>
                                        <span>*</span>
                                    </div>
                                    {item.image ? <DocumentViewer
                                        hasDelete
                                        needConcat={false}
                                        fileName={item.image}
                                        onDelete={() => partnerDeleteImage(index)}
                                    />:
                                    <FileUpload
                                        onChange={(value) => {partnerFileChange(value, index)}}
                                        maxSize={5}
                                        maxCount={1}
                                        customRequest={uploadFile}
                                        accept={".jpg,.jpeg,.png"}
                                    />}
                                </div>
                                <Form.Item label={t("CMS.forms.fullNameEnglish")} required>
                                    <Input
                                        placeholder={t("CMS.forms.enterBoardMemberFullNameEnglish")}
                                        value={item.fullName?.en ?? ''}
                                        maxLength={200}
                                        onChange={(e) => directorInputChange(e.target.value, 'fullName', 'en', index)}
                                    />
                                </Form.Item>
                                <Form.Item label={t("CMS.forms.fullNameArabic")} required>
                                    <Input
                                        placeholder={t("CMS.forms.enterBoardMemberFullNameArabic")}
                                        value={item.fullName?.ar ?? ''}
                                        dir="rtl"
                                        maxLength={200}
                                        onChange={(e) => directorInputChange(e.target.value, 'fullName', 'ar', index)}
                                    />
                                </Form.Item>
                                <Form.Item label={t("CMS.forms.positionDescriptionEnglish")} required>
                                    <Input.TextArea
                                        className="custom-textarea"
                                        placeholder={t("CMS.forms.enterBoardMemberPositionDescriptionEnglish")}
                                        value={item.positionDescription?.en ?? ''}
                                        onChange={(e) => directorInputChange(e.target.value, "positionDescription", 'en', index)}
                                        showCount
                                        maxLength={200}
                                    />
                                </Form.Item>
                                <Form.Item label={t("CMS.forms.positionDescriptionArabic")} required>
                                    <Input.TextArea
                                        className="custom-textarea"
                                        placeholder={t("CMS.forms.enterBoardMemberPositionDescriptionArabic")}
                                        value={item.positionDescription?.ar ?? ''}
                                        dir="rtl"
                                        onChange={(e) => directorInputChange(e.target.value, "positionDescription", 'ar', index)}
                                        showCount
                                        maxLength={200}
                                    />
                                </Form.Item>
                            </div>}
                        </DraggablePartnerItem>)
                        }
                    </div>
                    </DndProvider>
                </Form>
            </div>
        </div>
    )
});

export default DirectorsForm;
