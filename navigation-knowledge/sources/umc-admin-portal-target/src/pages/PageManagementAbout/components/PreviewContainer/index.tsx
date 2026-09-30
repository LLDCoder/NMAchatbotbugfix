import React, { useEffect } from "react";
import StarIcon from "@/assets/images/primary-star.svg";
import FooterBg from "@/assets/images/footer.png";
import type {
    AboutPartnership,
    StrategicObjectives,
    VisionMissionValues,
    AboutFormParam
} from "@/services/cms";
import AboutOne from "@/assets/images/about-one.png";
import AboutTwo from "@/assets/images/about-two.png";
import AboutThree from "@/assets/images/about-light.png";
import AboutFour from "@/assets/images/about-four.png";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import StrChat from "@/assets/images/str-chart.svg";
import StrFilm from "@/assets/images/str-film.svg";
import StrHonor from "@/assets/images/str-honor.svg";
import StrLight from "@/assets/images/str-light.svg";
import StrScales from "@/assets/images/str-scales.svg";
import StrTarget from "@/assets/images/str-target.svg";
import VisionImg from "@/assets/images/vision.png";
import MissionImg from "@/assets/images/mission.png";
import { useTranslation } from "react-i18next";
import "./index.less";

type PreviewMode = "default" | "view" | "preview";

interface PreviewProps {
    crrent: number;
    lan: string;
    aboutData: AboutFormParam;
    strategicData: StrategicObjectives;
    partnershipData: AboutPartnership;
    visionMissionData: VisionMissionValues;
    mode?: PreviewMode;
    isReject?: boolean;
    selectArea: (crrent: number) => void;
};

const PreviewContainer: React.FC<PreviewProps> = ({
    crrent,
    lan,
    aboutData,
    strategicData,
    partnershipData,
    visionMissionData,
    mode = "default",
    isReject = false,
    selectArea
}) => {
    const { t } = useTranslation();
    const aboutRef = React.useRef<HTMLDivElement>(null);
    const visionRef = React.useRef<HTMLDivElement>(null);
    const strategicRef = React.useRef<HTMLDivElement>(null);
    const partnerRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const strategicImgs = [
        {
            key: 1,
            src: strategicData?.images[0],
            class: "img-1"
        },
        {
            key: 2,
            src: strategicData?.images[1],
            class: "img-2"
        },
        {
            key: 3,
            src: strategicData?.images[2],
            class: "img-3"
        }
    ];
    const strategieList = [
        {
            key: 1,
            icon: StrScales,
            text: "Developing a competitive legislative environment that keeps pace with technical developments and rapid transformations",
            class: "strategie1"
        },
        {
            key: 2,
            icon: StrHonor,
            text: "Providing media services with the highest standards and quality, efficiency and transparency",
            class: "strategie2"
        },
        {
            key: 3,
            icon: StrTarget,
            text: "Positioning the UAE on the global media map",
            class: "strategie3"
        },
        {
            key: 4,
            icon: StrLight,
            text: "Establishing a culture of innovation in the media sector",
            class: "strategie4"
        },
        {
            key: 5,
            icon: StrFilm,
            text: "Enabling the growth and prosperity of the media industry in the UAE",
            class: "strategie5"
        },
        {
            key: 6,
            icon: StrChat,
            text: "Enhancing the contribution of the media to the national economy",
            class: "strategie6"
        }
    ];
    useEffect(() => {
        if (crrent === 1) {
            scrollToElement(aboutRef);
        } else if (crrent === 2) {
            scrollToElement(visionRef);
        } else if (crrent === 3) {
            scrollToElement(strategicRef);
        } else if (crrent === 4) {
            scrollToElement(partnerRef);
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
    const getAboutIcon = (i: number) => {
        switch (i) {
            case 0:
                return AboutOne;
            case 1:
                return AboutTwo;
            case 2:
                return AboutThree;
            case 3:
                return AboutFour;
            default:
                return AboutOne;
        }
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
    const selectNow = (i: number) => {
        if (mode == "preview") return;
        selectArea(i);
    };
    return (
        <div className="preview-wrapper">
            <div
                className={`preview-container ${getModeClassName()} ${isReject ? 'reject' : ''}`}
                dir={lan === "ar" ? "rtl" : "ltr"}
                ref={containerRef}
            >
                {/* About Us */}
                <div
                    className={`shine-box ${crrent !== 1 && 'shine-box-hide'}`}
                    ref={aboutRef}
                    onClick={() => selectNow(1)}
                >
                    {crrent == 1 && <div className='shine-tag'>{t("CMS.pageManagementAbout.modules.aboutUs")}</div>}
                    <div className="about-us">
                        <AuthenticatedDocumentImage className="about-img" src={aboutData?.image} alt="" />
                        <div className="about-content">
                            <div className="content-left">
                                <div className="title">{aboutData?.title[lan]}</div>
                                <img src={StarIcon} alt="" />
                                <div className="description">{aboutData?.description[lan]}</div>
                            </div>
                            <div className="content-right">
                                {aboutData?.responsibilities.map((item) => (
                                    <div className="responsibilitie-item">
                                        <div className="item-title">{item.title[lan]}</div>
                                        <div className="item-content">{item.description[lan]}</div>
                                    </div>))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Vision, Mission & Values */}
                <div
                    className={`shine-box ${crrent !== 2 && 'shine-box-hide'}`}
                    ref={visionRef}
                    onClick={() => selectNow(2)}
                >
                    {crrent == 2 && <div className='shine-tag'>{t("CMS.pageManagementAbout.modules.visionMissionValues")}</div>}
                    <div className="vision-mission">
                        <div className="vision-box">
                            <AuthenticatedDocumentImage className="vision-img" src={visionMissionData?.image} alt="" />
                            <div className="vision-list">
                                <div className="vision-item">
                                    <div className="item-top">
                                        {visionMissionData?.vision.title[lan]}
                                        <img src={VisionImg} alt="" />
                                    </div>
                                    <div className="item-text">{visionMissionData?.vision.description[lan]}</div>
                                </div>
                                <div className="vision-item">
                                    <div className="item-top">
                                        {visionMissionData?.mission.title[lan]}
                                        <img src={MissionImg} alt="" />
                                    </div>
                                    <div className="item-text">{visionMissionData?.mission.description[lan]}</div>
                                </div>
                            </div>
                        </div>
                        <div className="values-list">
                            {visionMissionData?.values.map((item, i) => (
                                <div className="value-item">
                                    <img src={getAboutIcon(i)} alt="" />
                                    <div className="title">{item.title[lan]}</div>
                                    <div className="text">{item.description[lan]}</div>
                                </div>))}
                        </div>
                    </div>
                </div>
                {/* Strategic Objectives */}
                <div
                    className={`shine-box ${crrent !== 3 && 'shine-box-hide'}`}
                    ref={strategicRef}
                    onClick={() => selectNow(3)}
                >
                    {crrent == 3 && <div className='shine-tag'>{t("CMS.pageManagementAbout.modules.strategicObjectives")}</div>}
                    <div className="strategic-objectives">
                        <div className="title-box">
                            <div className="title">{strategicData?.title[lan]}</div>
                            <img src={StarIcon} alt="" />
                            <div className="sub-title">{strategicData?.description[lan]}</div>
                        </div>
                        {strategicImgs.map((item) => (
                            <div className={`img-box ${item.class}`} key={item.key}>
                                <AuthenticatedDocumentImage src={item.src} alt="" />
                            </div>))}
                        {strategieList.map((item, index) => (
                            <div className={`strategie-box ${item.class}`} key={item.key}>
                                <img src={item.icon} alt="" />
                                <div className="strategie-text">{strategicData?.strategies[index][lan]}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Partners */}
                <div
                    className={`shine-box ${crrent !== 4 && 'shine-box-hide'}`}
                    ref={partnerRef}
                    onClick={() => selectNow(4)}
                >
                    {crrent == 4 && <div className='shine-tag'>{t("CMS.pageManagementAbout.modules.partners")}</div>}
                    <div className="partners-box">
                        <div className="title-box">
                            <div className="title">{partnershipData?.title[lan]}</div>
                            <img src={StarIcon} alt="" />
                        </div>
                        <div className='scroll-box'>
                            {partnershipData?.partners.map((item, index) => (
                                <div className='partnership-item' key={index}>
                                    {item.logo &&
                                        (item.link ? (
                                            <a
                                                href={item.link.startsWith("http") ? item.link : `https://${item.link}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <AuthenticatedDocumentImage src={item.logo} alt="" />
                                            </a>
                                        ) : (
                                            <AuthenticatedDocumentImage src={item.logo} alt="" />
                                        ))}
                                </div>))}
                        </div>
                    </div>
                </div>
                <div className="footer-box">
                    <img src={FooterBg} alt="" />
                </div>
            </div>
        </div>
    )
};

export default PreviewContainer;
