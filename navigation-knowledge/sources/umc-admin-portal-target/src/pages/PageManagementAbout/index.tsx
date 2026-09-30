import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CustomButton, CustomMessage, CustomFooter, ConfirmModal } from "@/components/common";
import PreviewContainer from "./components/PreviewContainer";
import AboutForm from "./components/AboutForm";
import VisionForm from "./components/VisionForm";
import StrategicForm from "./components/StrategicForm";
import PartnerForm from "./components/PartnerForm";
import type {
    AboutPartnership,
    StrategicObjectives,
    VisionMissionValues,
    AboutFormParam
} from "@/services/cms";
import { aboutNmaConfig, getPageById } from "@/services/cms";
import { urlRegex } from "@/utils/validation";
import { ABOUT_PREVIEW_STORAGE_KEY } from "./previewStorage";
import { useLocation, useHistory } from "react-router-dom";
import RejectModal from "../PageManagement/components/RejectModal";
import ApproveModal from "../PageManagement/components/ApproveModal";
import ErrorIcon from "@/assets/images/error.svg";

import moment from "moment";
import { useTranslation } from "react-i18next";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import "./index.less";

interface MenuItem {
    title: string;
    key: number;
    emptyCount: number;
}

const PageManagementAbout = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const history = useHistory();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get("id");
    const isView = searchParams.get("isView");
    const [lan, setLan] = useState("en");
    const [crrentMenu, setCrrentMenu] = useState(1);
    const [loading, setLoading] = useState(false);

    const [partnerParam, setPartnerParam] = useState<AboutPartnership>();
    const [aboutParam, setAboutParam] = useState<AboutFormParam>();
    const [visionParam, setVisionParam] = useState<VisionMissionValues>();
    const [strategicParam, setStrategicParam] = useState<StrategicObjectives>();
    const [partnerEmpty, setPartnerEmpty] = useState(0);
    const [aboutEmpty, setAboutEmpty] = useState(0);
    const [visionEmpty, setVisionEmpty] = useState(0);
    const [strategicEmpty, setStrategicEmpty] = useState(0);

    const [approveModalVisible, setApproveModalVisible] = useState<boolean>(false);
    const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
    const [reviewVisible, setReviewVisible] = useState<boolean>(false);
    const [publishVisible, setPublishVisible] = useState<boolean>(false);
    const [leaveVisible, setLeaveVisible] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    // Guards the params-changed effect so hydration does not flag isEdit
    const hydratingRef = useRef(false);
    const [reviewData, setReviewData] = useState<{
        status: number,
        updateBy: string,
        updateTime: string,
        reason: string
    }>({
        status: 0,
        updateBy: "",
        updateTime: '',
        reason: ''
    });
    const menuList: MenuItem[] = [
        { title: t("CMS.pageManagementAbout.modules.aboutUs"), key: 1, emptyCount: aboutEmpty },
        { title: t("CMS.pageManagementAbout.modules.visionMissionValues"), key: 2, emptyCount: visionEmpty },
        { title: t("CMS.pageManagementAbout.modules.strategicObjectives"), key: 3, emptyCount: strategicEmpty },
        { title: t("CMS.pageManagementAbout.modules.partners"), key: 4, emptyCount: partnerEmpty }
    ];
    useEffect(() => {
        if (hydratingRef.current) return;
        setIsEdit(true);
    }, [aboutParam, partnerParam, strategicParam, visionParam]);
    useEffect(() => {
        getPageDetail();
    }, []);
    const i18nText = () => ({ en: "", ar: "" });
    // PRD fixed-size structures: 4 responsibilities, 4 values, 3 images,
    // 6 strategies, and at least 5 partners (delete disabled at 5).
    const normalizeConfig = (data: any) => {
        const about = data.about || { image: "", title: i18nText(), description: i18nText(), responsibilities: [] };
        if (!about.responsibilities?.length) {
            about.responsibilities = Array.from({ length: 4 }, () => ({ isOpen: false, title: i18nText(), description: i18nText() }));
        } else {
            about.responsibilities = about.responsibilities.map((item: any) => ({ ...item, isOpen: false }));
        }
        const vision = data.visionMissionValues || {
            image: "",
            vision: { title: i18nText(), description: i18nText() },
            mission: { title: i18nText(), description: i18nText() },
            values: []
        };
        if (!vision.values?.length) {
            vision.values = Array.from({ length: 4 }, () => ({ isOpen: false, title: i18nText(), description: i18nText() }));
        }
        const strategic = data.strategicObjectives || { title: i18nText(), description: i18nText(), images: [], strategies: [] };
        if (!strategic.images?.length) {
            strategic.images = Array.from({ length: 3 }, () => "");
        }
        if (!strategic.strategies?.length) {
            strategic.strategies = Array.from({ length: 6 }, () => i18nText());
        }
        const partnership = data.aboutPartnership || { title: i18nText(), partners: [] };
        if (typeof partnership.title === 'string') {
            partnership.title = { en: partnership.title, ar: '' };
        } else if (!partnership.title) {
            partnership.title = i18nText();
        }
        const partners = [...(partnership.partners || [])];
        while (partners.length < 5) partners.push({ logo: "", link: "" });
        partnership.partners = partners;
        return { about, vision, strategic, partnership };
    };
    const getPageDetail = () => {
        hydratingRef.current = true;
        if (!id) {
            const defaults = normalizeConfig({});
            setAboutParam(defaults.about as AboutFormParam);
            setVisionParam(defaults.vision as VisionMissionValues);
            setStrategicParam(defaults.strategic as StrategicObjectives);
            setPartnerParam(defaults.partnership as AboutPartnership);
            setTimeout(() => { hydratingRef.current = false; }, 0);
            return;
        }
        getPageById(id).then((res: any) => {
            const data = res.data.config
            const normalized = normalizeConfig(data);
            setVisionParam(normalized.vision as VisionMissionValues);
            setAboutParam(normalized.about as AboutFormParam);
            setPartnerParam(normalized.partnership as AboutPartnership);
            setStrategicParam(normalized.strategic as StrategicObjectives);
            setReviewData({
                status: res.data.status,
                updateBy: res.data.updateUserInfo?.name,
                updateTime: res.data.updateTime,
                reason: res.data.reason
            })
            setIsEdit(false);
            setTimeout(() => { hydratingRef.current = false; }, 0);
        });
    };

    // lang selects which locale of the bilingual field to write (PRD: the
    // form shows English and Arabic inputs side by side, no syncing).
    const aboutInputChange = (value: string, key: string, lang: 'en' | 'ar', index?: number) => {
        if (index || index === 0) {
            const responsibilities: any = [...aboutParam?.responsibilities || []];
            responsibilities[index][key][lang] = value;
            setAboutParam({ ...aboutParam, responsibilities } as AboutFormParam);
        } else {
            const param: any = { ...aboutParam };
            param[key][lang] = value;
            setAboutParam(param as AboutFormParam);
        }
    };

    const visionInputChange = (value: string, key: string, secKey: string, lang: 'en' | 'ar', index?: number) => {
        if (index || index === 0) {
            const values: any = [...visionParam?.values || []];
            values[index][secKey][lang] = value;
            setVisionParam({ ...visionParam, values } as VisionMissionValues);
        } else {
            const param: any = { ...visionParam };
            param[key][secKey][lang] = value;
            setVisionParam(param as VisionMissionValues);
        }
    };

    const strategicInputChange = (value: string, key: string, lang: 'en' | 'ar', index?: number) => {
        if (index || index === 0) {
            const strategies = [...strategicParam?.strategies || []];
            strategies[index][lang] = value;
            setStrategicParam({ ...strategicParam, strategies } as StrategicObjectives);
        } else {
            const param: any = { ...strategicParam };
            param[key][lang] = value;
            setStrategicParam(param as StrategicObjectives);
        }
    };

    const partnerInputChange = (value: string, key: string, lang?: 'en' | 'ar', index?: number) => {
        if (typeof index === 'number') {
            const partners = [...partnerParam?.partners || []];
            partners[index].link = value;
            setPartnerParam({ ...partnerParam, partners } as AboutPartnership);
        } else if (lang) {
            const param: any = { ...partnerParam };
            param[key][lang] = value;
            setPartnerParam(param as AboutPartnership);
        }
    };
    const addPartner = () => {
        if (partnerParam?.partners?.length && partnerParam?.partners?.length >= 10) return;
        const partners = [...partnerParam?.partners || []];
        partners.push({ link: "", logo: "" });
        setPartnerParam({ ...partnerParam, partners } as AboutPartnership);
    };
    const deletePartner = (index: number) => {
        const partners = [...partnerParam?.partners || []];
        if (partners.length <= 5) return;
        partners.splice(index, 1);
        setPartnerParam({ ...partnerParam, partners } as AboutPartnership);
    };
    // valid
    const isPartnerParamValid = useCallback(() => {
        if (!partnerParam) return false;

        let emptyCount = 0;
        if (partnerParam.partners) {
            for (const item of partnerParam.partners) {
                if (!item.logo || item.logo.trim() === '') {
                    emptyCount += 1;
                }
                if (!item.link || item.link.trim() == '' || !urlRegex.test(item.link)) {
                    emptyCount += 1;
                }
            }
        }

        if (!partnerParam.title?.en) emptyCount += 1;
        if (!partnerParam.title?.ar) emptyCount += 1;

        setPartnerEmpty(emptyCount);
    }, [partnerParam]);

    const isAboutParamValid = useCallback(() => {
        if (!aboutParam) return false;

        let emptyCount = 0;
        if (!aboutParam.image) {
            emptyCount += 1;
        }

        if (aboutParam.responsibilities) {
            for (const item of aboutParam.responsibilities) {
                if (!item.title?.en) emptyCount += 1;
                if (!item.title?.ar) emptyCount += 1;
                if (!item.description?.en) emptyCount += 1;
                if (!item.description?.ar) emptyCount += 1;
            }
        }

        if (!aboutParam.title?.en) emptyCount += 1;
        if (!aboutParam.title?.ar) emptyCount += 1;
        if (!aboutParam.description?.en) emptyCount += 1;
        if (!aboutParam.description?.ar) emptyCount += 1;

        setAboutEmpty(emptyCount);
    }, [aboutParam]);

    const isVisionParamValid = useCallback(() => {
        if (!visionParam) return false;

        let emptyCount = 0;
        // Check if image is valid
        if (!visionParam.image || visionParam.image.trim() === '') {
            emptyCount += 1;
        }

        if (!visionParam.vision?.title?.en) emptyCount += 1;
        if (!visionParam.vision?.title?.ar) emptyCount += 1;
        if (!visionParam.vision?.description?.en) emptyCount += 1;
        if (!visionParam.vision?.description?.ar) emptyCount += 1;

        if (!visionParam.mission?.title?.en) emptyCount += 1;
        if (!visionParam.mission?.title?.ar) emptyCount += 1;
        if (!visionParam.mission?.description?.en) emptyCount += 1;
        if (!visionParam.mission?.description?.ar) emptyCount += 1;

        if (visionParam.values) {
            for (const item of visionParam.values) {
                if (!item.title?.en) emptyCount += 1;
                if (!item.title?.ar) emptyCount += 1;
                if (!item.description?.en) emptyCount += 1;
                if (!item.description?.ar) emptyCount += 1;
            }
        }

        setVisionEmpty(emptyCount);
    }, [visionParam]);

    const isStrategicParamValid = useCallback(() => {
        if (!strategicParam) return false;

        let emptyCount = 0;
        if (!strategicParam.title?.en) emptyCount += 1;
        if (!strategicParam.title?.ar) emptyCount += 1;
        if (!strategicParam.description?.en) emptyCount += 1;
        if (!strategicParam.description?.ar) emptyCount += 1;

        if (strategicParam.images) {
            const count = strategicParam.images.filter((item) => !item || item.trim() === '').length;
            emptyCount += count;
        }

        if (strategicParam.strategies) {
            for (const item of strategicParam.strategies) {
                if (!item.en?.trim()) emptyCount += 1;
                if (!item.ar?.trim()) emptyCount += 1;
            }
        }

        setStrategicEmpty(emptyCount);
    }, [strategicParam]);

    useEffect(() => {
        isStrategicParamValid();
    }, [strategicParam, isStrategicParamValid]);

    useEffect(() => {
        isVisionParamValid();
    }, [visionParam, isVisionParamValid]);

    useEffect(() => {
        isAboutParamValid();
    }, [aboutParam, isAboutParamValid]);

    useEffect(() => {
        isPartnerParamValid();
    }, [partnerParam, isPartnerParamValid]);

    const saveDisabled = useMemo(() => {
        return aboutEmpty > 0 || strategicEmpty > 0 || visionEmpty > 0 || partnerEmpty > 0;
    }, [aboutEmpty, strategicEmpty, visionEmpty, partnerEmpty]);

    const formatReviewUpdateTime = (value?: string) => {
        if (!value) return "-";
        const time = moment(value);
        return time.isValid() ? time.format('DD/MM/YYYY HH:mm') : "-";
    };

    // Per PRD, Preview opens the whole About NMA page in a new window with
    // its own language and device toggles; the draft travels via sessionStorage.
    const openPreview = () => {
        sessionStorage.setItem(ABOUT_PREVIEW_STORAGE_KEY, JSON.stringify({
            aboutParam,
            visionParam,
            strategicParam,
            partnerParam,
            lan
        }));
        window.open('/cms/pageManagement/PageManagementAbout/preview', '_blank');
    };

    //save
    const saveHanld = (status: number) => {
        setReviewVisible(false);
        setPublishVisible(false);
        const param = {
            about: aboutParam as AboutFormParam,
            strategicObjectives: strategicParam as StrategicObjectives,
            visionMissionValues: visionParam as VisionMissionValues,
            aboutPartnership: partnerParam as AboutPartnership,
            auditStatus: status,
            isDraft: status == 0
        };
        setLoading(true);
        aboutNmaConfig(param).then(() => {
            CustomMessage.success(t("CMS.common.operationSuccessful"));
            setLoading(false);
            if (status == 100) { // Direct publish: skip review, go live immediately
                history.push('/cms/pageManagement?tab=1');
            } else if (status == 50) { // Submit for review
                history.goBack()
            } else { // Save as draft
                setIsEdit(false);
            }
        }).finally(() => {
            setLoading(false);
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
                                menuList.map((item) => {
                                    return (<div
                                        key={item.key}
                                        className={`menu-item ${crrentMenu == item.key && "menu-item-active"}`}
                                        onClick={() => setCrrentMenu(item.key)}
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
                                <div className="msg-value">{reviewData.updateBy || "-"}</div>
                            </div>
                            <div className="update-msg">
                                <div className="msg-label">{t("CMS.pageManagementAbout.header.lastUpdated")}</div>
                                <div className="msg-value">{formatReviewUpdateTime(reviewData.updateTime)}</div>
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
                            mode={reviewData.status == 50 || isView ? "view" : "default"}
                            aboutData={aboutParam as AboutFormParam}
                            visionMissionData={visionParam as VisionMissionValues}
                            strategicData={strategicParam as StrategicObjectives}
                            partnershipData={partnerParam as AboutPartnership}
                            isReject={reviewData.status == 10}
                            selectArea={(val) => setCrrentMenu(val)}
                        />
                    </div>
                    {/* form */}
                    {(reviewData.status !== 50 && !isView) &&
                        <div className={`cms-form ${reviewData.status == 10 && 'reject-form'}`}>
                            {(() => {
                                switch (crrentMenu) {
                                    case 1:
                                        return (
                                            <AboutForm
                                                aboutParam={aboutParam as AboutFormParam}
                                                aboutInputChange={aboutInputChange}
                                                changeAboutParam={(val) => setAboutParam(val)}
                                            />)
                                    case 2:
                                        return (
                                            <VisionForm
                                                visionParam={visionParam as VisionMissionValues}
                                                visionInputChange={visionInputChange}
                                                changeVisionParam={(val) => setVisionParam(val)}
                                            />)
                                    case 3:
                                        return (
                                            <StrategicForm
                                                strategicParam={strategicParam as StrategicObjectives}
                                                strategicInputChange={strategicInputChange}
                                                changeStrategic={(val) => setStrategicParam(val)}
                                            />)
                                    case 4:
                                        return (
                                            <PartnerForm
                                                partnerParam={partnerParam as AboutPartnership}
                                                partnerInputChange={partnerInputChange}
                                                addPartner={addPartner}
                                                deletePartner={deletePartner}
                                                changePartnerParam={(val) => setPartnerParam(val)}
                                            />)
                                }
                            })()}
                        </div>}
            </div>

            <CustomFooter
                onBack={() => {
                    if (reviewData.status == 50 || isView || !isEdit) {
                        history.goBack()
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
                                permissionCode="CMS.Pages.AboutNMA.Reject"
                                permissionRoutePath="/cms/pageManagement/PageManagementAbout"
                            />
                            <CustomButton
                                variant="primary"
                                text={t("CMS.common.approve")}
                                onClick={() => setApproveModalVisible(true)}
                                permissionCode="CMS.Pages.AboutNMA.Approve"
                                permissionRoutePath="/cms/pageManagement/PageManagementAbout"
                            />
                        </> :
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
                                loading={loading}
                                onClick={() => saveHanld(0)}
                                permissionCode="CMS.Pages.AboutNMA.SaveDraft"
                                permissionRoutePath="/cms/pageManagement/PageManagementAbout"
                            />}
                            {!isView && <CustomButton
                                variant="primary"
                                onClick={() => setReviewVisible(true)}
                                loading={loading}
                                disabled={saveDisabled}
                                text={t("CMS.common.saveAndSubmit")}
                                permissionCode={PERMISSION_CODES.cms.pages.aboutNma.saveAndSubmit}
                                permissionRoutePath="/cms/pageManagement/PageManagementAbout"
                            />}
                            {!isView && <CustomButton
                                variant="primary"
                                onClick={() => setPublishVisible(true)}
                                loading={loading}
                                disabled={saveDisabled}
                                text={t("CMS.common.publish")}
                                permissionCode={PERMISSION_CODES.cms.pages.aboutNma.publish}
                                permissionRoutePath="/cms/pageManagement/PageManagementAbout"
                            />}
                        </>
                }
            />
            {/* Approve Modal */}
            <ApproveModal
                visible={approveModalVisible}
                id={Number(id)}
                onCancel={() => setApproveModalVisible(false)}
                refresh={() => history.goBack()}
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
                onConfirm={() => saveHanld(50)}
            />
            {/* publish modal */}
            <ConfirmModal
                visible={publishVisible}
                title={t("CMS.modals.publishPage.title")}
                content={t("CMS.modals.publishPage.content")}
                onCancel={() => setPublishVisible(false)}
                onConfirm={() => saveHanld(100)}
            />
            {/* leave modal */}
            <ConfirmModal
                visible={leaveVisible}
                type="danger"
                title={t("CMS.modals.leavePage.title")}
                content={t("CMS.modals.leavePage.content")}
                confirmText={t("CMS.modals.leavePage.leave")}
                onCancel={() => setLeaveVisible(false)}
                onConfirm={() => history.goBack()}
            />
        </div>
    )
};

export default PageManagementAbout;
