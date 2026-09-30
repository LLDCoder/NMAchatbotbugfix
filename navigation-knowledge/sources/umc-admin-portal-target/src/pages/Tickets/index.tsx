import Statistics from "./components/Statistics";
import TicketsTable from "./components/TicketsTable";
import { TeamTasks } from "./components/TeamTasks";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.less";
import React from "react";
import type {IContentContext} from '../ContentApplications/type';
import { getContentUrgentCount } from "@/services/content";
import type {IAction} from './type'
import { CustomMessage } from "@/components/common";
import { getCachedEnquiryTypes, getUserInfo, type IEnquiryType, type IUserInfoResponse } from "@/services/tickets";

export const TicketContext = React.createContext<IContentContext | null>(null)
const INIT_STATE = {
  urgentCount: 0,
}
const DEFAULT_USER_INFO: IUserInfoResponse = {
    userId: "",
    isLeader: false,
    isCustomerHappness: false,
}
const reducer = (state: typeof INIT_STATE, action: IAction) => {
  switch (action.type) {
    case "UPDATE_URGENT_COUNT":
      return {
        ...state,
        urgentCount: action.payload,
      }
    default:
      return state
  }
}
export default function Tickets(){
    const { t } = useTranslation();
    const statisticsRef = React.useRef<any>(null);
    const [ticketContext, setContext] = useReducer(reducer, INIT_STATE);
    const [userInfo, setUserInfo] = useState<IUserInfoResponse>(DEFAULT_USER_INFO);
    const [isUserInfoLoaded, setIsUserInfoLoaded] = useState(false);
    const [enquiryTypes, setEnquiryTypes] = useState<IEnquiryType[]>([]);
        
    function queryUserInfo(){
        getUserInfo()
            .then(res => {
                if (res.data) {
                    setUserInfo({
                        ...DEFAULT_USER_INFO,
                        ...res.data,
                    });
                }
            })
            .catch(() => {
                setUserInfo(DEFAULT_USER_INFO);
            })
            .finally(() => {
                setIsUserInfoLoaded(true);
            });
    }

    function queryStatistics(){
        statisticsRef.current?.refresh();
    }
    
    useEffect(() => {
        queryUserInfo();
    }, []);
    useEffect(() => {
        let ignore = false;

        getCachedEnquiryTypes()
            .then((types) => {
                if (ignore) return;
                setEnquiryTypes(Array.isArray(types) ? types : []);
            })
            .catch(() => {
                if (ignore) return;
                setEnquiryTypes([]);
            });

        return () => {
            ignore = true;
        }
    }, []);
    const getUrgentCount = useCallback(async () => {
        try {
        const res = await getContentUrgentCount()
        if (res.data) {
            setContext({ type: "UPDATE_URGENT_COUNT", payload: res.data })
        }
        } catch {
            CustomMessage.error(t("Customer.tickets.messages.failedToGetUrgentCount"))
        }
    }, [t])
    const dispatch = useCallback(() => {
        getUrgentCount()
    }, [getUrgentCount])
    const contextValue = useMemo(() => {
        return {
            ...ticketContext,
            dispatch,
        }
    }, [ticketContext, dispatch])
    return (
        <TicketContext.Provider value={contextValue}>
            <div className="tickets-wrapper">
                {isUserInfoLoaded ? (
                    <>
                        <Statistics ref={statisticsRef} isTeamTask={userInfo.isLeader} isCustomerHappness={userInfo.isCustomerHappness} />
                        {userInfo.isLeader ? (
                            <TeamTasks
                                enquiryTypes={enquiryTypes}
                                isCustomerHappness={userInfo.isCustomerHappness}
                                queryStatistics={queryStatistics}
                            />
                            // <TicketsTable enquiryTypes={enquiryTypes} isCustomerHappness={userInfo.isCustomerHappness} queryStatistics={queryStatistics} />

                        ) : (
                            <TicketsTable enquiryTypes={enquiryTypes} isCustomerHappness={userInfo.isCustomerHappness} queryStatistics={queryStatistics} />
                        )}
                    </>
                ) : null}
            </div>
        </TicketContext.Provider>
    )
}
