import { DownOutlined } from "@ant-design/icons"
import { ExpandContext } from "@/pages/TicketsDetails"
import './index.less'
import { useContext, useEffect, useState } from "react"
import { ExpandBtn } from "../ExpandBtn"
import Avatar from '@/assets/images/default-admin-avatar.svg'
import Paperclip from '@/assets/images/paperclip.png'
import { getApplicants, type IApplicantsResponse } from "@/services/tickets"
import { useTranslation } from "react-i18next"
import {
    createContactNumberSnapshot,
    getContactNumberDisplay,
} from "@/components/common/MobileNumberInput"

export default function ApplicantInformation(){
    const { i18n, t } = useTranslation();
    const expandContext = useContext(ExpandContext);
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const [data, setData] = useState<IApplicantsResponse>({} as IApplicantsResponse);
    const phoneNumberDisplay = getContactNumberDisplay(
        createContactNumberSnapshot({
            countryCode: data.phoneCountryCode,
            localNumber: data.phoneLocalNumber,
            fullNumber: data.phoneNumber,
        }),
    );
    const type = !data.userProfileId ? 1 : (data.userName === data.personalName && data.email === data.personalEmail ? 2 : 3);
    const renderExpandBtn = () => {
        const { applicantInformation: isExpanded } = expandContext?.whichIsExpanded || {}
        return (
        <ExpandBtn
            isExpanded={isExpanded || false}
            onShrinkClick={() => {
                expandContext?.dispatch?.({ applicantInformation: false })
            }}
            onExpandClick={() => {
                expandContext?.dispatch?.({ applicantInformation: true })
            }}
        />
        )
    }

    const renderMoreContent = () => {
        return <div>
            {t("Customer.ticketsDetails.applicantInformation.more")}
        </div>
    }

    useEffect(()=>{
        if(id){
            getApplicants(Number(id)).then(res => { 
                if(res.data){
                    setData(res.data);
                }
            })
        }
    },[])

    const renderBasicContent = () => {
        if(type === 1){
            return <div className="applicant-information-box">
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.fullName")}</div>
                    <div className="applicant-information-value">{data.personalName || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.email")}</div>
                    <div className="applicant-information-value">{data.email || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.mobileNumber")}</div>
                    <div className="applicant-information-value">{phoneNumberDisplay || '-'}</div>
                </div>
            </div>
        }
        if(type === 2){
            return <div className="applicant-information-box">
                <div className="applicant-information-avatar-box">
                    <div className="applicant-information-avatar">
                        <img src={Avatar} />
                    </div>
                    <div className="applicant-information-name">
                        <div className="applicant-information-name-en">{data.personalName || '-'}</div>
                        <div className="applicant-information-name-ar">{data.personalNameAr || '-'}</div>
                    </div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.email")}</div>
                    <div className="applicant-information-value">{data.email || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.mobileNumber")}</div>
                    <div className="applicant-information-value">{phoneNumberDisplay || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.emiratesId")}</div>
                    <div className="applicant-information-value">{data.emiratesId || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.nationality")}</div>
                    <div className="applicant-information-value">{i18n.resolvedLanguage === 'en' ? data.nationalityObj?.nameEn || '-' : data.nationalityObj?.nameAr || '-'}</div>
                </div>
                <div className="applicant-information-doc-box">
                    <div className="applicant-information-doc">
                        <img src={Paperclip} />
                        <div className="applicant-information-doc-text">{t("Customer.ticketsDetails.applicantInformation.documents")}</div>
                    </div>
                    <div className="applicant-information-doc-num">{data.documentCount || '-'}</div>
                </div>
            </div>
        }
        if(type === 3){
            return <div className="applicant-information-box">
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.fullName")}</div>
                    <div className="applicant-information-value">{data.userName || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.email")}</div>
                    <div className="applicant-information-value">{data.email || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.mobileNumber")}</div>
                    <div className="applicant-information-value">{phoneNumberDisplay || '-'}</div>
                </div>
                <div className="divider"></div>
                <div className="applicant-information-avatar-box">
                    <div className="applicant-information-avatar">
                        <img src={Avatar} />
                    </div>
                    <div className="applicant-information-name">
                        <div className="applicant-information-name-en">{data.personalName || '-'}</div>
                        <div className="applicant-information-name-ar">{data.personalNameAr || '-'}</div>
                    </div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.emiratesId")}</div>
                    <div className="applicant-information-value">{data.emiratesId || '-'}</div>
                </div>
                <div className="applicant-information-item">
                    <div className="applicant-information-field">{t("Customer.ticketsDetails.applicantInformation.nationality")}</div>
                    <div className="applicant-information-value">{i18n.resolvedLanguage === 'en' ? data.nationalityObj?.nameEn || '-' : data.nationalityObj?.nameAr || '-'}</div>
                </div>
                <div className="applicant-information-doc-box">
                    <div className="applicant-information-doc">
                        <img src={Paperclip} />
                        <div className="applicant-information-doc-text">{t("Customer.ticketsDetails.applicantInformation.documents")}</div>
                    </div>
                    <div className="applicant-information-doc-num">{data.documentCount || '-'}</div>
                </div>
            </div>
        }
    }

    const renderContent = () => {
        switch (expandContext?.whichIsExpanded?.applicantInformation) {
        case true:
            return renderMoreContent()
        case false:
        default:
            return renderBasicContent()
        }
    }

    return <details className='applicant-information' open>
        <summary className="overview-title">
            <b>{t("Customer.ticketsDetails.applicantInformation.title")}</b>
            <div>
                <DownOutlined className="collapse-icon" />
                {type!==1 && renderExpandBtn()}
            </div>
        </summary>
        {renderContent()}
    </details>
}
