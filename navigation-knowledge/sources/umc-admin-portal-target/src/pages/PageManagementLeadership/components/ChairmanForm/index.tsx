import React, { useState, useEffect, useRef, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { ChairmanParam } from "@/services/cms";
import DocumentViewer from "@/components/common/DocumentViewer";
import FileUpload from "@/components/common/FileUpload";
import { fileUpload } from "@/services/media";
import Doubt from "@/assets/images/doubt.svg";

interface ChairmanFormProps {
    chairmanParam: ChairmanParam;
    chairmanInputChange: (value: string, key: string, lang: 'en' | 'ar') => void;
    changeChairman: (value: ChairmanParam) => void;
};

const ChairmanForm = memo<ChairmanFormProps>(({
    chairmanParam,
    changeChairman,
    chairmanInputChange
}) => {
    const { t } = useTranslation();
    const [chairmanForm] = Form.useForm();
    const chairmanDeleteImage = () => {
        changeChairman({...chairmanParam, image: "" } as ChairmanParam);
    };
    const chairmanFileChange = (value: any) => {
        let image = chairmanParam?.image || '';
        image = value[0].url;
        changeChairman({...chairmanParam, image });
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
                <div className="title">{t("CMS.pageManagementLeadership.modules.chairman")}</div>
            </div>
            <div className="form-list">
                <Form form={chairmanForm}  layout="vertical" className="custom-form">
                    <div className='img-form-item'>
                        <div className='img-label'>
                            <div className='label-name'>{t("CMS.forms.image")}</div>
                            <Tooltip title={t("CMS.forms.chairmanImageHint")}>
                                <img src={Doubt} alt="" />
                            </Tooltip>
                            <span>*</span>
                        </div>
                        {chairmanParam?.image ?
                        <DocumentViewer 
                            hasDelete
                            hasView
                            fileName={chairmanParam?.image}
                            onDelete={chairmanDeleteImage}
                        />:
                        <FileUpload
                            maxSize={5}
                            maxCount={1}
                            customRequest={uploadFile}
                            onChange={(value) => chairmanFileChange(value)}
                            accept={".jpg,.jpeg,.png"}
                        />}
                    </div>
                    {chairmanParam && <>
                    <Form.Item label={t("CMS.forms.positionEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterPositionEnglish")}
                            value={chairmanParam?.position?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => chairmanInputChange(e.target.value, "position", 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.positionArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterPositionArabic")}
                            value={chairmanParam?.position?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => chairmanInputChange(e.target.value, "position", 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.fullNameEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterFullNameEnglish")}
                            value={chairmanParam?.fullName?.en ?? ''}
                            maxLength={200}
                            onChange={(e) => chairmanInputChange(e.target.value, "fullName", 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.fullNameArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterFullNameArabic")}
                            value={chairmanParam?.fullName?.ar ?? ''}
                            dir="rtl"
                            maxLength={200}
                            onChange={(e) => chairmanInputChange(e.target.value, "fullName", 'ar')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.positionDescriptionEnglish")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterPositionDescriptionEnglish")}
                            value={chairmanParam?.positionDescription?.en ?? ''}
                            onChange={(e) => chairmanInputChange(e.target.value, "positionDescription", 'en')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.positionDescriptionArabic")} required>
                        <Input.TextArea
                            className="custom-textarea"
                            placeholder={t("CMS.forms.enterPositionDescriptionArabic")}
                            value={chairmanParam?.positionDescription?.ar ?? ''}
                            dir="rtl"
                            onChange={(e) => chairmanInputChange(e.target.value, "positionDescription", 'ar')}
                            showCount
                            maxLength={500}
                        />
                    </Form.Item>
                    </>}
                </Form>
            </div>
        </div>
    )
});

export default ChairmanForm;