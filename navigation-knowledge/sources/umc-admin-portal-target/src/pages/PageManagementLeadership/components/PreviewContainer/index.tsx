import React, { useState, useRef, useEffect } from "react";
import ChairmanBg from "@/assets/images/chairman-bg.png";
import StarIcon from "@/assets/images/primary-star.svg";
import BorderBg from "@/assets/images/border-bg.png";
import type { ChairmanParam, DirectorParam, ManagementParam } from "@/services/cms";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { useTranslation } from "react-i18next";
import './index.less';

interface Props {
    crrent: number;
    chairmanData: ChairmanParam;
    lan: string;
    directorData: DirectorParam;
    managementData: ManagementParam;
    mode?: 'default' | 'view' | 'preview';
    isReject?: boolean;
    selcetArea: (crrent: number) => void;
};
const PreviewContainer: React.FC<Props> = ({
    crrent,
    lan,
    chairmanData,
    directorData,
    managementData,
    mode = 'default',
    isReject = false,
    selcetArea
}) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const chairmanRef = React.useRef<HTMLDivElement>(null);
    const directorsRef = React.useRef<HTMLDivElement>(null);
    const managementRef = React.useRef<HTMLDivElement>(null);
    const [tabOne, setTabOne] = useState(1);
    const [tabTwo, setTabTwo] = useState(1);
    useEffect(() => {
        if (crrent === 1) {
            scrollToElement(chairmanRef);
        } else if (crrent === 2) {
            scrollToElement(directorsRef);
        } else if (crrent === 3) {
            scrollToElement(managementRef);
        }
    }, [crrent]);
    const scrollToElement = (elementRef: React.RefObject<HTMLDivElement>) => {
        if (!elementRef.current || !containerRef.current) return;
        const container = containerRef.current;
        const element = elementRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scrollTop = elementRect.top - containerRect.top + container.scrollTop;

        container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    };
    const getModeClassName = () => {
        switch (mode) {
            case "default":
                return "";
            case "view":
                return "preview-pattern";
            case "preview":
                return "preview-max";
            default:
                return "";
        }
    };
    const selecNow = (index: number) => {
        if (mode == 'preview') return;
        selcetArea(index);
    };
    return (
        <div className="preview-wrapper">
            <div
                className={`preview-container ${getModeClassName()} ${isReject ? 'reject' : ''}`}
                dir={lan === "ar" ? "rtl" : "ltr"}
                ref={containerRef}
            >
                {/* Chairman */}
                <div
                    className={`shine-box ${crrent !== 1 && 'shine-box-hide'}`}
                    ref={chairmanRef}
                    onClick={() => selecNow(1)}
                >
                    {crrent == 1 && <div className='shine-tag'>{t("CMS.pageManagementLeadership.modules.chairman")}</div>}
                    <div className="chairman-box">
                        <img className="chairman-bg" src={ChairmanBg} alt="" />
                        <div className="chairman-content" >
                            <div className="img-box" style={{ backgroundImage: `url(${BorderBg})` }}>
                                <AuthenticatedDocumentImage src={chairmanData?.image} alt="" />
                            </div>
                            <div className="name">{chairmanData?.position[lan]}</div>
                            <img src={StarIcon} alt="" />
                            <div className="description">{chairmanData?.fullName[lan]}</div>
                            <div className="tip">{chairmanData?.positionDescription[lan]}</div>
                        </div>
                    </div>
                </div>
                {/* Board of Directors */}
                <div
                    className={`shine-box ${crrent !== 2 && 'shine-box-hide'}`}
                    ref={directorsRef}
                    onClick={() => selecNow(2)}
                >
                    {crrent == 2 && <div className='shine-tag'>{t("CMS.pageManagementLeadership.modules.boardOfDirectors")}</div>}
                    <div className="directors-box">
                        <div className="top-box">
                            <div className="title">{directorData?.title[lan]}</div>
                            <img src={StarIcon} alt="" />
                        </div>
                        <div className="directors-list">
                            {directorData?.members.map((item) => (
                                <div className="directors-item">
                                    <AuthenticatedDocumentImage src={item.image} alt="" />
                                    <div className="item-content">
                                        <div className="item-title">{item.fullName[lan]}</div>
                                        <div className="item-description">{item.positionDescription[lan]}</div>
                                    </div>
                                </div>))}
                        </div>
                    </div>
                </div>
                {/* Management Team */}
                <div
                    className={`shine-box ${crrent !== 3 && 'shine-box-hide'}`}
                    ref={managementRef}
                    onClick={() => selecNow(3)}
                >
                    {crrent == 3 && <div className='shine-tag'>{t("CMS.pageManagementLeadership.modules.managementTeam")}</div>}
                    <div className="management-box">
                        <div className="top-box">
                            <div className="title">{managementData?.title[lan]}</div>
                            <img src={StarIcon} alt="" />
                        </div>
                        <div className="management-list">
                            <div className="management-left">
                                <AuthenticatedDocumentImage src={managementData?.memberOne.image} alt="" />
                                <div className="name">{managementData?.memberOne.fullName[lan]}</div>
                                <div className="description">{managementData?.memberOne.positionDescription[lan]}</div>
                                <div className="tabs-box">
                                    <div
                                        className={`tabs-item ${tabOne == 1 && 'active-item'}`}
                                        onClick={() => setTabOne(1)}
                                    >{t("CMS.forms.quote")}</div>
                                    <div
                                        className={`tabs-item ${tabOne == 2 && 'active-item'}`}
                                        onClick={() => setTabOne(2)}
                                    >{t("CMS.forms.profile")}</div>
                                    <div
                                        className={`tabs-item ${tabOne == 3 && 'active-item'}`}
                                        onClick={() => setTabOne(3)}
                                    >{t("CMS.forms.contact")}</div>
                                </div>
                                <div className="details-text">{tabOne == 1 ? managementData?.memberOne.quote[lan] : managementData?.memberOne.profile[lan]}</div>
                            </div>
                            <div className="management-right">
                                <AuthenticatedDocumentImage src={managementData?.memberTwo.image} alt="" />
                                <div className="name">{managementData?.memberTwo.fullName[lan]}</div>
                                <div className="description">{managementData?.memberTwo.positionDescription[lan]}</div>
                                {/* <div className="tabs-box">
                                    <div
                                        className={`tabs-item ${tabTwo == 1 && 'active-item'}`}
                                        onClick={() => setTabTwo(1)}
                                    >{t("CMS.forms.quote")}</div>
                                    <div
                                        className={`tabs-item ${tabTwo == 2 && 'active-item'}`}
                                        onClick={() => setTabTwo(2)}
                                    >{t("CMS.forms.profile")}</div>
                                    <div
                                        className={`tabs-item ${tabTwo == 3 && 'active-item'}`}
                                        onClick={() => setTabTwo(3)}
                                    >{t("CMS.forms.contact")}</div>
                                </div> */}
                                <div className="details-text">{managementData?.memberTwo.profile[lan]}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default PreviewContainer;
