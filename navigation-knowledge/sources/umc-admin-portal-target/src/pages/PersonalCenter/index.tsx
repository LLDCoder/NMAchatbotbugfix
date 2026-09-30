import { useUserStore } from "@/store/user";
import './index.less'
import { Form, Input, Select } from "antd";
import {
    createMobileNumberFormRule,
    DEFAULT_COUNTRY_DIAL_CODE,
    FormMobileNumberInput,
} from "@/components/common/MobileNumberInput";
import { ConfirmModal, CustomButton, CustomFooter, CustomMessage } from "@/components/common";
import { useCallback, useEffect, useRef, useState } from "react";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { getAreaList, getEmirateList, getRegionList, postUpdateAdminUserCenterAsync, type AreaInfoResponse, type EmirateInfoResponse, type IGetAdminUserAsyncResposne, type RegionInfoResponse } from "@/services/userManagement";
import {
    invalidateCurrentAdminUser,
    loadCurrentAdminUser,
} from "@/store/currentAdminUser";
import ChangePassword from "@/pages/ChangePassword";
import {
    getChangePasswordVerificationKey,
    useChangePasswordVerificationStore,
} from "@/store/change-password-verification-store";
import Avatar from './components/Avatar';
import {
    PERSONAL_CENTER_EMPTY_VALUE,
    getResolvedNameLabels,
} from "./display";
import {
    buildContactNumberFields,
    createContactNumberSnapshot,
    getContactNumberDisplay,
    readContactFormValue,
    toContactFormValue,
} from "@/components/common/MobileNumberInput";

const CHANGE_PASSWORD_VERIFICATION_SESSION_MS = 5 * 60 * 1000;
type LocationId = number | null | undefined;
const personalMobileFieldNames = {
    countryCode: "mobileCountryCode",
    phoneNumber: "mobileLocalNumber",
};

function createPersonalMobileSnapshot(data: {
    countryCode?: unknown;
    localNumber?: unknown;
    fullNumber?: unknown;
}) {
    const countryCode = String(data.countryCode ?? '').trim();
    const localNumber = String(data.localNumber ?? '').trim();
    const fullNumber = String(data.fullNumber ?? '').trim();

    return createContactNumberSnapshot({
        countryCode:
            !countryCode && !localNumber && !fullNumber
                ? DEFAULT_COUNTRY_DIAL_CODE
                : countryCode,
        localNumber,
        fullNumber,
    });
}

function ReadonlyMobileNumber({ display }: { display: string }) {
    return <div className="readonly-field-value">{display || '-'}</div>;
}

function formatLastLoginTime(value: unknown) {
    if (!value) {
        return PERSONAL_CENTER_EMPTY_VALUE;
    }

    const parsed = moment(value as moment.MomentInput);

    return parsed.isValid()
        ? parsed.format("HH:mm:ss DD/MM/YYYY")
        : PERSONAL_CENTER_EMPTY_VALUE;
}

interface PersonalCenterEditableValues {
    mobileNumber?: Record<string, unknown>;
    emirateId?: LocationId;
    regionId?: LocationId;
    areaId?: LocationId;
    street?: string;
}

interface PersonalCenterEditableSnapshot {
    mobileNumber: string;
    mobileCountryCode: string;
    mobileLocalNumber: string;
    emirateId: number | null;
    regionId: number | null;
    areaId: number | null;
    street: string;
    personalPhotoUrl: string;
}

function getEditableValues(
    data: IGetAdminUserAsyncResposne,
    mobileSnapshot: ReturnType<typeof createContactNumberSnapshot>,
): PersonalCenterEditableValues {
    return {
        mobileNumber: toContactFormValue(
            mobileSnapshot,
            personalMobileFieldNames,
        ),
        emirateId: data.emirateId,
        regionId: data.regionId,
        areaId: data.areaId,
        street: data.street,
    };
}

function createEditableSnapshot(
    values: PersonalCenterEditableValues,
    personalPhotoUrl: string | null | undefined,
    initialMobileSnapshot: ReturnType<typeof createContactNumberSnapshot>,
): PersonalCenterEditableSnapshot {
    const personalMobileFields = buildContactNumberFields({
        value: readContactFormValue(
            values.mobileNumber,
            personalMobileFieldNames,
        ),
        initial: initialMobileSnapshot,
        keys: {
            fullNumber: "mobileNumber",
            countryCode: "mobileCountryCode",
            localNumber: "mobileLocalNumber",
        },
    });

    return {
        mobileNumber: personalMobileFields.mobileNumber,
        mobileCountryCode: personalMobileFields.mobileCountryCode,
        mobileLocalNumber: personalMobileFields.mobileLocalNumber,
        emirateId: values.emirateId ?? null,
        regionId: values.regionId ?? null,
        areaId: values.areaId ?? null,
        street: typeof values.street === 'string' ? values.street : '',
        personalPhotoUrl: personalPhotoUrl || '',
    };
}

function createComparisonSnapshot(
    values: PersonalCenterEditableValues,
    personalPhotoUrl?: string | null,
): PersonalCenterEditableSnapshot {
    const mobileValue = readContactFormValue(
        values.mobileNumber,
        personalMobileFieldNames,
    );

    return {
        mobileNumber: '',
        mobileCountryCode: mobileValue.countryCode,
        mobileLocalNumber: mobileValue.phoneNumber,
        emirateId: values.emirateId ?? null,
        regionId: values.regionId ?? null,
        areaId: values.areaId ?? null,
        street: typeof values.street === 'string' ? values.street : '',
        personalPhotoUrl: personalPhotoUrl || '',
    };
}

function createNonPhoneUpdateSnapshot(
    values: PersonalCenterEditableValues,
    personalPhotoUrl: string,
    mobileSnapshot: ReturnType<typeof createContactNumberSnapshot>,
): PersonalCenterEditableSnapshot {
    const hasSplitNumber = mobileSnapshot.sourceMode === 'split';

    return {
        ...createComparisonSnapshot(values, personalPhotoUrl),
        mobileNumber: getContactNumberDisplay(mobileSnapshot),
        mobileCountryCode: hasSplitNumber
            ? mobileSnapshot.value.countryCode
            : '',
        mobileLocalNumber: hasSplitNumber
            ? mobileSnapshot.value.phoneNumber
            : '',
    };
}

function areSnapshotsEqual(
    current: PersonalCenterEditableSnapshot,
    baseline: PersonalCenterEditableSnapshot | null,
) {
    return baseline !== null &&
        current.mobileNumber === baseline.mobileNumber &&
        current.mobileCountryCode === baseline.mobileCountryCode &&
        current.mobileLocalNumber === baseline.mobileLocalNumber &&
        current.emirateId === baseline.emirateId &&
        current.regionId === baseline.regionId &&
        current.areaId === baseline.areaId &&
        current.street === baseline.street &&
        current.personalPhotoUrl === baseline.personalPhotoUrl;
}

export default function PersonalCenter() {
    const userInfo = useUserStore((state) => state.userInfo);
    const [form] = Form.useForm();
    const [info, setInfo] = useState<IGetAdminUserAsyncResposne>({} as IGetAdminUserAsyncResposne);
    const [currentPersonalPhotoUrl, setCurrentPersonalPhotoUrl] = useState("");
    const { i18n, t } = useTranslation();
    const [emirates, setEmirates] = useState<EmirateInfoResponse[]>([]);
    const [regions, setRegions] = useState<RegionInfoResponse[]>([]);
    const [areas, setAreas] = useState<AreaInfoResponse[]>([]);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [mode, setMode ] = useState('');
    const [profileLoading, setProfileLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const isMountedRef = useRef(true);
    const loadedLanguageRef = useRef<string | null>(null);
    const addressRequestSequenceRef = useRef(0);
    const savedSnapshotRef = useRef<PersonalCenterEditableSnapshot | null>(null);
    const personalMobileSnapshotRef = useRef(
        createPersonalMobileSnapshot({
            countryCode: "",
            localNumber: "",
            fullNumber: "",
        }),
    );
    const changePasswordVerificationKey = getChangePasswordVerificationKey(
        info?.email || userInfo?.email || '',
    );
    const changePasswordVerificationExpireAt =
        useChangePasswordVerificationStore(
            (state) => state.sessions[changePasswordVerificationKey] ?? null,
        );
    const startStoredChangePasswordVerificationSession =
        useChangePasswordVerificationStore((state) => state.startSession);
    const clearStoredChangePasswordVerificationSession =
        useChangePasswordVerificationStore((state) => state.clearSession);

    function getDisplayText(value?: string | null) {
        return value?.trim() ? value : '-';
    }

    function getLocationDisplayText(
        options: Array<{ id: number; nameEn: string; nameAr: string }>,
        id?: number | null,
        fallback?: string | null,
    ) {
        if (id === null || id === undefined) {
            return '-';
        }

        const matchedOption = options.find((item) => item.id === id);
        if (matchedOption) {
            return i18n.resolvedLanguage === 'en' ? matchedOption.nameEn : matchedOption.nameAr;
        }

        return getDisplayText(fallback);
    }

    const isLatestAddressRequest = useCallback((requestId: number) => {
        return isMountedRef.current && addressRequestSequenceRef.current === requestId;
    }, []);

    const syncAddressOptions = useCallback(async (
        emirateId?: LocationId,
        regionId?: LocationId,
    ) => {
        const requestId = addressRequestSequenceRef.current + 1;
        addressRequestSequenceRef.current = requestId;

        if (!emirateId) {
            if (!isLatestAddressRequest(requestId)) {
                return;
            }

            setRegions([]);
            setAreas([]);
            return;
        }

        try {
            const regionResponse = await getRegionList(emirateId);
            if (!isLatestAddressRequest(requestId)) {
                return;
            }

            const nextRegions = Array.isArray(regionResponse.data) ? regionResponse.data : [];
            setRegions(nextRegions);

            if (!regionId) {
                setAreas([]);
                return;
            }

            try {
                const areaResponse = await getAreaList(regionId);
                if (!isLatestAddressRequest(requestId)) {
                    return;
                }

                setAreas(Array.isArray(areaResponse.data) ? areaResponse.data : []);
            } catch (error) {
                if (!isLatestAddressRequest(requestId)) {
                    return;
                }

                console.error("Failed to load area options:", error);
                setAreas([]);
            }
        } catch (error) {
            if (!isLatestAddressRequest(requestId)) {
                return;
            }

            console.error("Failed to load region options:", error);
            setRegions([]);
            setAreas([]);
        }
    }, [isLatestAddressRequest]);

    const clearChangePasswordVerificationSession = useCallback(() => {
        clearStoredChangePasswordVerificationSession(
            changePasswordVerificationKey,
        );
    }, [
        changePasswordVerificationKey,
        clearStoredChangePasswordVerificationSession,
    ]);

    const startChangePasswordVerificationSession = useCallback(() => {
        startStoredChangePasswordVerificationSession(
            changePasswordVerificationKey,
            CHANGE_PASSWORD_VERIFICATION_SESSION_MS,
        );
    }, [
        changePasswordVerificationKey,
        startStoredChangePasswordVerificationSession,
    ]);

    const hasActiveChangePasswordVerificationSession =
        changePasswordVerificationExpireAt !== null &&
        changePasswordVerificationExpireAt > Date.now();

    const updateDirtyState = useCallback((
        values: PersonalCenterEditableValues,
        personalPhotoUrl: string,
    ) => {
        setIsDirty(
            !areSnapshotsEqual(
                createComparisonSnapshot(
                    values,
                    personalPhotoUrl,
                ),
                savedSnapshotRef.current,
            ),
        );
    }, []);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            addressRequestSequenceRef.current += 1;
        };
    }, []);

    useEffect(() => {
        if (!changePasswordVerificationExpireAt) {
            return;
        }

        const remainingMs = changePasswordVerificationExpireAt - Date.now();
        if (remainingMs <= 0) {
            clearChangePasswordVerificationSession();
            return;
        }

        const timer = window.setTimeout(() => {
            clearChangePasswordVerificationSession();
        }, remainingMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        changePasswordVerificationExpireAt,
        clearChangePasswordVerificationSession,
    ]);

    async function pullAdminUserAsync(){
        setProfileLoading(true);
        try {
            const data = await loadCurrentAdminUser(userInfo?.id || "");
            if(data){
                const mobileSnapshot = createPersonalMobileSnapshot({
                    countryCode: data.mobileCountryCode,
                    localNumber: data.mobileLocalNumber,
                    fullNumber: data.mobileNumber,
                });
                const editableValues = getEditableValues(data, mobileSnapshot);
                personalMobileSnapshotRef.current = mobileSnapshot;
                setInfo(data);
                setCurrentPersonalPhotoUrl(data.personalPhotoUrl || "");
                savedSnapshotRef.current = createComparisonSnapshot(
                    editableValues,
                    data.personalPhotoUrl,
                );
                setIsDirty(false);
                form.setFieldsValue({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    gender: data.gender,
                    emiratesId: data.emiratesId,
                    ...editableValues,
                    departmentIds: data.departmentIds,
                    assignRolesIds: data.assignRolesIds,
                    lastLoginTime: data.lastLoginTime ? moment(data.lastLoginTime) : undefined,
                });
                setProfileLoading(false);
                await syncAddressOptions(data.emirateId, data.regionId);
            }
        } catch (error) {
            console.error("Failed to load personal center data:", error);
        } finally {
            setProfileLoading(false);
        }
    }
    useEffect(()=>{
        if(userInfo?.id){
            // Department and role names come back already localized, so a language switch has to
            // drop the cached profile or the page keeps rendering the previous language.
            if(loadedLanguageRef.current && loadedLanguageRef.current !== i18n.language){
                invalidateCurrentAdminUser(userInfo.id);
            }
            loadedLanguageRef.current = i18n.language;
            pullAdminUserAsync();
        }
    },[userInfo?.id, i18n.language]);

    useEffect(()=>{
        const loadEmirateOptions = async () => {
            try {
                const emirateRes = await getEmirateList();

                if (!isMountedRef.current) {
                    return;
                }

                if (emirateRes.data) {
                    setEmirates(emirateRes.data);
                }
            } catch (error) {
                console.error("Failed to load emirate options:", error);
            }
        };

        void loadEmirateOptions();
    },[]);

    async function updateAdminUserCenter(
        snapshot: PersonalCenterEditableSnapshot,
    ){
        return postUpdateAdminUserCenterAsync({
            userId: info?.userId || "",
            ...snapshot,
        });
    }

    async function handleAvatarUploadSuccess(uploadedUrl: string) {
        const nextPersonalPhotoUrl = uploadedUrl || "";
        if (mode === 'edit') {
            setCurrentPersonalPhotoUrl(nextPersonalPhotoUrl);
            updateDirtyState(
                form.getFieldsValue(),
                nextPersonalPhotoUrl,
            );
            return;
        }

        const snapshot = createNonPhoneUpdateSnapshot(
            form.getFieldsValue(),
            nextPersonalPhotoUrl,
            personalMobileSnapshotRef.current,
        );
        setSaveLoading(true);
        try {
            const res = await updateAdminUserCenter(snapshot);
            if(res.data){
                savedSnapshotRef.current = createComparisonSnapshot(
                    form.getFieldsValue(),
                    nextPersonalPhotoUrl,
                );
                setIsDirty(false);
                invalidateCurrentAdminUser(userInfo?.id);
                await pullAdminUserAsync();
                CustomMessage.success(t('PersonalCenter.operationSuccessful'));
                return;
            }

            throw new Error("Update personal center avatar failed.");
        } catch (error) {
            console.error("Failed to update personal center avatar:", error);
            CustomMessage.error(t('PersonalCenter.operationFailed'));
            throw error;
        } finally {
            setSaveLoading(false);
        }
    }

    async function handleSave(){
        if (saveLoading) {
            return;
        }

        try {
            await form.validateFields(['mobileNumber']);
        } catch {
            return;
        }

        const snapshot = createEditableSnapshot(
            form.getFieldsValue(),
            currentPersonalPhotoUrl,
            personalMobileSnapshotRef.current,
        );

        const comparisonSnapshot = createComparisonSnapshot(
            form.getFieldsValue(),
            currentPersonalPhotoUrl,
        );

        if (areSnapshotsEqual(comparisonSnapshot, savedSnapshotRef.current)) {
            setIsDirty(false);
            return;
        }

        setSaveLoading(true);
        try {
            const res = await updateAdminUserCenter(snapshot);
            if(res.data){
                savedSnapshotRef.current = comparisonSnapshot;
                personalMobileSnapshotRef.current = createContactNumberSnapshot({
                    countryCode: snapshot.mobileCountryCode,
                    localNumber: snapshot.mobileLocalNumber,
                    fullNumber: snapshot.mobileNumber,
                });
                setIsDirty(false);
                invalidateCurrentAdminUser(userInfo?.id);
                await pullAdminUserAsync();
                setMode('');
                CustomMessage.success(t('PersonalCenter.operationSuccessful'));
                return;
            }

            CustomMessage.error(t('PersonalCenter.operationFailed'));
        } catch (error) {
            console.error("Failed to save personal center data:", error);
            CustomMessage.error(t('PersonalCenter.operationFailed'));
        } finally {
            setSaveLoading(false);
        }
    }

    function reset(){
        const mobileSnapshot = createContactNumberSnapshot({
            countryCode: info.mobileCountryCode,
            localNumber: info.mobileLocalNumber,
            fullNumber: info.mobileNumber,
        });
        const editableValues = getEditableValues(info, mobileSnapshot);
        const personalPhotoUrl = info?.personalPhotoUrl || "";
        personalMobileSnapshotRef.current = mobileSnapshot;
        form.setFieldsValue(editableValues);
        setCurrentPersonalPhotoUrl(personalPhotoUrl);
        savedSnapshotRef.current = createComparisonSnapshot(
            editableValues,
            personalPhotoUrl,
        );
        setIsDirty(false);
        void syncAddressOptions(info.emirateId, info.regionId);
    }

    const departmentLabels = getResolvedNameLabels(info.departmentsInfo);
    const assignRoleLabels = getResolvedNameLabels(info.assignRolesIdsInfo);

    function renderReadonlyList(labels: string[]) {
        return (
            <div className="personal-center__readonly-list">
                {labels.length > 0
                    ? labels.map((label, index) => (
                        <span
                            className="personal-center__readonly-list-item"
                            key={`${label}-${index}`}
                        >
                            {label}
                        </span>
                    ))
                    : PERSONAL_CENTER_EMPTY_VALUE}
            </div>
        );
    }

    return (
        <>
            <Form
                form={form}
                component={false}
                layout="vertical"
                onValuesChange={(_, values) => {
                    updateDirtyState(values, currentPersonalPhotoUrl);
                }}
            >
            <div className={`personal-center ${mode !== 'edit' ? 'read-only' : ''}`}>
                <div className="personal-info">
                    <div className="personal-info-title">{t('PersonalCenter.personalInformation')}</div>
                    <div className="personal-photo-wrapper">
                        <div className="personal-info-photo-title">{t('PersonalCenter.personalPhoto')}</div>
                        <div className="personal-info-photo">
                            <div className="personal-info-photo-avatar">
                                <Avatar
                                    disabled={mode !== 'edit' || saveLoading}
                                    loading={profileLoading}
                                    url={currentPersonalPhotoUrl}
                                    onSuccess={handleAvatarUploadSuccess}
                                />
                            </div>
                            <div className="personal-info-photo-name">{(info?.firstName ?? '') + ' ' + (info?.lastName ?? '')}</div>
                        </div>
                    </div>
                    <div>
                        <div className="ant-form ant-form-vertical custorm-form personal-form">
                            <Form.Item label={t('PersonalCenter.firstName')} name="firstName" required>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label={t('PersonalCenter.lastName')} name="lastName"  required>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item label={t('PersonalCenter.email')} name="email" required>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item className="no-margin" label={t('PersonalCenter.gender')} name="gender" required>
                                <Select disabled options={[{
                                    label: t('PersonalCenter.genderMale'),
                                    value: 1
                                },{
                                    label: t('PersonalCenter.genderFemale'),
                                    value: 2
                                }]} />
                            </Form.Item>
                            <Form.Item className="no-margin" label={t('PersonalCenter.emiratesId')} name="emiratesId" required>
                                <Input disabled />
                            </Form.Item>
                            <Form.Item
                                className="personal-center__mobile-number-field no-margin"
                                label={t('PersonalCenter.mobilePhone')}
                                name="mobileNumber"
                                rules={[
                                    createMobileNumberFormRule({
                                        fieldNames: personalMobileFieldNames,
                                    }),
                                ]}
                            >
                                {mode === 'edit' ? (
                                    <FormMobileNumberInput
                                        fieldNames={personalMobileFieldNames}
                                        searchPlaceholder={t('common.search')}
                                        emptyText={t('common.noData')}
                                        // Mount only this popover to body so the input wrapper cannot clip it.
                                        getPopupContainer={() => document.body}
                                    />
                                ) : (
                                    <ReadonlyMobileNumber
                                        display={getContactNumberDisplay(
                                            personalMobileSnapshotRef.current,
                                        )}
                                    />
                                )}
                            </Form.Item>
                        </div>
                    </div>
                </div>
                <div className="personal-info or-info">
                    <div className="personal-info-title">{t('PersonalCenter.organizationRole')}</div>
                    <div className="ant-form ant-form-vertical custorm-form personal-form">
                        <Form.Item className="no-margin" label={t('PersonalCenter.departments')} required>
                            {renderReadonlyList(departmentLabels)}
                        </Form.Item>
                        <Form.Item className="no-margin" label={t('PersonalCenter.assignRoles')} required>
                            {renderReadonlyList(assignRoleLabels)}
                        </Form.Item>
                    </div>
                </div>
                <div className="personal-info addr-info">
                    <div className="personal-info-title">{t('PersonalCenter.addressInformation')}</div>
                    <div className="ant-form ant-form-vertical custorm-form personal-form">
                        <Form.Item label={t('PersonalCenter.emirate')} name="emirateId">
                            {mode === 'edit' ? (
                                <Select allowClear placeholder={t('PersonalCenter.placeholderSelectEmirate')} onChange={(value?: number)=>{
                                    form.setFieldsValue({
                                        regionId: undefined,
                                        areaId: undefined
                                    });
                                    updateDirtyState(
                                        form.getFieldsValue(),
                                        currentPersonalPhotoUrl,
                                    );
                                    void syncAddressOptions(value, undefined);
                                }}>
                                    {emirates?.map((item)=>{
                                        return <Select.Option value={item.id} key={item.id}>{i18n.resolvedLanguage === 'en' ? item.nameEn: item.nameAr} </Select.Option>
                                    })}
                                </Select>
                            ) : (
                                <div className="readonly-field-value">
                                    {getLocationDisplayText(emirates, info.emirateId, info.emirateInfo?.name)}
                                </div>
                            )}
                        </Form.Item>
                        <Form.Item label={t('PersonalCenter.region')} name="regionId">
                            {mode === 'edit' ? (
                                <Select allowClear placeholder={t('PersonalCenter.placeholderSelectRegion')} onChange={(value?: number)=>{
                                    form.setFieldsValue({
                                        areaId: undefined
                                    });
                                    updateDirtyState(
                                        form.getFieldsValue(),
                                        currentPersonalPhotoUrl,
                                    );
                                    void syncAddressOptions(form.getFieldValue('emirateId'), value);
                                }}>
                                    {regions?.map((item)=>{
                                        return <Select.Option value={item.id} key={item.id}>{i18n.resolvedLanguage === 'en' ? item.nameEn: item.nameAr} </Select.Option>
                                    })}
                                </Select>
                            ) : (
                                <div className="readonly-field-value">
                                    {getLocationDisplayText(regions, info.regionId, info.regionInfo?.name)}
                                </div>
                            )}
                        </Form.Item>
                        <Form.Item label={t('PersonalCenter.area')} name="areaId">
                            {mode === 'edit' ? (
                                <Select allowClear placeholder={t('PersonalCenter.placeholderSelectArea')}>
                                    {areas?.map((item)=>{
                                        return <Select.Option value={item.id} key={item.id}>{i18n.resolvedLanguage === 'en' ? item.nameEn: item.nameAr} </Select.Option>
                                    })}
                                </Select>
                            ) : (
                                <div className="readonly-field-value">
                                    {getLocationDisplayText(areas, info.areaId, info.areaInfo?.name)}
                                </div>
                            )}
                        </Form.Item>
                        <Form.Item label={t('PersonalCenter.street')} name="street" className="addr-info-street no-margin">
                            {mode === 'edit' ? (
                                <Input.TextArea
                                    placeholder={t('PersonalCenter.placeholderEnterStreet')}
                                    rows={4}
                                    maxLength={1000}
                                    showCount
                                />
                            ) : (
                                <div className="readonly-field-value readonly-field-value-multiline">
                                    {getDisplayText(info.street)}
                                </div>
                            )}
                        </Form.Item>
                    </div>
                </div>
                {mode !== 'edit' && <div className="personal-info login-info">
                    <div className="personal-info-title">{t('PersonalCenter.loginSettings')}</div>
                    <div className="personal-center__login-card">
                        <div className="personal-center__login-meta">
                            <div className="personal-center__login-label">
                                {t('PersonalCenter.lastLoginDate')}
                            </div>
                            <div className="personal-center__login-value">
                                {formatLastLoginTime(info.lastLoginTime)}
                            </div>
                        </div>
                        <CustomButton
                            customClassName="personal-center__login-button"
                            variant="outline"
                            text={t('PersonalCenter.changePassword')}
                            onClick={()=>setChangePasswordVisible(true)}
                            permissionCode="PersonalCenter.ChangePassword"
                            permissionRoutePath="/personal-center"
                        />
                    </div>
                </div>}

                <ConfirmModal
                    type="danger"
                    visible={confirmModalVisible}
                    title={t('PersonalCenter.leavePageTitle')}
                    content={t('PersonalCenter.leavePageContent')}
                    confirmText={t('PersonalCenter.leave')}
                    onCancel={()=>setConfirmModalVisible(false)}
                    onConfirm={()=>{
                        reset();
                        setConfirmModalVisible(false);
                        setMode('');
                    }}
                />
                
                <CustomFooter rightContent={mode === 'edit' ? <>
                    <CustomButton variant="outline" text={t('PersonalCenter.cancel')} onClick={()=>{
                        if(isDirty){
                            setConfirmModalVisible(true);
                        } else {
                            reset();
                            setMode('');
                        }
                    }} />
                    <CustomButton
                        text={t('PersonalCenter.save')}
                        disabled={!isDirty || saveLoading}
                        loading={saveLoading}
                        onClick={handleSave}
                        permissionCode="PersonalCenter.Save"
                        permissionRoutePath="/personal-center"
                    />
                </> : <>
                    <CustomButton text={t('PersonalCenter.edit')} onClick={()=>{
                        reset();
                        setMode('edit');
                    }} />
                </>} />
            </div>
            </Form>
            <ChangePassword
                visible={changePasswordVisible}
                onCancel={() => setChangePasswordVisible(false)}
                resumeToVerification={
                    hasActiveChangePasswordVerificationSession
                }
                onVerificationSessionStart={
                    startChangePasswordVerificationSession
                }
                onVerificationSessionReset={
                    clearChangePasswordVerificationSession
                }
            />
        </>
    );
}
