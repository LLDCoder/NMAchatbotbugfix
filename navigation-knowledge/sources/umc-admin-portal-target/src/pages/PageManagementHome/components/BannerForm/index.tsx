import React, { useState, useEffect, useRef, memo, useImperativeHandle, forwardRef} from 'react';
import type { BannerItem } from "@/services/cms";
import FileUpload from "@/components/common/FileUpload";
import DocumentViewer from "@/components/common/DocumentViewer";
import { fileUpload } from "@/services/media";
import { DndProvider, useDrag, useDrop, DragPreviewImage  } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Form, Input, Switch, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import PlusCircle from "@/assets/images/PlusCircle.svg";
import ArrowRight from "@/assets/images/arrow-right.svg";
import ArrowDown from "@/assets/images/arrow-down.svg";
import DragHandler from '@/assets/icons/DragHandler';
import BannerItemImage from "@/assets/images/banner-item.png";
import Doubt from "@/assets/images/doubt.svg";
import Delete from "@/assets/icons/Delete2";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { urlRegex } from "@/utils/validation";
import "./index.less";

interface BannerProps {
    bannerList: BannerItem[];
    bannerInputChange: (value: string, index: number, key: string, lang: 'en' | 'ar' | null, secKey?:string) => void;
    bannerSwitchChange: (value: boolean, index: number, key: string) => void;
    bannerFileChange: (value: any, index: number) => void;
    bannerMobileFileChange: (value: any, index: number) => void;
    changeBannerList: (value: BannerItem[]) => void;
    addBanner: () => void;
    deleteBanner: (index: number) => void;
    bannerDeleteCover: (index: number) => void;
    bannerDeleteMobileCover: (index: number) => void;
};
export interface BannerFormRef {
    resetForm: () => void;
}
const DraggableBannerItem = memo<{
    item: BannerItem;
    index: number;
    moveBanner: (dragIndex: number, hoverIndex: number) => void;
    children: React.ReactNode;
    disabled?: boolean;
}>(({ item, index, moveBanner, children, disabled = false }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [{ isDragging }, drag] = useDrag({
        type: 'banner',
        item: () => ({ index }),
        canDrag: !disabled,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'banner',
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

            moveBanner(dragIndex, hoverIndex);
            dragItem.index = hoverIndex;
        },
    });

    drag(drop(ref));
    return (
        <div 
            ref={ref} 
            className={`banner-item ${isDragging ? 'dragging' : ''}`}
        >
            {children}
        </div>
    );
});
const BannerForm = React.memo(forwardRef<BannerFormRef, BannerProps>(({
    bannerList,
    bannerInputChange,
    bannerSwitchChange,
    bannerFileChange,
    bannerMobileFileChange,
    changeBannerList,
    addBanner,
    deleteBanner,
    bannerDeleteCover,
    bannerDeleteMobileCover
}, ref) => {
    const { t } = useTranslation();
    const [bannerForm] = Form.useForm();
    const changeBannerExpend = (index: number) => {
        const list = [...bannerList];
        list[index].isOpen = !list[index].isOpen;
        changeBannerList(list);
    };
    const moveBanner = (dragIndex: number, hoverIndex: number) => {
        const newBannerList = [...bannerList];
        const dragItem = newBannerList[dragIndex];
        newBannerList.splice(dragIndex, 1);
        newBannerList.splice(hoverIndex, 0, dragItem);
        changeBannerList(newBannerList);
    };
    const resetForm = () => {
        bannerForm.resetFields();
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
     useImperativeHandle(ref, () => ({
        resetForm
    }));
    return (
        <div className="banner-form">
            <div className="form-head">
                <div className="title">{t("CMS.pageManagementHome.modules.heroBanner")}</div>
                <img className={bannerList.length >= 6 ? "disabled" : ""} src={PlusCircle} alt="" onClick={addBanner} />
            </div>
            <Form form={bannerForm} layout="vertical" className="custom-form">
                <DndProvider backend={HTML5Backend}>
                <div className="banner-list">
                    {bannerList.map((item, index) => 
                    <DraggableBannerItem
                        key={item.id}
                        item={item}
                        index={index}
                        disabled={item.isOpen}
                        moveBanner={moveBanner}
                    >
                                        
                        <div className="collapse" onClick={() => changeBannerExpend(index)}>
                            <DragHandler />
                            <img src={item.isOpen ? ArrowDown : ArrowRight} alt="" />
                            {item.cover.url ? 
                            <AuthenticatedDocumentImage className='label-img' src={item.cover.url} alt="" />
                            : <div className="label-img"></div>}
                            <div className="title-name">{item.title?.en || item.title?.ar}</div>
                            {bannerList.length > 1 && <div className="delete-btn" onClick={(e) => {
                                e.stopPropagation();
                                deleteBanner(index)
                            }}><Delete /></div>}
                        </div>
                        {item.isOpen && <div className="form-list item-form">
                            <div className='img-form-item'>
                                <div className='img-label'>
                                    <div className='label-name'>{t("CMS.forms.cover")}</div>
                                    <Tooltip title={t("CMS.forms.coverDesktopHintUpload")}>
                                        <img src={Doubt} alt="" />
                                    </Tooltip>
                                    <span>*</span>
                                </div>
                                {item.cover.url && <DocumentViewer
                                    hasDelete
                                    needConcat={false}
                                    fileName={item.cover.url}
                                    onDelete={() => bannerDeleteCover(index)}
                                />}
                                {!item.cover.url && <FileUpload
                                    onChange={(value) => {bannerFileChange(value, index)}}
                                    maxSize={10}
                                    maxCount={1}
                                    customRequest={uploadFile}
                                    accept={".jpg,.jpeg,.png,.mp4,.gif"}
                                    />
                                }
                            </div>
                            <div className='img-form-item'>
                                <div className='img-label'>
                                    <div className='label-name'>{t("CMS.forms.coverMobile")}</div>
                                    <Tooltip title={t("CMS.forms.coverMobileHintUpload")}>
                                        <img src={Doubt} alt="" />
                                    </Tooltip>
                                    <span>*</span>
                                </div>
                                {item.mobileCover?.url && <DocumentViewer
                                    hasDelete
                                    needConcat={false}
                                    fileName={item.mobileCover.url}
                                    onDelete={() => bannerDeleteMobileCover(index)}
                                />}
                                {!item.mobileCover?.url && <FileUpload
                                    onChange={(value) => {bannerMobileFileChange(value, index)}}
                                    maxSize={10}
                                    maxCount={1}
                                    customRequest={uploadFile}
                                    accept={".jpg,.jpeg,.png,.mp4,.gif"}
                                    />
                                }
                            </div>
                            <Form.Item label={t("CMS.forms.titleEnglish")} required>
                                <Input
                                    placeholder={t("CMS.forms.enterBannerTitleEnglish")}
                                    value={item.title?.en ?? ''}
                                    maxLength={200}
                                    onChange={(e) => bannerInputChange(e.target.value, index, 'title', 'en')}
                                />
                            </Form.Item>
                            <Form.Item label={t("CMS.forms.titleArabic")} required>
                                <Input
                                    placeholder={t("CMS.forms.enterBannerTitleArabic")}
                                    value={item.title?.ar ?? ''}
                                    dir="rtl"
                                    maxLength={200}
                                    onChange={(e) => bannerInputChange(e.target.value, index, 'title', 'ar')}
                                />
                            </Form.Item>
                            <Form.Item label={t("CMS.forms.descriptionEnglish")} required>
                                <Input.TextArea
                                    className="custom-textarea"
                                    placeholder={t("CMS.forms.enterBannerDescriptionEnglish")}
                                    value={item.description?.en ?? ''}
                                    onChange={(e) => bannerInputChange(e.target.value, index, 'description', 'en')}
                                    showCount
                                    maxLength={200}
                                />
                            </Form.Item>
                            <Form.Item label={t("CMS.forms.descriptionArabic")} required>
                                <Input.TextArea
                                    className="custom-textarea"
                                    placeholder={t("CMS.forms.enterBannerDescriptionArabic")}
                                    value={item.description?.ar ?? ''}
                                    dir="rtl"
                                    onChange={(e) => bannerInputChange(e.target.value, index, 'description', 'ar')}
                                    showCount
                                    maxLength={200}
                                />
                            </Form.Item>
                            <div className="primary-title">
                                {t("CMS.forms.primaryButton")}
                                <Switch 
                                    defaultChecked={item.primaryButton.enabled}
                                    onChange={(value) => bannerSwitchChange(value, index, 'primaryButton')}
                                />
                            </div>
                            {item.primaryButton.enabled &&
                                <>
                                    <Form.Item label={t("CMS.forms.labelEnglish")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterButtonLabelEnglish")}
                                            value={item.primaryButton.label?.en ?? ''}
                                            maxLength={50}
                                            onChange={(e) => bannerInputChange(e.target.value, index, 'primaryButton', 'en', 'label')}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("CMS.forms.labelArabic")} required>
                                        <Input
                                            placeholder={t("CMS.forms.enterButtonLabelArabic")}
                                            value={item.primaryButton.label?.ar ?? ''}
                                            dir="rtl"
                                            maxLength={50}
                                            onChange={(e) => bannerInputChange(e.target.value, index, 'primaryButton', 'ar', 'label')}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name={`primaryLink-${index}`}
                                        label={t("CMS.forms.link")}
                                        required
                                        rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                    >
                                        <Input
                                            placeholder={t("CMS.forms.enterUrl")}
                                            maxLength={500}
                                            defaultValue={item.primaryButton.link}
                                            onChange={(e) => bannerInputChange(e.target.value, index, 'primaryButton', null, 'link')}
                                        />
                                    </Form.Item>
                                </>
                            }
                            <div className="primary-title">
                                {t("CMS.forms.secondaryButton")}
                                <Switch 
                                    defaultChecked={item.secondaryButton.enabled}
                                    onChange={(value) => bannerSwitchChange(value, index, 'secondaryButton')}
                                />
                            </div>
                            {item.secondaryButton.enabled &&
                            <>
                                <Form.Item label={t("CMS.forms.labelEnglish")} required>
                                    <Input
                                        placeholder={t("CMS.forms.enterButtonLabelEnglish")}
                                        value={item.secondaryButton.label?.en ?? ''}
                                        maxLength={50}
                                        onChange={(e) => bannerInputChange(e.target.value, index, 'secondaryButton', 'en', 'label')}
                                    />
                                </Form.Item>
                                <Form.Item label={t("CMS.forms.labelArabic")} required>
                                    <Input
                                        placeholder={t("CMS.forms.enterButtonLabelArabic")}
                                        value={item.secondaryButton.label?.ar ?? ''}
                                        dir="rtl"
                                        maxLength={50}
                                        onChange={(e) => bannerInputChange(e.target.value, index, 'secondaryButton', 'ar', 'label')}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name={`secondaryLink-${index}`}
                                    label={t("CMS.forms.link")}
                                    required
                                    rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                >
                                    <Input
                                        placeholder={t("CMS.forms.enterUrl")}
                                        maxLength={500}
                                        defaultValue={item.secondaryButton.link}
                                        onChange={(e) => bannerInputChange(e.target.value, index, 'secondaryButton', null, 'link')}
                                    />
                                </Form.Item>
                            </>}
                        </div>}
                    </DraggableBannerItem>)}
                </div>
                </DndProvider>
            </Form>
        </div>
    )
}));

export default BannerForm;
