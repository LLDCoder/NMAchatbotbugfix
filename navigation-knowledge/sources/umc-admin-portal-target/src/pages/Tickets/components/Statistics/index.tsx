import TicketsTotal from "@/assets/images/tickets-total.png";
import Open from "@/assets/images/open-new.png";
import PendingCustomer from "@/assets/images/pending-customer.png";
import Resolved from "@/assets/images/resolved.png";
import Reopen from "@/assets/images/reopened-new.png";
import AppComplete from "@/assets/images/app-complete.png"
import Cancelled from "@/assets/images/cancelled.png";
import DepartmentProcessing from "@/assets/images/department-processing.png";
import DepartmentProcesed from "@/assets/images/department-processed.png";
import { Tooltip } from "antd";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { getEnquiryStatusCount } from "@/services/tickets";
import './index.less';
import EventEmiiter from "@/utils/EventEmiiter";

interface IStatistics {
    totalCount: number;
    openCount: number;
    pendingCustormer: number;
    pendingHander: number;
    departmentProcessingCount: number;
    departmentProcessedCount: number;
    resolvedCount: number;
    reopentCount: number;
    cancelledCount: number;
    completedCount: number;
}

interface IStatisticsRef {
    refresh: () => void;
}

interface StatCardProps {
    icon: string;
    value: number;
    label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
    return (
        <div className="tickets-statistics-item">
            <div className="tickets-statistics-item-icon">
                <img src={icon} alt="" />
            </div>
            <div className="tickets-statistics-item-content">
                <div className="tickets-statistics-item-value">{value}</div>
                <div className="tickets-statistics-item-label-wrap">
                    <Tooltip title={label}>
                        <div className="tickets-statistics-item-label">{label}</div>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

export default forwardRef<IStatisticsRef, { isCustomerHappness: boolean; isTeamTask?: boolean }>(({ isCustomerHappness, isTeamTask }, ref) => {
    const { t } = useTranslation();
    const [enquiryStatusCount, setEnquiryStatusCount] = useState<IStatistics | null>(null);
    
    function query(){
        getEnquiryStatusCount(isTeamTask).then(res=>{
            if(res.data){
                setEnquiryStatusCount(res.data);
            }
        })
    };
    
    useImperativeHandle(ref, () => ({
        refresh: () => query(),
    }));
    
    useEffect(()=>{
        query();
    }, [isTeamTask]);
    useEffect(()=>{
        const call = () => {
            query();
        }
        EventEmiiter.on('update:freshStatistics', call);
        return () => {
            EventEmiiter.off('update:freshStatistics', call);
        }
    },[]);
    return (
        <div className={`tickets-statistics ${isCustomerHappness ? '' : 'not-customer-happness'}`}>
            <StatCard
                icon={TicketsTotal}
                value={enquiryStatusCount?.totalCount ?? 0}
                label={t("Content.ticketsStatistics.total")}
            />
            {isCustomerHappness && (
                <StatCard
                    icon={Open}
                    value={enquiryStatusCount?.openCount ?? 0}
                    label={t("Content.ticketsStatistics.open")}
                />
            )}
            {isCustomerHappness && (
                <StatCard
                    icon={PendingCustomer}
                    value={enquiryStatusCount?.pendingCustormer ?? 0}
                    label={t("Content.ticketsStatistics.pendingCustomer")}
                />
            )}
            <StatCard
                icon={DepartmentProcessing}
                value={enquiryStatusCount?.departmentProcessingCount ?? 0}
                label={t("Content.ticketsStatistics.departmentProcessing")}
            />
            <StatCard
                icon={DepartmentProcesed}
                value={enquiryStatusCount?.departmentProcessedCount ?? 0}
                label={t("Content.ticketsStatistics.departmentProcessed")}
            />
            <StatCard
                icon={Resolved}
                value={enquiryStatusCount?.resolvedCount ?? 0}
                label={t("Content.ticketsStatistics.resolved")}
            />
            {isCustomerHappness && (
                <StatCard
                    icon={Reopen}
                    value={enquiryStatusCount?.reopentCount ?? 0}
                    label={t("Content.ticketsStatistics.reopened")}
                />
            )}
            <StatCard
                icon={AppComplete}
                value={enquiryStatusCount?.completedCount ?? 0}
                label={t("Content.ticketsStatistics.completed")}
            />
            <StatCard
                icon={Cancelled}
                value={enquiryStatusCount?.cancelledCount ?? 0}
                label={t("Content.ticketsStatistics.cancelled")}
            />
        </div>
    )
})
