import React, { useState, memo} from 'react';
import { Form, Input, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { ManagementParam } from "@/services/cms";
import DocumentViewer from "@/components/common/DocumentViewer";
import FileUpload from "@/components/common/FileUpload";
import { fileUpload } from "@/services/media";
import Doubt from "@/assets/images/doubt.svg";

import "./index.less";
interface TeamFormProps {
    data: ManagementParam;
    changeManagement: (value: ManagementParam) => void;
    managementInputChange: (value: string, key: string, lang: 'en' | 'ar', index?: number) => void;
};

const TeamForm = memo<TeamFormProps>(({
    data,
    changeManagement,
    managementInputChange
}) => {
    const { t } = useTranslation();
    const [teamForm] = Form.useForm();
    const [activeMember, setActiveMember] = useState<1 | 2>(1);

    const teamFileChange = (value: any, index: number) => {
        if (index === 1) {
            const memberOne = data?.memberOne;
            memberOne.image = value[0].url;
            changeManagement({...data, memberOne });
        } else {
            const memberTwo = data?.memberTwo;
            memberTwo.image = value[0].url;
            changeManagement({...data, memberTwo });
        }
    };
    const teamDeleteImage = (index: number) => {
        if (index === 1) {
            const memberOne = data?.memberOne;
            memberOne.image = "";
            changeManagement({...data, memberOne });
        } else {
            const memberTwo = data?.memberTwo;
            memberTwo.image = "";
            changeManagement({...data, memberTwo });
        }
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
    // Per PRD: Member 1 has a Quote, Member 2 does not.
    const renderMemberFields = (member: any, index: number, withQuote: boolean) => (
        <div className='item-content'>
            <div className='img-form-item'>
                <div className='img-label'>
                    <div className='label-name'>{t("CMS.forms.image")}</div>
                    <Tooltip title={t("CMS.forms.managementImageHint")}>
                        <img src={Doubt} alt="" />
                    </Tooltip>
                    <span>*</span>
                </div>
                {member?.image ?
                <DocumentViewer
                    hasDelete
                    hasView
                    fileName={member.image}
                    onDelete={() => teamDeleteImage(index)}
                />:
                <FileUpload
                    maxSize={5}
                    maxCount={1}
                    customRequest={uploadFile}
                    onChange={(value) => teamFileChange(value, index)}
                    accept={".jpg,.jpeg,.png"}
                />}
            </div>
            <Form.Item label={t("CMS.forms.fullNameEnglish")} required>
                <Input
                    placeholder={t("CMS.forms.enterFullNameEnglish")}
                    value={member?.fullName?.en ?? ''}
                    maxLength={200}
                    onChange={(e) => managementInputChange(e.target.value, "fullName", 'en', index)}
                />
            </Form.Item>
            <Form.Item label={t("CMS.forms.fullNameArabic")} required>
                <Input
                    placeholder={t("CMS.forms.enterFullNameArabic")}
                    value={member?.fullName?.ar ?? ''}
                    dir="rtl"
                    maxLength={200}
                    onChange={(e) => managementInputChange(e.target.value, "fullName", 'ar', index)}
                />
            </Form.Item>
            <Form.Item label={t("CMS.forms.positionDescriptionEnglish")} required>
                <Input.TextArea
                    className="custom-textarea"
                    placeholder={t("CMS.forms.enterPositionDescriptionEnglish")}
                    value={member?.positionDescription?.en ?? ''}
                    onChange={(e) => managementInputChange(e.target.value, "positionDescription", 'en', index)}
                    showCount
                    maxLength={200}
                />
            </Form.Item>
            <Form.Item label={t("CMS.forms.positionDescriptionArabic")} required>
                <Input.TextArea
                    className="custom-textarea"
                    placeholder={t("CMS.forms.enterPositionDescriptionArabic")}
                    value={member?.positionDescription?.ar ?? ''}
                    dir="rtl"
                    onChange={(e) => managementInputChange(e.target.value, "positionDescription", 'ar', index)}
                    showCount
                    maxLength={200}
                />
            </Form.Item>
            {withQuote && <>
                <Form.Item label={t("CMS.forms.quoteEnglish")} required>
                    <Input.TextArea
                        className="custom-textarea hight-textarea"
                        placeholder={t("CMS.forms.enterQuoteEnglish")}
                        value={member?.quote?.en ?? ''}
                        onChange={(e) => managementInputChange(e.target.value, "quote", 'en', index)}
                    />
                </Form.Item>
                <Form.Item label={t("CMS.forms.quoteArabic")} required>
                    <Input.TextArea
                        className="custom-textarea hight-textarea"
                        placeholder={t("CMS.forms.enterQuoteArabic")}
                        value={member?.quote?.ar ?? ''}
                        dir="rtl"
                        onChange={(e) => managementInputChange(e.target.value, "quote", 'ar', index)}
                    />
                </Form.Item>
            </>}
            <Form.Item label={t("CMS.forms.profileEnglish")} required>
                <Input.TextArea
                    className="custom-textarea hight-textarea"
                    placeholder={t("CMS.forms.enterProfileEnglish")}
                    value={member?.profile?.en ?? ''}
                    onChange={(e) => managementInputChange(e.target.value, "profile", 'en', index)}
                />
            </Form.Item>
            <Form.Item label={t("CMS.forms.profileArabic")} required>
                <Input.TextArea
                    className="custom-textarea hight-textarea"
                    placeholder={t("CMS.forms.enterProfileArabic")}
                    value={member?.profile?.ar ?? ''}
                    dir="rtl"
                    onChange={(e) => managementInputChange(e.target.value, "profile", 'ar', index)}
                />
            </Form.Item>
        </div>
    );
    return (
        <div className="team-form">
            <div className="form-head">
                <div className="title">{t("CMS.forms.management")}</div>
            </div>
            <div className="form-list">
                <Form form={teamForm}  layout="vertical" className="custom-form">
                    <Form.Item label={t("CMS.forms.titleEnglish")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleEnglish")}
                            value={data?.title?.en ?? ''}
                            maxLength={100}
                            onChange={(e) => managementInputChange(e.target.value, "title", 'en')}
                        />
                    </Form.Item>
                    <Form.Item label={t("CMS.forms.titleArabic")} required>
                        <Input
                            placeholder={t("CMS.forms.enterTitleArabic")}
                            value={data?.title?.ar ?? ''}
                            dir="rtl"
                            maxLength={100}
                            onChange={(e) => managementInputChange(e.target.value, "title", 'ar')}
                        />
                    </Form.Item>
                    <div className="member-tabs">
                        <button
                            type="button"
                            className={`member-tab-button ${activeMember === 1 ? "active" : ""}`}
                            onClick={() => setActiveMember(1)}
                        >
                            {t("CMS.forms.member")} 1
                        </button>
                        <button
                            type="button"
                            className={`member-tab-button ${activeMember === 2 ? "active" : ""}`}
                            onClick={() => setActiveMember(2)}
                        >
                            {t("CMS.forms.member")} 2
                        </button>
                    </div>
                    <div className="member-tab-content">
                        {activeMember === 1 && renderMemberFields(data?.memberOne, 1, true)}
                        {activeMember === 2 && renderMemberFields(data?.memberTwo, 2, false)}
                    </div>
                </Form>
            </div>
        </div>
    )
});

export default TeamForm;
