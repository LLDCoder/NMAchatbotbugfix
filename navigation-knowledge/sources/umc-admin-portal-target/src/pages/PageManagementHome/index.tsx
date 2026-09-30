import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Form, Input, Switch } from "antd";
import { CustomButton, CustomMessage, CustomFooter, ConfirmModal } from "@/components/common";
import type { BannerItem, AboutParam, PartnershipParam, FooterParam } from "@/services/cms";
import ErrorIcon from "@/assets/images/error.svg";
import {
    homeConfig,
    getPageById
} from "@/services/cms";
import { urlRegex, phoneRegex } from "@/utils/validation";
import { useLocation, useHistory } from "react-router-dom";
import PreviewContainer from "./components/PreviewContainer";
import BannerForm from "./components/BannerForm";
import AboutForm from "./components/AboutForm";
import PartnerForm from "./components/PartnerForm";
import { HOME_PREVIEW_STORAGE_KEY } from "./previewStorage";
import "./index.less";
import RejectModal from "../PageManagement/components/RejectModal";
import ApproveModal from "../PageManagement/components/ApproveModal";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { PERMISSION_CODES } from "@/constants/permissionCodes";

const PageManagementHome = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const routerHistory = useHistory();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get("id");
    const isView = searchParams.get("isView");
    const [footerForm] = Form.useForm();
    const [reviewData, setReviewData] = useState<{
        status: number,
        updateBy: string,
        updateTime: string,
        reason: string
    }>({
        status: 0,
        updateBy: '',
        updateTime: '',
        reason: ''
    });
    const hydratingRef = useRef(false);
    // Tracks whether a draft was saved in this session: per PRD, leaving after
    // saving (or when editing a Draft/Rejected record) returns to the Draft
    // view of the list, otherwise to the Published view.
    const hasSavedRef = useRef(false);
    const [bannerList, setBannerList] = useState<BannerItem[]>([]);
    const [aboutParam, setAboutParam] = useState<AboutParam>();
    const [partnerParam, setPartnerParam] = useState<PartnershipParam>();
    const [footerParam, setFooterParam] = useState<FooterParam>();
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    const [crrentMenu, setCrrentMenu] = useState<number>(1);
    const bannerFormRef = useRef<any>();

    const [bannerEmpty, setBannerEmpty] = useState(0);
    const [aboutEmpty, setAboutEmpty] = useState(0);
    const [partnerEmpty, setPartnerEmpty] = useState(0);
    const [footerEmpty, setFooterEmpty] = useState(0);

    const [approveModalVisible, setApproveModalVisible] = useState<boolean>(false);
    const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
    const [reviewVisible, setReviewVisible] = useState<boolean>(false);
    const [publishVisible, setPublishVisible] = useState<boolean>(false);
    const [leaveVisible, setLeaveVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const menuList = [
        { title: t("CMS.pageManagementHome.modules.heroBanner"), key: 1, emptyCount: bannerEmpty },
        { title: t("CMS.pageManagementHome.modules.aboutUs"), key: 2, emptyCount: aboutEmpty },
        { title: t("CMS.pageManagementHome.modules.partnership"), key: 3, emptyCount: partnerEmpty },
        { title: t("CMS.pageManagementHome.modules.footer"), key: 4, emptyCount: footerEmpty }
    ];
    const [lan, setLan] = useState<string>("en");

    useEffect(() => {
        getPageDetail();
    }, []);
    const buildDefaultConfig = () => {
        const i18nText = () => ({ en: "", ar: "" });
        setBannerList([{
            id: Date.now() + Math.random(), isOpen: true, order: 1,
            title: i18nText(), description: i18nText(),
            cover: { type: "IMAGE", url: "" },
            mobileCover: { type: "IMAGE", url: "" },
            primaryButton: { enabled: false, label: i18nText(), link: "" },
            secondaryButton: { enabled: false, label: i18nText(), link: "" },
            enabled: true
        } as any]);
        setAboutParam({
            title: i18nText(), subTitle: i18nText(), description: i18nText(),
            button: { enabled: true, label: i18nText(), link: "" },
            highlights: Array.from({ length: 4 }, () => ({ title: i18nText(), description: i18nText(), isOpen: false })),
            images: Array.from({ length: 8 }, () => "")
        } as any);
        // Partner list starts with 5 entries (the PRD minimum: delete is
        // disabled at 5, add is capped at 10).
        setPartnerParam({
            label: i18nText(), link: "",
            partners: Array.from({ length: 5 }, () => ({ logo: "", link: "" }))
        } as any);
        setFooterParam({
            contactCard: { title: i18nText(), businessHours: i18nText(), phoneNumber: "", whatsApp: "", locationLink: "" },
            socialMedia: { facebook: true, facebookLink: "", instagram: true, instagramLink: "", youTube: true, youTubeLink: "", x: true, xLink: "", linkedIn: true, linkedInLink: "" }
        } as any);
    };
    const getPageDetail = () => {
        hydratingRef.current = true;
        if (!id) {
            buildDefaultConfig();
            setTimeout(() => { hydratingRef.current = false; }, 0);
            return;
        }
        getPageById(id).then((res) => {
            const data = res.data.config
            setBannerList(data.banner.items);
            setAboutParam(data.about);
            // Pad the partner list up to the PRD minimum of 5 entries so
            // legacy data also opens with 5 (delete stays disabled at 5).
            const partnership = data.partnership || { label: { en: "", ar: "" }, link: "", partners: [] };
            const partners = [...(partnership.partners || [])];
            while (partners.length < 5) partners.push({ logo: "", link: "" });
            setPartnerParam({ ...partnership, partners });
            // Backward compat: businessHours used to be a plain string before going bilingual
            const footer = data.footer;
            if (footer?.contactCard && typeof footer.contactCard.businessHours === 'string') {
                footer.contactCard.businessHours = { en: footer.contactCard.businessHours, ar: "" };
            }
            setFooterParam(footer);
            setReviewData({
                status: res.data.status,
                updateBy: res.data.updateUserInfo?.name || '',
                updateTime: res.data.updateTime,
                reason: res.data.reason
            })
            setIsEdit(false);
            setTimeout(() => { hydratingRef.current = false; }, 0);
        });
    };

    useEffect(() => {
        if (hydratingRef.current) return;
        setIsEdit(true);
    }, [bannerList, aboutParam, partnerParam, footerParam]);
    // methods
    const menuChange = (index: number) => {
        setCrrentMenu(menuList[index].key);
    };
    const addBanner = () => {
        if (bannerList.length >= 6) return;
        const newBanner = {
                id: Date.now() + Math.random(),
                isOpen: true,
                order:  bannerList.length + 1,
                title: {
                    en: "",
                    ar: ""
                },
                description: {
                    en: "",
                    ar: ""
                },
                cover: {
                    type: "IMAGE",
                    url: ""
                },
                primaryButton: {
                    enabled: false,
                    label: {
                        en: "",
                        ar: ""
                    },
                    link: ""
                },
                secondaryButton: {
                    enabled: false,
                    label: {
                        en: "",
                        ar: ""
                    },
                    link: ""
                },
                enabled: true
            }
        setBannerList([...bannerList, newBanner]);
    };
    const addPartner = () => {
        if (partnerParam?.partners && partnerParam.partners.length >= 10) return;
        const newPartner = { logo: "", link: "" };
        const newList = [...partnerParam?.partners || [], newPartner];
        setPartnerParam(prev => ({
            ...prev,
            partners: newList,
            label: prev?.label || { en: "", ar: "" },
            link: prev?.link || ""
        }));
    };
    const deleteBanner = (index: number) => {
        const list = [...bannerList];
        list.splice(index, 1);
        setBannerList(list);
    };
    // lang: which locale of a bilingual field to write; null for plain fields (e.g. link)
    const bannerInputChange = (value: string, index: number, key: string, lang: 'en' | 'ar' | null, secKey?:string) => {
        setBannerList((prev) => {
            const list = prev.map((item, idx) => {
                if (idx !== index) return item;

                const newItem = { ...item };
                if (secKey) {
                    if (lang) {
                        newItem[key] = {
                            ...newItem[key],
                            [secKey]: {
                                ...(newItem[key] as any)[secKey],
                                [lang]: value
                            }
                        };
                    } else {
                        newItem[key] = {
                            ...newItem[key],
                            [secKey]: value
                        };
                    }
                } else {
                    if (lang) {
                        newItem[key] = {
                            ...(newItem[key] as any),
                            [lang]: value
                        };
                    } else {
                        newItem[key] = value as any;
                    }
                }
                return newItem;
            });
            return list;
        });
    };
    const coverTypeOf = (url: string) => {
        const u = (url || '').toLowerCase();
        if (u.endsWith('.mp4') || u.endsWith('.mov')) return 'VIDEO';
        if (u.endsWith('.gif')) return 'GIF';
        return 'IMAGE';
    };
    const bannerFileChange = (value: any, index: number) => {
        setBannerList((prev) => prev.map((item, idx) => idx !== index ? item : {
            ...item,
            cover: { type: coverTypeOf(value[0].url), url: value[0].url }
        }));
    };
    const bannerMobileFileChange = (value: any, index: number) => {
        setBannerList((prev) => prev.map((item, idx) => idx !== index ? item : {
            ...item,
            mobileCover: { type: coverTypeOf(value[0].url), url: value[0].url }
        }));
    };
    const bannerDeleteMobileCover = (index: number) => {
        setBannerList((prev) => prev.map((item, idx) => idx !== index ? item : {
            ...item,
            mobileCover: { ...(item.mobileCover || { type: 'IMAGE', url: '' }), url: '' }
        }));
    };
    const bannerSwitchChange = (value: boolean, index: number, key: string) => {
        setBannerList((prev) => {
            return prev.map((item, idx) => {
                if (idx !== index) return item;
                return {
                    ...item,
                    [key]: {
                        ...(item[key] as any),
                        enabled: value
                    }
                };
            });
        });
    };
    const bannerDeleteCover = (index: number) => {
        setBannerList((prev) => {
            return prev.map((item, idx) => {
                if (idx !== index) return item;
                return {
                    ...item,
                    cover: {
                        ...item.cover,
                        url: ""
                    }
                };
            });
        });
    };
    // lang: which locale of a bilingual field to write; null for plain fields (e.g. link)
    const aboutInputChange = (value: string, key: string, lang: 'en' | 'ar' | null, index?:number) => {
        if (index || index === 0) {
            const list = [...aboutParam.highlights];
            if (lang) {
                list[index][key][lang] = value;
            } else {
                list[index][key] = value;
            }
            setAboutParam({...aboutParam , highlights: list });
        } else {
            if (key === 'buttonLabel') {
                const buttonObj = aboutParam?.button;
                buttonObj.label[lang || 'en'] = value;
                setAboutParam({...aboutParam , button: buttonObj });
            } else if (key === 'buttonLink') {
                const buttonObj = aboutParam.button;
                buttonObj.link = value;
                setAboutParam({...aboutParam , button: buttonObj });
            } else {
                if (lang) {
                    const aboutObj = {...aboutParam};
                    aboutObj[key][lang] = value;
                    setAboutParam(aboutObj);
                } else {
                    const aboutObj = {...aboutParam};
                    aboutObj[key] = value;
                    setAboutParam(aboutObj);
                }
            }
        }
    };
    const deletePartner = (index: number) => {
        const list = [...partnerParam?.partners || []];
        if (list.length <= 5) return;
        list.splice(index, 1);
        setPartnerParam({...partnerParam, partners: list });
    };
    const partnerInputChange = (value: string, key: string, index?: number) => {
        if (index || index === 0) {
            const list = [...partnerParam?.partners || []];
            list[index][key] = value;
            setPartnerParam({...partnerParam, partners: list });
        } else {
            if (key === 'label') {
                const labelObj = partnerParam?.label;
                labelObj[lan] = value;
                setPartnerParam({...partnerParam, label: labelObj });
            } else {
                const partnerObj = {...partnerParam};
                partnerObj[key] = value;
                setPartnerParam(partnerObj);
            }
        }
    };
    // lang: which locale of a bilingual field to write; null for plain fields (e.g. link)
    const footerInputChange = (value: string, key: string, lang: 'en' | 'ar' | null, type: 'card' | 'mdia') => {
        const footerObj = {...footerParam};
        if (type === 'card') {
            if (lang) {
                footerObj.contactCard[key] = {
                    ...(footerObj.contactCard[key] || {}),
                    [lang]: value
                };
            } else {
                footerObj.contactCard[key] = value;
            }
        } else {
            footerObj.socialMedia[key] = value;
        }
        setFooterParam(footerObj);
    };
    const footerSwitchChange = (value: boolean, key: string) => {
        const footerObj = {...footerParam};
        if (!footerObj.socialMedia) return;
        footerObj.socialMedia[key] = value;
        setFooterParam(footerObj);
    };
    // valid
    const isBannerListValid = useCallback(() => {
        if (!bannerList || bannerList.length === 0) {
            return false;
        };
        let emptyCount = 0;
        for (const item of bannerList) {
            if (!item.cover?.url) {
                emptyCount += 1;
            };
            if (!item.mobileCover?.url) {
                emptyCount += 1;
            };
            if (!item.title?.en) emptyCount += 1;
            if (!item.title?.ar) emptyCount += 1;
            if (!item.description?.en) emptyCount += 1;
            if (!item.description?.ar) emptyCount += 1;
            if (item.primaryButton?.enabled) {
                if (!item.primaryButton.label?.en) {
                    emptyCount += 1;
                }
                if (!item.primaryButton.label?.ar) {
                    emptyCount += 1;
                }
                if (!item.primaryButton?.link || !urlRegex.test(item.primaryButton.link)) {
                    emptyCount += 1;
                }
            }
            if (item.secondaryButton?.enabled) {
                if (!item.secondaryButton.label?.en) {
                    emptyCount += 1;
                }
                if (!item.secondaryButton.label?.ar) {
                    emptyCount += 1;
                }
                if (!item.secondaryButton?.link || !urlRegex.test(item.secondaryButton.link)) {
                    emptyCount += 1;
                }
            }
        };
        setBannerEmpty(emptyCount);
    }, [bannerList]);
    useEffect(() => {
        isBannerListValid();
    }, [bannerList, isBannerListValid]);

    const isAboutParamValid = useCallback(() => {
        if (!aboutParam) return false;

        let emptyCount = 0;
        if (!aboutParam?.title.en) emptyCount += 1;
        if (!aboutParam?.title.ar) emptyCount += 1;
        if (!aboutParam?.subTitle.en) emptyCount += 1;
        if (!aboutParam?.subTitle.ar) emptyCount += 1;
        if (!aboutParam?.description.en) emptyCount += 1;
        if (!aboutParam?.description.ar) emptyCount += 1;
        // Check if images array has all required URLs
        if (aboutParam?.images) {
            const imgCount = aboutParam.images.filter(url => !url || url.trim() == '');
            emptyCount += imgCount.length;
        }
        if (aboutParam.highlights) {
            for (const item of aboutParam.highlights) {
                if (!item.title?.en) emptyCount += 1;
                if (!item.title?.ar) emptyCount += 1;
                if (!item.description?.en) emptyCount += 1;
                if (!item.description?.ar) emptyCount += 1;
            }
        }
        
        // Check if button has required fields when enabled
        if (aboutParam.button) {
            if (!aboutParam.button.label?.en) {
                emptyCount += 1;
            }
            if (!aboutParam.button.label?.ar) {
                emptyCount += 1;
            }
            if (!aboutParam.button.link || !urlRegex.test(aboutParam.button.link)) {
                emptyCount += 1;
            }
        }
        setAboutEmpty(emptyCount);
    }, [aboutParam]);

    useEffect(() => {
        isAboutParamValid();
    }, [aboutParam, isAboutParamValid]);

    const isPartnerParamValid = useCallback(() => {
        if (!partnerParam) return false;
        
        let emptyCount = 0;
        
        if (partnerParam.partners) {
            for (const item of partnerParam.partners) {
                if (!item.logo || item.logo.trim() === '') {
                    emptyCount += 1;
                }
                if (!item.link || item.link.trim() === '' || !urlRegex.test(item.link)) {
                    emptyCount += 1;
                }
            }
        }
        
        setPartnerEmpty(emptyCount);
    }, [partnerParam]);

    useEffect(() => {
        isPartnerParamValid();
    }, [partnerParam, isPartnerParamValid]);

    const isFooterParamValid = useCallback(() => {
        if (!footerParam) return false;
        
        let emptyCount = 0;
        // Check contact card fields
        if (footerParam.contactCard) {
            if (!footerParam.contactCard.title?.en) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.title?.ar) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.businessHours?.en?.trim()) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.businessHours?.ar?.trim()) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.phoneNumber?.trim() || !phoneRegex.test(footerParam.contactCard.phoneNumber.trim())) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.whatsApp?.trim() || !phoneRegex.test(footerParam.contactCard.whatsApp.trim())) {
                emptyCount += 1;
            }
            if (!footerParam.contactCard.locationLink || footerParam.contactCard.locationLink.trim() === '') {
                emptyCount += 1;
            }
        }
        
        // Check social media fields
        if (footerParam.socialMedia) {
            if (footerParam.socialMedia.facebook) {
                if (!footerParam.socialMedia.facebookLink || !urlRegex.test(footerParam.socialMedia.facebookLink)) {
                    emptyCount += 1;
                }
            }

            if (footerParam.socialMedia.instagram) {
                if (!footerParam.socialMedia.instagramLink || !urlRegex.test(footerParam.socialMedia.instagramLink)){
                    emptyCount += 1;
                }
            }

            if (footerParam.socialMedia.youTube) {
                if (!footerParam.socialMedia.youTubeLink || !urlRegex.test(footerParam.socialMedia.youTubeLink)) {
                    emptyCount += 1;
                }
            }
            
            if (footerParam.socialMedia.x) {
                if (!footerParam.socialMedia.xLink || !urlRegex.test(footerParam.socialMedia.xLink)) {
                    emptyCount += 1;
                }
            }
            
            if (footerParam.socialMedia.linkedIn) {
                if (!footerParam.socialMedia.linkedInLink || !urlRegex.test(footerParam.socialMedia.linkedInLink)) {
                    emptyCount += 1;
                }
            }
        }
                
        setFooterEmpty(emptyCount);
    }, [footerParam]);

    useEffect(() => {
        isFooterParamValid();
    }, [footerParam, isFooterParamValid]);

    const saveDisabled = useMemo(() => {
        return bannerEmpty > 0 || aboutEmpty > 0 || partnerEmpty > 0 || footerEmpty > 0;
    }, [bannerEmpty, aboutEmpty, partnerEmpty, footerEmpty]);
    // Returns to the list view per PRD: Draft tab when this session saved a
    // draft, when reviewing a pending record, or when editing an existing
    // Draft/Rejected record; Published tab otherwise.
    const goBackToList = () => {
        const fromDraftView =
            hasSavedRef.current ||
            reviewData.status === 50 ||
            (!!id && (reviewData.status === 0 || reviewData.status === 10));
        routerHistory.push(`/cms/pageManagement?tab=${fromDraftView ? '2' : '1'}`);
    };
    // Per PRD, Preview opens the full homepage in a new window with its own
    // language and device toggles. The unsaved draft travels via sessionStorage.
    const openPreview = () => {
        sessionStorage.setItem(HOME_PREVIEW_STORAGE_KEY, JSON.stringify({
            bannerList,
            aboutParam,
            partnerParam,
            footerParam,
            lan
        }));
        window.open('/cms/pageManagement/PageManagementHome/preview', '_blank');
    };
    // save
    const handleSave = (status: number) => {
        setReviewVisible(false);
        setPublishVisible(false);
        const newList = bannerList.map((item, index) => ({...item, order: index + 1}));
        const param = {
            banner: {
                pageCode: "home",
                moduleCode: "banner",
                config: {
                    items: newList
                }
            },
            about: {
                pageCode: "home",
                moduleCode: "aboutus", 
                config: aboutParam as AboutParam
            },
            partnership: {
                pageCode: "home",
                moduleCode: "partnership",
                config: partnerParam as PartnershipParam
            },
            footer: {
                pageCode: "home",
                moduleCode: "footer",
                config: footerParam as FooterParam
            },
            auditStatus: status,
            isDraft: status == 0
        };
        setSaveLoading(true);
        homeConfig(param).then(() => {
            setSaveLoading(false);
            hasSavedRef.current = true;
            CustomMessage.success(t("CMS.common.operationSuccessful"));
            if (status == 100) {
                // Direct publish skips review and goes live immediately; land on the
                // Published tab since the draft is now published and left the Draft view.
                routerHistory.push(`/cms/pageManagement?tab=1`);
            } else if (status == 50) {
                goBackToList();
            } else {
                setIsEdit(false);
            }
        }).finally(() => {
            setSaveLoading(false);
        })
    };
    return (
        <div className="cms-body">
            {reviewData.status == 10 && <div className="reject-box">
                <img src={ErrorIcon} alt="" />
                <div className="reject-content">
                    <div className="title">{t("CMS.common.contentNotApproved")}</div>
                    <div className="text">{reviewData.reason}</div>
                </div>
            </div>}
            <div className="cms-container">
                {/* menu */}
                <div className="cms-menu">
                    <div className="select-box">{t("CMS.common.pageModules")}</div>
                    <div className="menu-list">
                        {
                            menuList.map((item, index) => {
                                return (<div 
                                        key={index}
                                        className={`menu-item ${item.key === crrentMenu && "menu-item-active"}`}
                                        onClick={() => menuChange(index)}
                                    >
                                    {item.title}
                                    {!!item.emptyCount && <span>{item.emptyCount}</span>}
                                </div>)
                            })
                        }
                    </div>
                </div>
                {/* view */}
                <div className={`cms-view ${(reviewData.status == 50 || isView) && 'cms-view-only'}`}>
                    <div className="language-change">
                        <div className="update-msg">
                            <div className="msg-label">{t("CMS.common.updatedBy")}</div>
                            <div className="msg-value">{reviewData.updateBy || '-'}</div>
                        </div>
                        <div className="update-msg">
                            <div className="msg-label">{t("CMS.common.lastUpdated")}</div>
                            <div className="msg-value">{reviewData.updateTime ? moment(reviewData.updateTime).format('DD/MM/YYYY HH:mm:ss') : '-'}</div>
                        </div>
                        <div className="lan">
                            <div
                                className={lan == "en" ? "lanitem active" : "lanitem"}
                                onClick={() => setLan("en")}
                            >
                                {t("CMS.common.english")}
                            </div>
                            <div
                                className={lan == "ar" ? "lanitem active" : "lanitem"}
                                onClick={() => setLan("ar")}
                            >
                                عربي
                            </div>
                        </div>
                    </div>
                    <PreviewContainer
                        crrent={crrentMenu}
                        lan={lan}
                        bannerList={bannerList}
                        aboutData={aboutParam as AboutParam}
                        partnershipData={partnerParam as PartnershipParam}
                        footerData={footerParam as FooterParam}
                        mode={isView || reviewData.status == 50 ? "view": "default"}
                        isReject={reviewData.status == 10}
                        selectArea={(val) => setCrrentMenu(val)}
                    />
                    
                </div>
                {/* form */}
                {(reviewData.status !== 50 && !isView) && 
                <div className={`cms-form ${reviewData.status == 10 ? 'reject-form': ''}`}>
                    {(() => {
                        switch (crrentMenu) {
                            case 1:
                            return (
                            <BannerForm
                                ref={bannerFormRef}
                                bannerList={bannerList}
                                bannerDeleteCover={bannerDeleteCover}
                                bannerDeleteMobileCover={bannerDeleteMobileCover}
                                bannerFileChange={bannerFileChange}
                                bannerMobileFileChange={bannerMobileFileChange}
                                bannerInputChange={bannerInputChange}
                                bannerSwitchChange={bannerSwitchChange}
                                addBanner={addBanner}
                                deleteBanner={deleteBanner}
                                changeBannerList={(val) => setBannerList(val)}
                            />)
                            case 2:
                            return (
                                <AboutForm
                                    aboutParam={aboutParam as AboutParam}
                                    aboutInputChange={aboutInputChange}
                                    changeAboutParam={(val) => setAboutParam(val)}
                                />
                            )
                            case 3:
                            return (
                                <PartnerForm
                                    partnerParam={partnerParam as PartnershipParam}
                                    partnerInputChange={partnerInputChange}
                                    addPartner={addPartner}
                                    deletePartner={deletePartner}
                                    changePartnerParam={(val) => setPartnerParam(val)}
                                />
                            )
                            case 4: // Footer
                            return (
                            <div className="footer-form">
                                <div className="form-head">
                                    <div className="title">{t("CMS.pageManagementHome.modules.footer")}</div>
                                </div>
                                <div className="form-list">
                                    <Form form={footerForm} layout="vertical" className="custom-form">
                                        <div className="primary-title">{t("CMS.pageManagementHome.footer.contactCard")}</div>
                                        <Form.Item label={t("CMS.forms.titleEnglish")} required>
                                            <Input
                                                placeholder={t("CMS.forms.enterTitleEnglish")}
                                                value={footerParam?.contactCard.title?.en ?? ''}
                                                maxLength={50}
                                                onChange={(e) => footerInputChange(e.target.value, 'title', 'en', 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item label={t("CMS.forms.titleArabic")} required>
                                            <Input
                                                placeholder={t("CMS.forms.enterTitleArabic")}
                                                value={footerParam?.contactCard.title?.ar ?? ''}
                                                dir="rtl"
                                                maxLength={50}
                                                onChange={(e) => footerInputChange(e.target.value, 'title', 'ar', 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item label={t("CMS.forms.businessHoursEnglish")} required>
                                            <Input
                                                placeholder={t("CMS.forms.enterBusinessHoursEnglish")}
                                                value={footerParam?.contactCard.businessHours?.en ?? ''}
                                                maxLength={100}
                                                onChange={(e) => footerInputChange(e.target.value, 'businessHours', 'en', 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item label={t("CMS.forms.businessHoursArabic")} required>
                                            <Input
                                                placeholder={t("CMS.forms.enterBusinessHoursArabic")}
                                                value={footerParam?.contactCard.businessHours?.ar ?? ''}
                                                dir="rtl"
                                                maxLength={100}
                                                onChange={(e) => footerInputChange(e.target.value, 'businessHours', 'ar', 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="phoneNumber"
                                            label={t("CMS.forms.phoneNumber")} required
                                            rules={[{ pattern: phoneRegex, message: t("CMS.forms.validPhone") }]}
                                        >
                                            <Input
                                                placeholder={t("CMS.forms.enterPhoneNumber")}
                                                defaultValue={footerParam?.contactCard.phoneNumber}
                                                onChange={(e) => footerInputChange(e.target.value, 'phoneNumber', null, 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="whatsapp"
                                            label={t("CMS.forms.whatsApp")} required
                                            rules={[{ pattern: phoneRegex, message: t("CMS.forms.validPhone") }]}
                                        >
                                            <Input
                                                placeholder={t("CMS.forms.enterWhatsAppNumber")}
                                                defaultValue={footerParam?.contactCard.whatsApp}
                                                onChange={(e) => footerInputChange(e.target.value, 'whatsApp', null, 'card')}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="locationLink"
                                            label={t("CMS.forms.locationLink")} required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input
                                                placeholder={t("CMS.forms.enterUrl")}
                                                maxLength={500}
                                                defaultValue={footerParam?.contactCard.locationLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'locationLink', null, 'card')}
                                            />
                                        </Form.Item>
                                        <div className="primary-title">{t("CMS.pageManagementHome.footer.socialMedia")}</div>
                                        <div className="primary-title">
                                            {t("CMS.forms.facebook")}
                                            <Switch 
                                                defaultChecked={footerParam?.socialMedia.facebook}
                                                onChange={(value) => footerSwitchChange(value, 'facebook')}
                                            />
                                        </div>
                                        {footerParam?.socialMedia.facebook && 
                                        <Form.Item 
                                            name="facebookLink" 
                                            label={t("CMS.forms.link")} 
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input 
                                                placeholder={t("CMS.forms.enterUrl")} 
                                                defaultValue={footerParam?.socialMedia.facebookLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'facebookLink', null, 'mdia')}
                                            />
                                        </Form.Item>}
                                        <div className="primary-title">
                                            {t("CMS.forms.instagram")}
                                            <Switch 
                                                defaultChecked={footerParam?.socialMedia.instagram}
                                                onChange={(value) => footerSwitchChange(value, 'instagram')}
                                            />
                                        </div>
                                        {footerParam?.socialMedia.instagram && 
                                        <Form.Item 
                                            name="instagramLink" 
                                            label={t("CMS.forms.link")} 
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input 
                                                placeholder={t("CMS.forms.enterUrl")} 
                                                defaultValue={footerParam?.socialMedia.instagramLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'instagramLink', null, 'mdia')}
                                            />
                                        </Form.Item>}
                                        <div className="primary-title">
                                            {t("CMS.forms.youTube")}
                                            <Switch 
                                                defaultChecked={footerParam?.socialMedia.youTube}
                                                onChange={(value) => footerSwitchChange(value, 'youTube')}
                                            />
                                        </div>
                                        {footerParam?.socialMedia.youTube && 
                                        <Form.Item 
                                            name="youTubeLink" 
                                            label={t("CMS.forms.link")} 
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input 
                                                placeholder={t("CMS.forms.enterUrl")} 
                                                defaultValue={footerParam?.socialMedia.youTubeLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'youTubeLink', null, 'mdia')}
                                            />
                                        </Form.Item>}
                                        <div className="primary-title">
                                            {t("CMS.forms.x")}
                                            <Switch 
                                                defaultChecked={footerParam?.socialMedia.x}
                                                onChange={(value) => footerSwitchChange(value, 'x')}
                                            />
                                        </div>
                                        {footerParam?.socialMedia.x && 
                                        <Form.Item 
                                            name="xLink" 
                                            label={t("CMS.forms.link")} 
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input 
                                                placeholder={t("CMS.forms.enterUrl")} 
                                                defaultValue={footerParam?.socialMedia.xLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'xLink', null, 'mdia')}
                                            />
                                        </Form.Item>}
                                        <div className="primary-title">
                                            {t("CMS.forms.linkedIn")}
                                            <Switch 
                                                defaultChecked={footerParam?.socialMedia.linkedIn} 
                                                onChange={(value) => footerSwitchChange(value, 'linkedIn')}
                                            />
                                        </div>
                                        {footerParam?.socialMedia.linkedIn && 
                                        <Form.Item 
                                            name="linkedInLink"
                                            label={t("CMS.forms.link")} 
                                            required
                                            rules={[{ pattern: urlRegex, message: t("CMS.forms.validUrl") }]}
                                        >
                                            <Input 
                                                placeholder={t("CMS.forms.enterUrl")} 
                                                defaultValue={footerParam?.socialMedia.linkedInLink}
                                                onChange={(e) => footerInputChange(e.target.value, 'linkedInLink', null, 'mdia')}
                                            />
                                        </Form.Item>}
                                    </Form>
                                </div>
                            </div>)
                            
                        }
                    })()}
                </div>}
            </div>

            <CustomFooter
                    onBack={() => {
                        if (reviewData.status == 50 || isView || !isEdit) {
                            goBackToList();
                        } else {
                            setLeaveVisible(true)
                        }
                    }}
                    rightContent={
                        reviewData.status === 50 ?
                        <>
                            <CustomButton
                                variant="outline"
                                text={t("CMS.common.preview")}
                                disabled={saveDisabled}
                                onClick={openPreview}
                            />
                            <CustomButton 
                                variant="outline"
                                customClassName="_danger-line"
                                text={t("CMS.common.reject")}
                                onClick={() => setRejectModalVisible(true)}
                                permissionCode="CMS.Pages.Homepage.Reject"
                                permissionRoutePath="/cms/pageManagement/PageManagementHome"
                            />
                            <CustomButton 
                                variant="primary"
                                text={t("CMS.common.approve")}
                                onClick={() => setApproveModalVisible(true)}
                                permissionCode="CMS.Pages.Homepage.Approve"
                                permissionRoutePath="/cms/pageManagement/PageManagementHome"
                            />
                        </>:
                        <>
                            <CustomButton
                                variant="outline"
                                text={t("CMS.common.preview")}
                                disabled={saveDisabled}
                                onClick={openPreview}
                            />
                            {!isView && <CustomButton 
                                variant="outline"
                                text={t("CMS.common.saveDraft")}
                                loading={saveLoading}
                                onClick={() => handleSave(0)}
                                permissionCode="CMS.Pages.Homepage.SaveDraft"
                                permissionRoutePath="/cms/pageManagement/PageManagementHome"
                            />}
                            {!isView && <CustomButton
                                variant="primary"
                                text={t("CMS.common.saveAndSubmit")}
                                disabled={saveDisabled}
                                loading={saveLoading}
                                onClick={() => setReviewVisible(true)}
                                permissionCode={PERMISSION_CODES.cms.pages.homepage.saveAndSubmit}
                                permissionRoutePath="/cms/pageManagement/PageManagementHome"
                            />}
                            {!isView && <CustomButton
                                variant="primary"
                                text={t("CMS.common.publish")}
                                disabled={saveDisabled}
                                loading={saveLoading}
                                onClick={() => setPublishVisible(true)}
                                permissionCode={PERMISSION_CODES.cms.pages.homepage.publish}
                                permissionRoutePath="/cms/pageManagement/PageManagementHome"
                            />}
                        </>
                    }
                />

            {/* Approve Modal */}
            <ApproveModal
                visible={approveModalVisible}
                id={Number(id)}
                onCancel={() => setApproveModalVisible(false)}
                refresh={getPageDetail}
            />
            {/* Reject Modal */}
            <RejectModal
                visible={rejectModalVisible}
                id={Number(id)}
                oncancel={() => setRejectModalVisible(false)}
                refresh={getPageDetail}
            />
            {/* review modal */}
            <ConfirmModal
                visible={reviewVisible}
                title={t("CMS.modals.submitForReview.title")}
                content={t("CMS.modals.submitForReview.content")}
                onCancel={() => setReviewVisible(false)}
                onConfirm={() => handleSave(50)}
            />
            {/* publish modal */}
            <ConfirmModal
                visible={publishVisible}
                title={t("CMS.modals.publishPage.title")}
                content={t("CMS.modals.publishPage.content")}
                onCancel={() => setPublishVisible(false)}
                onConfirm={() => handleSave(100)}
            />
            {/* leave modal */}
            <ConfirmModal
                visible={leaveVisible}
                type="danger"
                title={t("CMS.modals.leavePage.title")}
                content={t("CMS.modals.leavePage.content")}
                confirmText={t("CMS.modals.leavePage.leave")}
                onCancel={() => setLeaveVisible(false)}
                onConfirm={goBackToList}
            />
        </div>
    )
};

export default PageManagementHome;
