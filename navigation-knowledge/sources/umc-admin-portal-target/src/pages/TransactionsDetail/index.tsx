import refundNumberIcon from '@/pages/CustomerRefunds/assets/icons/detail_refund_number.svg';
import refundTypeIcon from '@/pages/CustomerRefunds/assets/icons/detail_refund_category.svg';
import refundStatusIcon from '@/pages/CustomerRefunds/assets/icons/detail_status.svg';
import refundUpdatedIcon from '@/pages/CustomerRefunds/assets/icons/detail_last_updated.svg';
import './index.less'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { getTransactionDetail, getTransactionReceipt, type ITransactionDetailResponse, type ITransactionReceiptResponse } from '@/services/finance';
import { getFinancialRefundDetail } from '@/services/financialRefunds';
import { getTaskType } from '@/services/tickets';
import { useTranslation } from 'react-i18next';
import CustomStatusTag from '@/components/common/CustomStatusTag';
import moment from 'moment';
import { Alert } from 'antd';
import { CustomButton, CustomFooter, CustomMessage } from '@/components/common';
import { createPermissionPathSet, normalizeRoutePath } from '@/routes/access';
import { useUserStore } from '@/store/user';
import { INSPECTION_PATHS, INSPECTION_QUERY_KEYS } from '@/pages/InspectionCommon/constants';
import { INSPECTION_VIOLATION_ROLES, useInspectionAccess } from '@/pages/InspectionCommon/access';
import { buildInspectionPath } from '@/pages/InspectionCommon/helpers';

import { getAllowedOrigins } from '@/utils/allowedOrigins';
import { warnSecurityRestrictedUrl } from '@/utils/securityRestrictedUrlLog';
import formatMoney from '@/utils/formatMoney';
export default function TransactionsDetail() {
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const transactionNo = urlParams.get("transactionNo");
    const history = useHistory();
    const { i18n, t } = useTranslation();
    const [detail, setDetail] = useState<ITransactionDetailResponse>({} as ITransactionDetailResponse);
    const transactionInfo = getTransactionInfo(detail);
    function handleDownloadReceipt(){
        if(!transactionNo){
            return;
        }

        getTransactionReceipt(transactionNo).then((res) => {
            const receiptUrl = getReceiptUrl(res.data);

            if(!receiptUrl){
                CustomMessage.warning(t("Finance.transactionsDetail.messages.receiptUnavailable"));
                return;
            }

            window.open(receiptUrl, "_blank", "noopener,noreferrer");
        });
    }
    useEffect(() => { 
        if(!transactionNo){
            history.push("/financial-payment/transactions");
        } else {
            getTransactionDetail(transactionNo).then((res) => { 
                if(res.data){
                    setDetail(res.data);
                }
            });
        }
    }, [history, transactionNo]);
    return (
        <div className="trans-detail">
            {transactionInfo?.statusId === 4 && <div className='trans-detail-alert'>
                <Alert
                    type="error"
                    message={t("Finance.transactionsDetail.failureReason.title")}
                    description={t("Finance.transactionsDetail.failureReason.description")}
                    banner
                />
            </div>}
            <div className='trans-detail-header'>
                <div className='trans-detail-header-item'>
                    <div className='trans-detail-header-item-icon'>
                        <img src={refundNumberIcon} alt="" />
                    </div>
                    <div className='trans-detail-header-item-content'>
                        <div className='trans-detail-header-item-content-title'>{t("Finance.transactionsDetail.header.transactionNumber")}</div>
                        <div className='trans-detail-header-item-content-value'>{displayValue(transactionInfo?.transactionNo)}</div>
                    </div>
                </div>
                <div className='trans-detail-header-item'>
                    <div className='trans-detail-header-item-icon'>
                        <img src={refundTypeIcon} alt="" />
                    </div>
                    <div className='trans-detail-header-item-content'>
                        <div className='trans-detail-header-item-content-title'>{t("Finance.transactions.table.type")}</div>
                        <div className='trans-detail-header-item-content-value'>{getLocalizedName(transactionInfo?.transactionTypeObj, i18n.language)}</div>
                    </div>
                </div>
                <div className='trans-detail-header-item'>
                    <div className='trans-detail-header-item-icon'>
                        <img src={refundStatusIcon} alt="" />
                    </div>
                    <div className='trans-detail-header-item-content'>
                        <div className='trans-detail-header-item-content-title'>{t("Finance.transactions.table.status")}</div>
                        <div className='trans-detail-header-item-content-value'><CustomStatusTag type="transaction" status={getStatusValue(transactionInfo?.statusId)} /></div>
                    </div>
                </div>
                <div className='trans-detail-header-item'>
                    <div className='trans-detail-header-item-icon'>
                        <img src={refundUpdatedIcon} alt="" />
                    </div>
                    <div className='trans-detail-header-item-content'>
                        <div className='trans-detail-header-item-content-title'>{t("Finance.transactions.table.transactionTime")}</div>
                        <div className='trans-detail-header-item-content-value'>{formatDateTime(transactionInfo?.createdOn ?? transactionInfo?.createOn ?? transactionInfo?.updateOn)}</div>
                    </div>
                </div>
            </div>
            {transactionInfo?.transactionTypeId === 1 && <Recharge detail={detail} />}
            {transactionInfo?.transactionTypeId === 2 && <ServiceApplication detail={detail} />}
            {transactionInfo?.transactionTypeId === 3 && <Fine detail={detail} />}    
            {transactionInfo?.transactionTypeId === 4 && <Refund detail={detail} />}
            <CustomFooter 
                onBack={()=>{
                    history.push("/financial-payment/transactions");
                }} 
                rightContent={
                    <div className="trans-detail-footer-action">
                        <CustomButton
                            text={t("Finance.transactionsDetail.actions.downloadReceipt")}
                            onClick={handleDownloadReceipt}
                            permissionCode="Finance.Transactions.TransactionsDetail.DownloadReceipt"
                            permissionRoutePath="/financial-payment/transactions/transactions-detail"
                        />
                    </div>
                } 
            />
        </div>
    )
}

type DetailValue = DetailRecord | DetailRecord[] | string | number | boolean | null | undefined;
interface DetailRecord {
    [key: string]: DetailValue;
}

type RelatedApplicationTaskLookup = {
    departmentId?: number;
    taskId?: string;
};

type RequestError = {
    response?: {
        status?: number;
    };
};

const RELATED_APPLICATION_TEAM_MANAGEMENT_ROUTE_MAP: Record<number, {
    detailRoutePath: string;
    permissionPath: string;
    scope: string;
}> = {
    1: {
        detailRoutePath: '/licensing/team-management/applicationsDetails',
        permissionPath: '/licensing/team-management',
        scope: 'licensing',
    },
    2: {
        detailRoutePath: '/content/team-management/applicationsDetails',
        permissionPath: '/content/team-management',
        scope: 'content',
    },
};

const FINANCE_TRANSACTION_DETAIL_PATH = "/financial-payment/transactions/transactions-detail";

function unwrapRelatedApplicationTaskLookup(response: unknown): RelatedApplicationTaskLookup | undefined {
    if (!response || typeof response !== 'object') {
        return undefined;
    }

    const responseData = (response as { data?: unknown }).data;
    if (responseData && typeof responseData === 'object') {
        const nestedData = (responseData as { data?: unknown }).data;
        return (nestedData ?? responseData) as RelatedApplicationTaskLookup;
    }

    return response as RelatedApplicationTaskLookup;
}

function isRequestForbiddenError(error: unknown): error is RequestError {
    return typeof error === 'object'
        && error !== null
        && (error as RequestError).response?.status === 403;
}

function asRecord(value: DetailValue): DetailRecord | undefined {
    if(value && typeof value === 'object' && !Array.isArray(value)){
        return value;
    }

    return undefined;
}

function getTransactionInfo(detail: ITransactionDetailResponse): DetailRecord | undefined {
    return (detail.paymentTransactionInfo ?? detail.transaction) as DetailRecord | undefined;
}

function getApplicationItems(detail: ITransactionDetailResponse): DetailRecord[] {
    return ((detail.applicationDatas ?? detail.applicationItems) as DetailRecord[] | undefined) ?? [];
}

function getRefundInfo(detail: ITransactionDetailResponse): DetailRecord | undefined {
    return (detail.refundInfos ?? detail.refund) as DetailRecord | undefined;
}

function getWalletInfo(detail: ITransactionDetailResponse): DetailRecord | undefined {
    return (detail.walletPaymentInfo ?? detail.accountInfo ?? undefined) as DetailRecord | undefined;
}

function getProfileInfo(transactionInfo?: DetailRecord): DetailRecord | undefined {
    return asRecord(transactionInfo?.userProfileInfo) ?? asRecord(transactionInfo?.applyForObj);
}

function getPaymentMethodInfo(transactionInfo?: DetailRecord): DetailRecord | undefined {
    return asRecord(transactionInfo?.paymentMethodObj) ?? asRecord(transactionInfo?.walletVauleObj);
}

function getReceiptUrl(value?: ITransactionReceiptResponse | string | null) {
    if(!value){
        return '';
    }

    const rawUrl = typeof value === 'string'
        ? value
        : value.url
            || value.receiptUrl
            || value.fileUrl
            || value.downloadUrl
            || value.paymentReceiptWithHeaderUrl
            || value.receiptWithHeaderUrl
            || '';

    if(!rawUrl){
        return '';
    }

    if(!/^[a-z][a-z0-9+.-]*:/i.test(rawUrl)){
        return rawUrl;
    }

    try {
        const parsedUrl = new URL(rawUrl);
        const allowedOrigins = getAllowedOrigins(window.location.origin, [
            String(import.meta.env.VITE_ALLOWED_PAYMENT_ORIGINS ?? ''),
            String(import.meta.env.VITE_API_BASE_URL ?? ''),
        ]);

        if(allowedOrigins.has(parsedUrl.origin)){
            return rawUrl;
        }

        warnSecurityRestrictedUrl({
            feature: 'payment-receipt',
            value: rawUrl,
            currentOrigin: window.location.origin,
            allowedOrigins,
            reason: 'Payment receipt origin is not allowed.',
        });
        return '';
    } catch {
        warnSecurityRestrictedUrl({
            feature: 'payment-receipt',
            value: rawUrl,
            currentOrigin: window.location.origin,
            reason: 'Payment receipt URL is invalid.',
        });
        return '';
    }
}

function displayValue(value?: DetailValue) {
    if(value === undefined || value === null || value === ''){
        return '-';
    }

    return typeof value === 'string' || typeof value === 'number' ? value : '-';
}

function getStatusValue(value?: DetailValue) {
    const display = displayValue(value);
    return display === '-' ? undefined : display;
}

function getLocalizedName(value: DetailValue, language: string) {
    const record = asRecord(value);
    if(!record){
        return '-';
    }

    const localizedValue = language === 'en'
        ? record.nameEn ?? record.name
        : record.nameAr ?? record.nameEn ?? record.name;

    return displayValue(localizedValue);
}

function formatDateTime(value?: DetailValue) {
    return typeof value === 'string' && value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-';
}

function formatCardInfo(transactionInfo?: DetailRecord) {
    const maskedCardNumber = transactionInfo?.maskedCardNumber;
    const cardBrand = transactionInfo?.cardBrand;

    if(typeof maskedCardNumber === 'string' && typeof cardBrand === 'string'){
        return `${cardBrand} ${maskedCardNumber}`;
    }

    return displayValue(maskedCardNumber);
}

function formatAmount(value?: DetailValue, absolute = false) {
    if(value === undefined || value === null || value === ''){
        return '-';
    }

    const numericValue = Number(value);
    if(Number.isNaN(numericValue)){
        return String(value);
    }

    return formatMoney(absolute ? Math.abs(numericValue) : numericValue);
}

function DetailAmountAedIcon() {
    return (
        <svg
            className="trans-detail-amount-value-icon"
            viewBox="0 0 15.5922 13.5996"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M4.01855 0C6.52386 3.1226e-07 6.96515 0.00406904 7.2832 0.0400391C7.35332 0.0462928 7.50578 0.0642487 7.62109 0.0751953C8.32582 0.145574 9.24943 0.372041 9.7998 0.611328C9.83267 0.623902 9.90593 0.654727 9.96191 0.679688C10.0554 0.718751 10.4295 0.902971 10.4961 0.939453C10.5101 0.948832 10.5667 0.980063 10.6182 1.00977C10.7522 1.08479 11.0839 1.30529 11.2197 1.41016C12.216 2.17181 12.8979 3.19976 13.2627 4.49316C13.2935 4.59832 13.3169 4.69584 13.3174 4.70996C13.3174 4.72247 13.3246 4.73866 13.334 4.74805C13.3449 4.75743 13.5585 4.76347 13.9668 4.7666C14.6634 4.77129 14.6765 4.77448 14.8789 4.88379C15.1907 5.0527 15.4088 5.3268 15.5195 5.69434C15.5756 5.87565 15.5898 5.99747 15.5898 6.27246V6.50391L15.5 6.41992C15.3379 6.2714 15.2051 6.19634 15.0088 6.1416C14.9433 6.1244 14.8325 6.1209 14.2373 6.12402L13.541 6.12695L13.5479 6.32422C13.5556 6.56976 13.5551 7.04724 13.5488 7.28809L13.543 7.4707L14.0625 7.47852L14.583 7.48535L14.7109 7.53223C15.0381 7.64639 15.2935 7.8853 15.4463 8.21973C15.493 8.31666 15.5056 8.35762 15.5586 8.5498C15.5726 8.59985 15.5807 8.72364 15.5869 8.92383C15.5963 9.26466 15.6102 9.2425 15.459 9.10645C15.3438 9.00185 15.3124 8.98009 15.208 8.93164C15.0226 8.84567 15.0223 8.84512 14.1836 8.83887C13.7643 8.83574 13.4009 8.83613 13.376 8.84082C13.3372 8.84863 13.3326 8.85669 13.3232 8.9082C13.2951 9.06951 13.0611 9.80708 13.0205 9.86035C13.0143 9.86664 13.0015 9.89804 12.9922 9.92773C12.9718 9.99364 12.7608 10.4302 12.709 10.5186C12.6888 10.5513 12.6423 10.6299 12.6064 10.6924C12.3523 11.1225 12.0242 11.5245 11.6328 11.8857C11.5299 11.9812 11.3037 12.1701 11.2383 12.2139C11.2226 12.2249 11.1494 12.2769 11.0762 12.3301C10.9283 12.4362 10.8274 12.5023 10.7666 12.5352C10.7448 12.5461 10.687 12.5803 10.6387 12.6084C10.5483 12.6631 10.2087 12.8363 10.0898 12.8896C9.71112 13.0585 9.32428 13.1915 8.90039 13.2979C8.59948 13.3745 8.38996 13.4187 8.26367 13.4375C8.20442 13.4469 8.11372 13.4604 8.06543 13.4697C7.91211 13.5026 7.23452 13.5703 6.93066 13.5859C6.75727 13.5938 5.57881 13.5996 4.00293 13.5996H1.36621L1.41895 13.542C1.68088 13.2574 1.8635 12.8177 1.96484 12.2344C1.98666 12.1077 2.01174 11.926 2.01953 11.8291C2.02731 11.7214 2.03223 11.0978 2.03223 10.2529V8.85156L1.5498 8.8457C1.09979 8.83945 1.05764 8.83728 0.950195 8.80762C0.518316 8.69188 0.190332 8.33718 0.0546875 7.83984C0.0157417 7.69919 0.0146294 7.66737 0.00683594 7.39062L0 7.09277L0.106445 7.1875C0.251444 7.31731 0.31868 7.36147 0.466797 7.4209L0.591797 7.4707L1.31348 7.47559L2.03223 7.48047V6.12402L1.52246 6.11621C1.11397 6.11308 0.997929 6.10744 0.943359 6.0918C0.687773 6.01204 0.509139 5.89232 0.333008 5.67969C0.2036 5.52485 0.117053 5.3512 0.0546875 5.11816C0.0158276 4.97156 0.0126701 4.94118 0.00488281 4.6709C-0.00134862 4.34443 -0.00462258 4.35111 0.0966797 4.45898C0.224528 4.59349 0.415632 4.69821 0.599609 4.7373C0.716204 4.76066 0.785525 4.76367 1.37988 4.76367H2.03223V3.40332C2.03223 1.94258 2.02877 1.82165 1.96484 1.43848C1.86817 0.855169 1.68873 0.392046 1.4502 0.107422C1.41762 0.066967 1.38334 0.0251745 1.37695 0.015625C1.36916 0.00467724 1.90126 0 4.01855 0ZM7.5127 8.84863L4.06836 8.85449V12.9131H5.26758C6.4251 12.9131 6.47389 12.9115 6.77441 12.8818C7.23903 12.8334 7.81804 12.7163 8.12207 12.6084C8.28728 12.549 8.42952 12.4957 8.44043 12.4863C8.4484 12.4801 8.46797 12.4705 8.48633 12.4658C8.57832 12.4377 8.92204 12.2567 9.08887 12.1504C9.54565 11.8532 9.94594 11.4508 10.2266 11.0098C10.2702 10.9394 10.3207 10.86 10.3379 10.835C10.3739 10.7799 10.5219 10.4889 10.5811 10.3545C10.7011 10.0918 10.819 9.7365 10.9062 9.38477C10.9826 9.07221 11.0205 8.88 11.0127 8.85645C11.008 8.8455 10.9935 8.83633 10.9795 8.83789C10.9503 8.84102 9.39654 8.84552 7.5127 8.84863ZM7.62012 6.12109C5.58545 6.12109 4.07401 6.12597 4.06934 6.13379C4.06625 6.14577 4.06332 6.44684 4.06641 6.80762L4.06934 7.4707L7.61523 7.47559L11.1621 7.47852L11.1719 7.43652C11.1828 7.38022 11.1828 6.23815 11.1719 6.1709L11.1621 6.12109H7.62012ZM4.07617 0.678711L4.06934 0.708008C4.06466 0.725211 4.06387 1.64389 4.06543 2.74805L4.06934 4.75684L7.53906 4.76074C9.44566 4.7623 11.01 4.75917 11.0205 4.75293C11.0252 4.74824 11.0207 4.69907 11.0098 4.64746C10.9988 4.59417 10.9751 4.48176 10.958 4.39746C10.8879 4.05032 10.8082 3.78727 10.6445 3.34473C10.6098 3.24863 10.3797 2.77719 10.3252 2.68652C9.73433 1.71381 8.92042 1.13173 7.76367 0.856445C7.38481 0.764172 7.06018 0.723662 6.5332 0.692383C6.40068 0.684563 5.79262 0.678711 5.18457 0.678711H4.07617Z"
                fill="currentColor"
            />
        </svg>
    );
}

function renderAmountWithAed(
    amount?: DetailValue,
    options?: {
        sign?: '+' | '-';
        absolute?: boolean;
        className?: string;
    }
) {
    const { sign, absolute = false, className } = options || {};
    const formattedAmount = formatAmount(amount, absolute);
    const classNames = ["trans-detail-main-info-item-value", "trans-detail-amount-value", className]
        .filter(Boolean)
        .join(" ");

    if(formattedAmount === '-'){
        return <div className={classNames}>-</div>;
    }

    return (
        <div className={classNames}>
            {sign ? <span className="trans-detail-amount-value-sign">{sign}</span> : null}
            <DetailAmountAedIcon />
            <span>{formattedAmount}</span>
        </div>
    );
}

function ServiceApplication({ detail }: {detail: ITransactionDetailResponse}){
    const { i18n, t } = useTranslation();
    const history = useHistory();
    const permissions = useUserStore((state) => state.userInfo?.listSysPermission || []);
    const permissionPathSet = useMemo(() => createPermissionPathSet(permissions), [permissions]);
    const transactionInfo = getTransactionInfo(detail);
    const profileInfo = getProfileInfo(transactionInfo);
    const paymentMethodInfo = getPaymentMethodInfo(transactionInfo);
    const applicationItems = getApplicationItems(detail);
    const handleRelatedApplicationReferenceClick = useCallback(async (value: DetailValue) => {
        const applicationNo = typeof value === 'string' || typeof value === 'number'
            ? String(value).trim()
            : '';

        if (!applicationNo) {
            return;
        }

        try {
            const response = await getTaskType({ applicationNo });
            const payload = unwrapRelatedApplicationTaskLookup(response);
            const targetRoute = payload?.departmentId === undefined
                ? undefined
                : RELATED_APPLICATION_TEAM_MANAGEMENT_ROUTE_MAP[payload.departmentId];
            const taskId = typeof payload?.taskId === 'string' ? payload.taskId.trim() : '';

            if (targetRoute && taskId) {
                if (!permissionPathSet.has(normalizeRoutePath(targetRoute.permissionPath))) {
                    CustomMessage.warning(t("response.error.403"));
                    return;
                }

                const query = new URLSearchParams({
                    taskId,
                    sourcePage: 'teamManagement',
                    breadcrumbMode: 'teamManagementTask',
                    teamManagementScope: targetRoute.scope,
                    pageTitleKey: 'menu.taskDetails',
                    canReassign: 'false',
                    teamTaskSourceType: 'application',
                    teamTaskSourceId: taskId,
                });
                history.push(`${targetRoute.detailRoutePath}?${query.toString()}`);
                return;
            }
        } catch (error) {
            if (isRequestForbiddenError(error)) {
                CustomMessage.warning(t("response.error.403"));
                return;
            }

            // Show the shared warning below when the task lookup fails.
        }

        CustomMessage.warning(t("Customer.customerRefunds.messages.relatedApplicationNotFound"));
    }, [history, permissionPathSet, t]);

    return <div className='trans-detail-main'>
        <div className='trans-detail-main-left'>
            <div className='trans-detail-main-info'>
                <div className='trans-detail-main-info-title'>
                    <div>{t("Finance.transactionsDetail.sections.paymentInformation")}</div>
                </div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(paymentMethodInfo, i18n.language)}</div>
                    </div>
                    {transactionInfo?.paymentMethodId === 1 && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.accountEmail")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountEmail)}</div>
                    </div>}
                    {(transactionInfo?.paymentMethodId === 2 || transactionInfo?.paymentMethodId === 3) && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                        <div className='trans-detail-main-info-item-value'>{formatCardInfo(transactionInfo)}</div>
                    </div>}
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.amountCharged")}</div>
                        {renderAmountWithAed(transactionInfo?.amount, { sign: '+' })}
                    </div>
                    {transactionInfo?.paymentMethodId === 1 && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.accountHolderName")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>}
                    {(transactionInfo?.paymentMethodId === 2 || transactionInfo?.paymentMethodId === 3)  &&<div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.cardHolderName")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>}
                </div>
                <div className='trans-detail-main-info-divider'></div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item trans-detail-main-info-item-desc'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.description")}</div>
                        <div className='trans-detail-main-info-item-value'>{transactionInfo?.description ?? t("Finance.transactionsDetail.defaults.serviceApplicationFeeDesc")}</div>
                    </div>
                </div>
            </div>
            
        </div>
        <div className='trans-detail-main-right'>
            <div className='trans-detail-related-applications'>
                <div className='title'>{t("Finance.transactionsDetail.sections.relatedApplications")}</div>
                <div className='items'>
                    {applicationItems.length > 0 && applicationItems.map((item) => {
                        const applicationNo = typeof item.applicationNumber === 'string' || typeof item.applicationNumber === 'number'
                            ? String(item.applicationNumber).trim()
                            : '';

                        return <div className='item' key={String(displayValue(item.applicationNumber ?? item.id))}>
                            <div className='item-header'>
                                {applicationNo ? (
                                    <button
                                        className='trans-detail-related-applications__reference'
                                        type='button'
                                        onClick={() => handleRelatedApplicationReferenceClick(applicationNo)}
                                    >
                                        {applicationNo}
                                    </button>
                                ) : (
                                    <div className='header-num'>{displayValue(item.applicationNumber)}</div>
                                )}
                                <div className='header-tag'><CustomStatusTag status={getStatusValue(item.applicationStatusId)} type="appStatus" /></div>
                            </div>
                            <div className='item-content'>
                                <div className='item-content-li'>
                                    <div className='li-title'>{t("Finance.transactionsDetail.fields.serviceName")}</div>
                                    <div className='li-value'>{i18n.resolvedLanguage === 'en' ? displayValue(item.serviceNameNameEn) : displayValue(item.serviceNameNameAr)}</div>
                                </div>
                                <div className='item-content-li'>
                                    <div className='li-title'>{t("Finance.transactionsDetail.fields.appliedFor")}</div>
                                    <div className='li-value'>{displayValue(item.applyFor)}</div>
                                </div>
                                <div className='item-content-li'>
                                    <div className='li-title'>{t("Finance.transactions.table.submissionTime")}</div>
                                    <div className='li-value'>{formatDateTime(item.createdOn)}</div>
                                </div>
                            </div>
                        </div>
                    })}
                </div>
            </div>
        </div>
    </div>
}

function Fine({ detail }: {detail: ITransactionDetailResponse}){
    const { i18n, t } = useTranslation();
    const history = useHistory();
    const permissions = useUserStore((state) => state.userInfo?.listSysPermission || []);
    const permissionPathSet = useMemo(() => createPermissionPathSet(permissions), [permissions]);
    const inspectionAccess = useInspectionAccess();
    const transactionInfo = getTransactionInfo(detail);
    const relatedViolation = detail.relatedViolation;
    const relatedViolationNo = String(relatedViolation?.violationNo ?? '').trim();
    const violationTypeLabel = relatedViolation?.violationTypeId === 1
        ? t("Finance.transactionsDetail.violationTypes.licensing")
        : relatedViolation?.violationTypeId === 2
            ? t("Finance.transactionsDetail.violationTypes.content")
            : displayValue(relatedViolation?.violationTypeObj.name);
    const profileInfo = getProfileInfo(transactionInfo);
    const applyForInfo = asRecord(transactionInfo?.applyForObj);
    const paymentMethodInfo = getPaymentMethodInfo(transactionInfo);
    const hasCardInformation = typeof transactionInfo?.maskedCardNumber === 'string'
        && transactionInfo.maskedCardNumber.trim() !== ''
        && typeof transactionInfo?.cardBrand === 'string'
        && transactionInfo.cardBrand.trim() !== '';
    const cardHolderName = typeof applyForInfo?.accountName === 'string'
        && applyForInfo.accountName.trim() !== ''
        ? applyForInfo.accountName
        : undefined;
    const handleRelatedViolationClick = useCallback(() => {
        const violationId = relatedViolation?.violationId;

        if (!relatedViolationNo) {
            return;
        }

        const hasViolationDetailPermission = permissionPathSet.has(
            normalizeRoutePath(INSPECTION_PATHS.violationDetail),
        );
        const canOpenViolationDetail = hasViolationDetailPermission
            && inspectionAccess.isRouteAllowed({
                path: INSPECTION_PATHS.violationDetail,
                allowedInspectionRoles: INSPECTION_VIOLATION_ROLES,
            });

        if (!canOpenViolationDetail) {
            CustomMessage.warning(t("response.error.403"));
            return;
        }

        history.push(buildInspectionPath(INSPECTION_PATHS.violationDetail, '', {
            [INSPECTION_QUERY_KEYS.from]: 'transactions',
            [INSPECTION_QUERY_KEYS.violationId]: violationId,
            [INSPECTION_QUERY_KEYS.violationNo]: relatedViolationNo,
        }));
    }, [history, inspectionAccess, permissionPathSet, relatedViolation?.violationId, relatedViolationNo, t]);

    return <div className='trans-detail-main'>
        <div className='trans-detail-main-left'>
            <div className='trans-detail-main-info'>
                <div className='trans-detail-main-info-title'>
                    <div>{t("Finance.transactionsDetail.sections.paymentInformation")}</div>
                </div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(paymentMethodInfo, i18n.language)}</div>
                    </div>
                    {transactionInfo?.paymentMethodId === 1 && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.accountEmail")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountEmail)}</div>
                    </div>}
                    {hasCardInformation && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                        <div className='trans-detail-main-info-item-value'>{formatCardInfo(transactionInfo)}</div>
                    </div>}
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.amountCharged")}</div>
                        {renderAmountWithAed(transactionInfo?.amount, { sign: '+' })}
                    </div>
                     {transactionInfo?.paymentMethodId === 1 && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.accountHolderName")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>}
                    {cardHolderName && <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.cardHolderName")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(cardHolderName)}</div>
                    </div>}
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.applyFor")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(profileInfo, i18n.language)}</div>
                    </div>
                </div>
                <div className='trans-detail-main-info-divider'></div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item trans-detail-main-info-item-desc'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.description")}</div>
                        <div className='trans-detail-main-info-item-value'>{transactionInfo?.description ?? t("Finance.transactionsDetail.defaults.finePaymentDesc")}</div>
                    </div>
                </div>
            </div>
            
        </div>
        <div className='trans-detail-main-right'>
            <div className='trans-detail-related-applications'>
                <div className='title'>{t("Finance.transactionsDetail.sections.relatedInspectionViolation")}</div>
                <div className='items'>
                    <div className='item'>
                        <div className='item-header'>
                            {relatedViolationNo ? (
                                <button
                                    className='trans-detail-related-applications__reference'
                                    type='button'
                                    onClick={handleRelatedViolationClick}
                                >
                                    {relatedViolationNo}
                                </button>
                            ) : (
                                <div className='header-num'>{displayValue(relatedViolation?.violationNo)}</div>
                            )}
                            <div className='header-tag'>{violationTypeLabel}</div>
                        </div>
                        <div className='item-content'>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.violationId")}</div>
                                <div className='li-value'>{displayValue(relatedViolation?.violationId)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.violationType")}</div>
                                <div className='li-value'>{violationTypeLabel}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.violationTime")}</div>
                                <div className='li-value'>{formatDateTime(relatedViolation?.violationTime)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.fineAmount")}</div>
                                <div className='li-value'>{formatAmount(relatedViolation?.beforeAppealAdjustedFineAmount)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.inspector")}</div>
                                <div className='li-value'>{displayValue(relatedViolation?.inspectorName)}</div>
                            </div>
                             <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.entityName")}</div>
                                <div className='li-value'>{displayValue(relatedViolation?.entityName)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}

function Refund({ detail }: {detail: ITransactionDetailResponse}){
    const { i18n, t } = useTranslation();
    const history = useHistory();
    const permissions = useUserStore((state) => state.userInfo?.listSysPermission || []);
    const permissionPathSet = useMemo(() => createPermissionPathSet(permissions), [permissions]);
    const transactionInfo = getTransactionInfo(detail);
    const profileInfo = getProfileInfo(transactionInfo);
    const paymentMethodInfo = getPaymentMethodInfo(transactionInfo);
    const refundInfo = getRefundInfo(detail);
    const refundProfileInfo = asRecord(refundInfo?.applyForObj) ?? profileInfo;
    const refundPaymentMethodInfo = asRecord(refundInfo?.paymentMethodObj) ?? paymentMethodInfo;
    const refundCardInfo = formatCardInfo(refundInfo) === '-' ? formatCardInfo(transactionInfo) : formatCardInfo(refundInfo);
    const handleRelatedPaymentClick = useCallback(async () => {
        const refundNo = typeof refundInfo?.applicationNo === 'string'
            ? refundInfo.applicationNo.trim()
            : '';

        if (!refundNo) {
            CustomMessage.warning(t("Finance.transactionsDetail.messages.relatedPaymentUnavailable"));
            return;
        }

        if (!permissionPathSet.has(normalizeRoutePath(FINANCE_TRANSACTION_DETAIL_PATH))) {
            CustomMessage.warning(t("response.error.403"));
            return;
        }

        try {
            const relatedPayment = await getFinancialRefundDetail(refundNo, {
                skipErrorMessage: true,
            });
            const relatedTransactionNo = String(
                relatedPayment?.relatedPaymentInformation?.transactionNo ?? '',
            ).trim();

            if (!relatedTransactionNo) {
                CustomMessage.warning(t("Finance.transactionsDetail.messages.relatedPaymentUnavailable"));
                return;
            }

            history.push(
                `${FINANCE_TRANSACTION_DETAIL_PATH}?transactionNo=${encodeURIComponent(relatedTransactionNo)}`,
            );
        } catch (error) {
            if (isRequestForbiddenError(error)) {
                CustomMessage.warning(t("response.error.403"));
                return;
            }

            CustomMessage.warning(t("Finance.transactionsDetail.messages.relatedPaymentUnavailable"));
        }
    }, [history, permissionPathSet, refundInfo?.applicationNo, t]);

    return <div className='trans-detail-main'>
        <div className='trans-detail-main-left'>
            <div className='trans-detail-main-info'>
                <div className='trans-detail-main-info-title'>
                    <div>{t("Finance.transactionsDetail.sections.refundInformation")}</div>
                </div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(paymentMethodInfo, i18n.language)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.accountOrCardHolder")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                        <div className='trans-detail-main-info-item-value'>{formatCardInfo(transactionInfo)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.accountEmail")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountEmail)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.applyFor")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(profileInfo, i18n.language)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.amountCharged")}</div>
                        {renderAmountWithAed(transactionInfo?.amount, { className: 'trans-detail-main-info-item-value-refund' })}
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.processedBy")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(refundInfo?.processedBy ?? refundInfo?.processorName)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.processorAccount")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(refundInfo?.processorAccount ?? refundInfo?.processorEmail)}</div>
                    </div>
                </div>
                <div className='trans-detail-main-app'>
                    <div className='trans-detail-app-title'>{t("Finance.transactionsDetail.sections.refundApplicationInformation")}</div>
                    <div className='trans-detail-app-items'>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.applicationNumber")}</div>
                            <div className='trans-detail-app-item-value trans-detail-app-item-value-num'>{displayValue(refundInfo?.applicationNo ?? refundInfo?.applicaitonNo)}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.refundStatus")}</div>
                            <div className='trans-detail-app-item-value'><CustomStatusTag type="refundOverviewStatus" status={getStatusValue(refundInfo?.statusId)} /></div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.refundType")}</div>
                            <div className='trans-detail-app-item-value'>{displayValue(refundInfo?.type ?? asRecord(refundInfo?.typeObj)?.nameEn ?? t("Finance.transactions.statistics.refunds"))}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.lastUpdated")}</div>
                            <div className='trans-detail-app-item-value'>{formatDateTime(refundInfo?.updateOn)}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                            <div className='trans-detail-app-item-value'>{getLocalizedName(refundPaymentMethodInfo, i18n.language)}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactions.table.accountOrCardHolder")}</div>
                            <div className='trans-detail-app-item-value'>{displayValue(refundProfileInfo?.accountName)}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                            <div className='trans-detail-app-item-value'>{refundCardInfo}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactions.recharges.accountEmail")}</div>
                            <div className='trans-detail-app-item-value'>{displayValue(refundProfileInfo?.accountEmail)}</div>
                        </div>
                         <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactions.table.applyFor")}</div>
                            <div className='trans-detail-app-item-value'>{getLocalizedName(refundProfileInfo, i18n.language)}</div>
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.refundCharged")}</div>
                            {renderAmountWithAed(refundInfo?.amount, { className: 'trans-detail-app-item-value trans-detail-app-item-value-refund' })}
                        </div>
                        <div className='trans-detail-app-item'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.refundScope")}</div>
                            <div className='trans-detail-app-item-value'>{displayValue(refundInfo?.refundScope ?? refundInfo?.scope)}</div>
                        </div>
                        <div className='trans-detail-main-info-divider'></div>
                         <div className='trans-detail-app-item trans-detail-app-item-desc'>
                            <div className='trans-detail-app-item-title'>{t("Finance.transactionsDetail.fields.refundReason")}</div>
                            <div className='trans-detail-app-item-value'>{getLocalizedName(refundInfo?.reasonObj, i18n.language)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
        <div className='trans-detail-main-right'>
            <div className='trans-detail-related-applications'>
                <div className='title'>{t("Finance.transactionsDetail.sections.relatedPaymentInformation")}</div>
                <div className='items'>
                    <div className='item'>
                        <div className='item-header'>
                            <button
                                className='trans-detail-related-applications__reference'
                                type='button'
                                onClick={handleRelatedPaymentClick}
                            >
                                {displayValue(transactionInfo?.transactionNo)}
                            </button>
                            <div className='header-tag'><CustomStatusTag type="transaction" status={getStatusValue(transactionInfo?.statusId)} /></div>
                        </div>
                        <div className='item-content'>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.transactionType")}</div>
                                <div className='li-value'>{getLocalizedName(transactionInfo?.transactionTypeObj, i18n.language)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.lastUpdated")}</div>
                                <div className='li-value'>{formatDateTime(transactionInfo?.updateOn)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                                <div className='li-value'>{getLocalizedName(refundPaymentMethodInfo, i18n.language)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                                <div className='li-value'>{formatCardInfo(transactionInfo)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.amountCharged")}</div>
                                {renderAmountWithAed(transactionInfo?.amount, { absolute: true, className: 'li-value' })}
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactions.table.applyFor")}</div>
                                <div className='li-value'>{getLocalizedName(profileInfo, i18n.language)}</div>
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.description")}</div>
                                <div className='li-value'>{displayValue(transactionInfo?.description)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}

function Recharge({ detail }: {detail: ITransactionDetailResponse}){
    const { i18n, t } = useTranslation();
    const transactionInfo = getTransactionInfo(detail);
    const profileInfo = getProfileInfo(transactionInfo);
    const paymentMethodInfo = getPaymentMethodInfo(transactionInfo);
    const walletInfo = getWalletInfo(detail);

    return <div className='trans-detail-main'>
        <div className='trans-detail-main-left'>
            <div className='trans-detail-main-info'>
                <div className='trans-detail-main-info-title'>
                    <div>{t("Finance.transactionsDetail.sections.paymentInformation")}</div>
                </div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.table.paymentMethod")}</div>
                        <div className='trans-detail-main-info-item-value'>{getLocalizedName(paymentMethodInfo, i18n.language)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.cardInformation")}</div>
                        <div className='trans-detail-main-info-item-value'>{formatCardInfo(transactionInfo)}</div>
                    </div>
                     <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.cardHolder")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>
                     <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactions.recharges.accountHolder")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountName)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.accountInformation")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(profileInfo?.accountEmail)}</div>
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.rechargeAmount")}</div>
                        {renderAmountWithAed(transactionInfo?.amount, { sign: '+' })}
                    </div>
                    <div className='trans-detail-main-info-item'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.transactionFee")}</div>
                        {renderAmountWithAed('0.00')}
                    </div>
                </div>
                <div className='trans-detail-main-info-divider'></div>
                <div className='trans-detail-main-info-items'>
                    <div className='trans-detail-main-info-item trans-detail-main-info-item-desc'>
                        <div className='trans-detail-main-info-item-title'>{t("Finance.transactionsDetail.fields.description")}</div>
                        <div className='trans-detail-main-info-item-value'>{displayValue(transactionInfo?.description)}</div>
                    </div>
                </div>
            </div>
            
        </div>
        <div className='trans-detail-main-right'>
            <div className='trans-detail-related-applications'>
                <div className='title'>{t("Finance.transactionsDetail.sections.walletInformation")}</div>
                <div className='items'>
                    <div className='item'>
                        <div className='item-header'>
                            <div className='header-num'>{displayValue(transactionInfo?.transactionNo)}</div>
                            <div className='header-tag'><CustomStatusTag status={getStatusValue(walletInfo?.statusId)} type="walletStatus" /></div>
                        </div>
                        <div className='item-content'>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.currentBalance")}</div>
                                {renderAmountWithAed(walletInfo?.balance, { className: 'li-value' })}
                            </div>
                            <div className='item-content-li'>
                                <div className='li-title'>{t("Finance.transactionsDetail.fields.lastRecharge")}</div>
                                <div className='li-value'>{formatDateTime(walletInfo?.updateOn)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}
