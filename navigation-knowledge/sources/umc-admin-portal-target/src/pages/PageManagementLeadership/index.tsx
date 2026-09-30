import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { CustomButton, CustomMessage, CustomFooter, ConfirmModal } from "@/components/common";
import type { ChairmanParam, DirectorParam, ManagementParam } from "@/services/cms";
import { getPageById, leadershipConfig } from "@/services/cms";
import PreviewContainer from "./components/PreviewContainer";
import ChairmanForm from "./components/ChairmanForm";
import DirectorsForm from "./components/DirectorsForm";
import TeamForm from "./components/TeamForm";
import RejectModal from "../PageManagement/components/RejectModal";
import ApproveModal from "../PageManagement/components/ApproveModal";
import { LEADERSHIP_PREVIEW_STORAGE_KEY } from "./previewStorage";
import ErrorIcon from "@/assets/images/error.svg";

import moment from "moment";
import { useTranslation } from "react-i18next";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import "./index.less";

interface MenuItem {
    title: string,
    key: number;
    emptyCount: number;
};

const PageManagementLeadership = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const history = useHistory();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get("id");
    const isView = searchParams.get("isView");
    const [crrent, setCrrent] = useState<number>(1);
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    const [chairmanData, setChairmanData] = useState<ChairmanParam>();
    const [directorsData, setDirectorsData] = useState<DirectorParam>();
    const [managementData, setManagementData] = useState<ManagementParam>();

    const [chairmanEmpty, setChairmanEmpty] = useState(0);
    const [directorsEmpty, setDirectorsEmpty] = useState(0);
    const [managementEmpty, setManagementEmpty] = useState(0);

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
            updateBy: "admin",
            updateTime: '',
            reason: ''
        });
    const menuList: MenuItem[] = [
        { title: t("CMS.pageManagementLeadership.modules.chairman"), key: 1, emptyCount: chairmanEmpty },
        { title: t("CMS.pageManagementLeadership.modules.boardOfDirectors"), key: 2, emptyCount: directorsEmpty },
        { title: t("CMS.pageManagementLeadership.modules.management"), key: 3, emptyCount: managementEmpty }
    ];
    const [lan, setLan] = useState<string>("en");
    useEffect(() => {
        getPageDetail();
    }, []);
    const i18nText = () => ({ en: "", ar: "" });
    const emptyTeamMember = () => ({
        image: "", isOpen: false,
        fullName: i18nText(), positionDescription: i18nText(),
        quote: i18nText(), profile: i18nText()
    });
    const normalizeConfig = (data: any) => {
        const chairman = data.chairman || {
            image: "", position: i18nText(), fullName: i18nText(), positionDescription: i18nText()
        };
        const directors = data.boardOfDirectors || { title: i18nText(), members: [] };
        if (!directors.members?.length) {
            directors.members = [{ image: "", isOpen: false, fullName: i18nText(), positionDescription: i18nText() }];
        }
        const management = data.management || { title: i18nText() };
        if (!management.memberOne) management.memberOne = emptyTeamMember();
        if (!management.memberTwo) management.memberTwo = emptyTeamMember();
        return { chairman, directors, management };
    };
    const getPageDetail = () => {
        hydratingRef.current = true;
        if (!id) {
            const defaults = normalizeConfig({});
            setChairmanData(defaults.chairman as ChairmanParam);
            setDirectorsData(defaults.directors as DirectorParam);
            setManagementData(defaults.management as ManagementParam);
            setTimeout(() => { hydratingRef.current = false; }, 0);
            return;
        }
        getPageById(id).then((res) => {
            const data = res.data.config
            const normalized = normalizeConfig(data);
            setChairmanData(normalized.chairman as ChairmanParam);
            setDirectorsData(normalized.directors as DirectorParam);
            setManagementData(normalized.management as ManagementParam);
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
    useEffect(() => {
        if (hydratingRef.current) return;
        setIsEdit(true);
    }, [chairmanData, directorsData, managementData]);
    // methods
    // lang selects which locale of the bilingual field to write (PRD: the
    // form shows English and Arabic inputs side by side, no syncing).
    const chairmanInputChange = (value: string, key: string, lang: 'en' | 'ar') => {
        const chairman = {...chairmanData};
        chairman[key][lang] = value;
        setChairmanData(chairman as ChairmanParam);
    };

    const addMember = () => {
        // PRD: up to 8 board members
        if ((directorsData?.members?.length || 0) >= 8) return;
        const member = {
            image: "",
            isOpen: false,
            fullName: {
                en: "",
                ar: ""
            },
            positionDescription: {
                en: "",
                ar: ""
            }
        };
        const members = [...directorsData?.members || []];
        members.push(member);
        setDirectorsData({...directorsData, members} as DirectorParam);
    };
    const deleteMember = (index: number) => {
        const members = [...directorsData?.members || []];
        members.splice(index, 1);
        setDirectorsData({...directorsData, members} as DirectorParam);
    };
    const directorInputChange = (value: string, key: string, lang: 'en' | 'ar', index?: number) => {
        if (index || index === 0) {
            const members = [...directorsData?.members || []];
            members[index][key][lang] = value;
            setDirectorsData({...directorsData, members} as DirectorParam);
        } else {
            const director = {...directorsData};
            director.title[lang] = value;
            setDirectorsData(director as DirectorParam);
        }
    };

    const managementInputChange = (value: string, key: string, lang: 'en' | 'ar', index?: number) => {
        if (!index) {
            const management = {...managementData};
            management.title[lang] = value;
            setManagementData(management as ManagementParam);
        } else if (index === 1) {
            const member = {...managementData?.memberOne || {}};
            member[key][lang] = value;
            setManagementData({...managementData, memberOne: member} as ManagementParam);
        } else if (index === 2) {
            const member = {...managementData?.memberTwo || {}};
            member[key][lang] = value;
            setManagementData({...managementData, memberTwo: member} as ManagementParam);
        }
    };
    // valid
    const isChairmanParamValid = useCallback(() => {
        if (!chairmanData) return false;
        
        let emptyCount = 0;
        if (!chairmanData.image?.trim()) emptyCount += 1;
        if (!chairmanData.position?.en) emptyCount += 1;
        if (!chairmanData.position?.ar) emptyCount += 1;
        if (!chairmanData.fullName?.en) emptyCount += 1;
        if (!chairmanData.fullName?.ar) emptyCount += 1;
        if (!chairmanData.positionDescription?.en) emptyCount += 1;
        if (!chairmanData.positionDescription?.ar) emptyCount += 1;

        setChairmanEmpty(emptyCount);
    }, [chairmanData]);

    const isDirectorsDataValid = useCallback(() => {
        if (!directorsData) return false;

        let emptyCount = 0;
        if (!directorsData.title?.en) emptyCount += 1;
        if (!directorsData.title?.ar) emptyCount += 1;

        if (directorsData.members) {
            for(const director of directorsData.members) {
                if (!director.image?.trim()) emptyCount += 1;
                if (!director.fullName?.en) emptyCount += 1;
                if (!director.fullName?.ar) emptyCount += 1;
                if (!director.positionDescription?.en) emptyCount += 1;
                if (!director.positionDescription?.ar) emptyCount += 1;
            }
        }

        setDirectorsEmpty(emptyCount);
    }, [directorsData]);

    const isManagementDataValid = useCallback(() => {
        if (!managementData) return false;
        
        let emptyCount = 0;
        if (!managementData.title?.en) emptyCount += 1;
        if (!managementData.title?.ar) emptyCount += 1;

        // Member 1 (with Quote per PRD)
        if (!managementData.memberOne?.image?.trim()) emptyCount += 1;
        if (!managementData.memberOne?.fullName?.en) emptyCount += 1;
        if (!managementData.memberOne?.fullName?.ar) emptyCount += 1;
        if (!managementData.memberOne?.positionDescription?.en) emptyCount += 1;
        if (!managementData.memberOne?.positionDescription?.ar) emptyCount += 1;
        if (!managementData.memberOne?.quote?.en) emptyCount += 1;
        if (!managementData.memberOne?.quote?.ar) emptyCount += 1;
        if (!managementData.memberOne?.profile?.en) emptyCount += 1;
        if (!managementData.memberOne?.profile?.ar) emptyCount += 1;

        // Member 2 (no Quote field per PRD)
        if (!managementData.memberTwo?.image?.trim()) emptyCount += 1;
        if (!managementData.memberTwo?.fullName?.en) emptyCount += 1;
        if (!managementData.memberTwo?.fullName?.ar) emptyCount += 1;
        if (!managementData.memberTwo?.positionDescription?.en) emptyCount += 1;
        if (!managementData.memberTwo?.positionDescription?.ar) emptyCount += 1;
        if (!managementData.memberTwo?.profile?.en) emptyCount += 1;
        if (!managementData.memberTwo?.profile?.ar) emptyCount += 1;

        setManagementEmpty(emptyCount);
    }, [managementData]);
    
    useEffect(() => {
        isChairmanParamValid();
    }, [chairmanData, isChairmanParamValid]);

    useEffect(() => {
        isDirectorsDataValid();
    }, [directorsData, isDirectorsDataValid]);

    useEffect(() => {
        isManagementDataValid();
    }, [managementData, isManagementDataValid]);

    const saveDisabled = useMemo(() => {
        return chairmanEmpty > 0 || directorsEmpty > 0 || managementEmpty > 0;
    }, [chairmanEmpty, directorsEmpty, managementEmpty]);

    // Per PRD, Preview opens the whole Leadership page in a new window with
    // its own language and device toggles; the draft travels via sessionStorage.
    const openPreview = () => {
        sessionStorage.setItem(LEADERSHIP_PREVIEW_STORAGE_KEY, JSON.stringify({
            chairmanData,
            directorsData,
            managementData,
            lan
        }));
        window.open('/cms/pageManagement/PageManagementLeadership/preview', '_blank');
    };

    //save
    const saveHanld = (status: number) => {
        setReviewVisible(false);
        setPublishVisible(false);
        const param = {
            chairman: chairmanData as ChairmanParam,
            boardOfDirectors: directorsData as DirectorParam,
            management: managementData as ManagementParam,
            auditStatus: status,
            isDraft: status == 0
        };
        setSaveLoading(true);
        leadershipConfig(param).then(() => {
            CustomMessage.success(t("CMS.common.operationSuccessful"));
            setSaveLoading(false);
            if (status == 100) { // Direct publish: skip review, go live immediately
                history.push('/cms/pageManagement?tab=1');
            } else if (status == 50) {
                history.goBack()
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
                                        className={`menu-item ${item.key == crrent && "menu-item-active"}`}
                                        onClick={() => setCrrent(item.key)}
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
                            <div className="msg-value">{reviewData.updateBy}</div>
                        </div>
                        <div className="update-msg">
                            <div className="msg-label">{t("CMS.common.lastUpdated")}</div>
                            <div className="msg-value">{moment(reviewData.updateTime).format('DD/MM/YYYY HH:mm:ss')}</div>
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
                        crrent={crrent}
                        lan={lan}
                        mode={reviewData.status == 50 || isView ? "view" : "default"}
                        chairmanData={chairmanData as ChairmanParam}
                        directorData={directorsData as DirectorParam}
                        managementData={managementData as ManagementParam}
                        isReject={reviewData.status == 10}
                        selcetArea={(val) => setCrrent(val)}
                    />
                </div>
                {/* form */}
                {(reviewData.status != 50 && !isView) &&
                <div className={`cms-form ${reviewData.status == 10 && 'reject-form'}`}>
                    {(() => {
                        switch (crrent) {
                            case 1:
                            return <ChairmanForm 
                                chairmanParam={chairmanData as ChairmanParam}
                                chairmanInputChange={chairmanInputChange}
                                changeChairman={(val) => setChairmanData(val)}
                            />
                            case 2:
                            return <DirectorsForm
                                directorParam={directorsData as DirectorParam}
                                directorInputChange={directorInputChange}
                                deleteMember={deleteMember}
                                addMember={addMember}
                                changeDirectorParam={(val) => setDirectorsData(val)}
                            />
                            case 3:
                            return <TeamForm 
                                data={managementData as ManagementParam}
                                changeManagement={(val) => setManagementData(val)}
                                managementInputChange={managementInputChange}
                            />
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
                            permissionCode="CMS.Pages.Leadership.Reject"
                            permissionRoutePath="/cms/pageManagement/PageManagementLeadership"
                        />
                        <CustomButton 
                            variant="primary"
                            text={t("CMS.common.approve")}
                            onClick={() => setApproveModalVisible(true)}
                            permissionCode="CMS.Pages.Leadership.Approve"
                            permissionRoutePath="/cms/pageManagement/PageManagementLeadership"
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
                            onClick={() => saveHanld(0)}
                            permissionCode="CMS.Pages.Leadership.SaveDraft"
                            permissionRoutePath="/cms/pageManagement/PageManagementLeadership"
                        />}
                        {!isView && <CustomButton
                            variant="primary"
                            text={t("CMS.common.saveAndSubmit")}
                            disabled={saveDisabled}
                            loading={saveLoading}
                            onClick={() => setReviewVisible(true)}
                            permissionCode={PERMISSION_CODES.cms.pages.leadership.saveAndSubmit}
                            permissionRoutePath="/cms/pageManagement/PageManagementLeadership"
                        />}
                        {!isView && <CustomButton
                            variant="primary"
                            text={t("CMS.common.publish")}
                            disabled={saveDisabled}
                            loading={saveLoading}
                            onClick={() => setPublishVisible(true)}
                            permissionCode={PERMISSION_CODES.cms.pages.leadership.publish}
                            permissionRoutePath="/cms/pageManagement/PageManagementLeadership"
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

export default PageManagementLeadership;
