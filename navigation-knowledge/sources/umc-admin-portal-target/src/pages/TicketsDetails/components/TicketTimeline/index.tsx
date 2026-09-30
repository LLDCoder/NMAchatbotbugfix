import './index.less'
import { Modal, Popover, Steps } from "antd"
import Reassign from "@/assets/icons/Reassign"
import Time from "@/assets/icons/Time"
import User2 from "@/assets/icons/User2"
import { useEffect, useState } from "react"
import Paperclip from '@/assets/images/paperclip.png'
import { getTimeline, type ITimelineResponse } from "@/services/tickets"
import { Trans, useTranslation } from "react-i18next"
import moment from "moment"
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader"
import InspectionAttachmentGrid from "@/pages/InspectionStartVisit/components/InspectionAttachmentGrid"

const popoverOverlayInnerStyle = { width: '17.5rem'};
const getPopoverContainer = () => document.body;

export default function TicketTimeline({enquiryStatusId}: {enquiryStatusId: number}){
    const { i18n, t } = useTranslation();
    const [timeline, setTimeline] = useState<ITimelineResponse[]>([]);
    const [isOpen, setIsOpen] = useState(true);
    const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);

    const renderPopoverContent = (content?: string) => (
        <div className="tickets-timeline-popover-content">{content || ''}</div>
    );

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        getTimeline(Number(id)).then(res=>{
                if(res.data){
                    setTimeline(res.data);
                }
            })
    }, [enquiryStatusId]);

    const renderTimelineAttachments = (attachmentUrls?: string[]) => {
        const attachments = attachmentUrls ?? [];
        if (!attachments.length) return null;

        if (attachments.length < 3) {
            return (
                <InspectionAttachmentGrid
                    attachments={attachments.map((fileUrl) => ({ fileUrl }))}
                    className="tickets-timeline__inline-attachments inspection-attachment-grid--single"
                    compact
                />
            );
        }

        return (
            <button
                type="button"
                className="applicant-information-doc-box"
                onClick={() => setSelectedAttachments(attachments)}
            >
                <div className="applicant-information-doc">
                    <img src={Paperclip} alt="" />
                    <div className="applicant-information-doc-text">
                        {t("Customer.ticketsDetails.ticketTimeline.attachments")}
                    </div>
                </div>
                <div className="applicant-information-doc-num">{attachments.length}</div>
            </button>
        );
    };

    return <section className='tickets-timeline'>
        <CollapsibleCardHeader
            title={t("Customer.ticketsDetails.ticketTimeline.title")}
            expanded={isOpen}
            onToggle={() => setIsOpen((current) => !current)}
        />
        <div className="tickets-timeline__body" hidden={!isOpen}>
          <div className="tickets-timeline-steps">
            <Steps progressDot direction="vertical">
                {timeline.map(item=>(<Steps.Step title={<div className="tickets-timeline-step">
                    <div className="tickets-timeline-step-title">{i18n.resolvedLanguage === 'en' ? item.changeStatusObj?.nameEn : item.changeStatusObj?.nameAr}</div>
                    {!['Completed', 'Cancelled'].includes(item.changeStatusObj.nameEn || '') && (
                        <div className="tickets-timeline-step-item">
                            <User2 /> 
                            <div>
                                <div>
                                    {['Reopen', 'Ticket Submitted'].includes(item.changeStatusObj?.statusName || '') && `${t("Customer.ticketsDetails.ticketTimeline.submittedBy")}: ${item.handlUserName}`}
                                    {['Ticket Created'].includes(item.changeStatusObj?.statusName || '') && `${t("Customer.ticketsDetails.ticketTimeline.createdBy")}: ${item.createdUerName}`}
                                    {['Open', 'Department Processing', 'Department Processed', 'Pending Customer','Resolved'].includes(item.changeStatusObj?.statusName || '') && `${t("Customer.ticketsDetails.ticketTimeline.currentHandler")}: ${item.handlUserName}`}
                                    {/* {['Resolved'].includes(item.changeStatusObj?.nameEn || '') && `${t("Customer.ticketsDetails.ticketTimeline.currentHandler")}: ${item.createdUerName}`} */}
                                </div>
                                <div>
                                    <span className="tickets-department-name">
                                        {item.departmentName}
                                    </span>
                                </div>
                            </div> 
                        </div>
                    )}
                    <div className="tickets-timeline-step-item"><Time />{item.changeOnTime ? moment(item.changeOnTime).format('DD/MM/YYYY HH:mm:ss') : ''}</div>
                    {['Pending Customer', 'Resolved'].includes(item?.changeStatusObj?.statusName || '') && (     
                        <div className="tickets-timeline-step-item">
                            <Reassign />
                            <Popover
                                overlayClassName="tickets-timeline-popover"
                                overlayInnerStyle={popoverOverlayInnerStyle}
                                getPopupContainer={getPopoverContainer}
                                content={renderPopoverContent(`${item.createdUerName} ${t("Customer.ticketsDetails.ticketTimeline.changedStatusDes")} ${i18n.resolvedLanguage === 'ar' ? item?.changeStatusObj?.nameAr : item.changeStatusObj?.nameEn}`)}
                            >
                                {/* <div>
                                    {t("Customer.ticketsDetails.ticketTimeline.changedStatusTo")}
                                    <span className="_tip_color">{item.changeStatusObj?.nameEn}</span>
                                </div> */}

                               <div className="text-ellipsis">
                                            <span>
                                                <Trans
                                                    i18nKey="Customer.ticketsDetails.ticketTimeline.changedStatusTo"
                                                    values={{
                                                        actorName: item.createdUerName,
                                                        statusLabel: item.changeStatusObj?.statusName == 'Resolved' ? t("Customer.ticketsDetails.ticketTimeline.resolved") : t("Customer.ticketsDetails.ticketTimeline.pendingcustomer"),
                                                    }}
                                                    components={{
                                                        status: <span className="_tip_color" />,
                                                    }}
                                                />
                                            </span>

                                    </div>
                            </Popover>
                        </div>
                    )}
                    {
                        ['Department Processing'].includes(item?.changeStatusObj?.statusName || '') && (
                            <div className="tickets-timeline-step-item">
                                <Reassign />
                                <Popover
                                    overlayClassName="tickets-timeline-popover"
                                    overlayInnerStyle={popoverOverlayInnerStyle}
                                    getPopupContainer={getPopoverContainer}
                                    content={renderPopoverContent(
                                        item.enqiryProcessInfo && item.enqiryProcessInfo?.sourceTypeId === 7
                                            ? `${t("Customer.ticketsDetails.ticketTimeline.autoTransferredTo")} ${item.handlUserName}`
                                            : `${item.createdUerName} ${t("Customer.ticketsDetails.ticketTimeline.ProcessingDes")} ${item.handlUserName}`
                                    )}
                                >
                                    <div className="text-ellipsis">
                                        {item.enqiryProcessInfo && item.enqiryProcessInfo?.sourceTypeId === 7 ? (
                                            <span>
                                                {t("Customer.ticketsDetails.ticketTimeline.autoTransferredTo") + ' '}
                                                <span>{item.handlUserName}</span>
                                            </span>
                                        ) : (
                                            <span>
                                                <Trans
                                                    i18nKey="Customer.ticketsDetails.ticketTimeline.departmentProcessingTransferred"
                                                    values={{
                                                        actorName: item.createdUerName,
                                                        statusLabel: t("Customer.ticketsDetails.ticketTimeline.departmentProcessing"),
                                                        transferTarget: item.handlUserName,
                                                    }}
                                                    components={{
                                                        status: <span className="_tip_color" />,
                                                    }}
                                                />
                                            </span>
                                            
                                        )}
                                    </div>
                                </Popover>
                            </div>
                        )
                    }
                    {
                        ['Department Processed'].includes(item?.changeStatusObj?.statusName || '') && (
                            <div className="tickets-timeline-step-item">
                                <Reassign />
                                <Popover
                                    overlayClassName="tickets-timeline-popover"
                                    overlayInnerStyle={popoverOverlayInnerStyle}
                                    getPopupContainer={getPopoverContainer}
                                    content={renderPopoverContent(`${item.createdUerName} ${t("Customer.ticketsDetails.ticketTimeline.ProcessedDes")} ${item.handlUserName}`)}
                                >
                                    <div className="text-ellipsis">
                                            <span>
                                                <Trans
                                                    i18nKey="Customer.ticketsDetails.ticketTimeline.departmentProcessedTransferred"
                                                    values={{
                                                        actorName: item.createdUerName,
                                                        transferTarget: item.handlUserName,
                                                    }}
                                                    components={{
                                                        status: <span className="_tip_color" />,
                                                    }}
                                                />
                                            </span>
                                        {/* {item.enqiryProcessInfo && item.enqiryProcessInfo?.sourceTypeId === 6 ? (
                                        ) : (
                                            <span>
                                                <Trans
                                                    i18nKey="Customer.ticketsDetails.ticketTimeline.departmentProcessedTransferred"
                                                    values={{
                                                        actorName: item.createdUerName,
                                                        transferTarget: item.handlUserName,
                                                    }}
                                                    components={{
                                                        status: <span className="_tip_color" />,
                                                    }}
                                                />
                                            </span>
                                            
                                        )} */}
                                    </div>
                                </Popover>
                            </div>
                        )
                    }
                    {['Cancelled', 'Completed'].includes(item?.changeStatusObj?.statusName || '') && (     
                        <div className="tickets-timeline-step-item">
                            <Reassign />
                            <Popover
                                overlayClassName="tickets-timeline-popover"
                                overlayInnerStyle={popoverOverlayInnerStyle}
                                getPopupContainer={getPopoverContainer}
                                content={renderPopoverContent(`${t("Customer.ticketsDetails.ticketTimeline.completed")}`)}
                            >
                                {/* <div>
                                    {t("Customer.ticketsDetails.ticketTimeline.changedStatusTo")}
                                    <span className="_tip_color">{item.changeStatusObj?.nameEn}</span>
                                </div> */}

                               <div className="text-ellipsis">
                                            <span>
                                                <Trans
                                                    i18nKey={item.changeStatusObj?.statusName == 'Completed'
                                                        ? 'Customer.ticketsDetails.ticketTimeline.completed'
                                                        : 'Customer.ticketsDetails.ticketTimeline.cancelled'
                                                            }
                                                    values={{
                                                        statusLabel: item.handleDes,
                                                    }}
                                                />
                                            </span>
                                    </div>
                            </Popover>
                        </div>
                    )}
                    {['Open'].includes(item?.changeStatusObj?.statusName || '') && (     
                        <div className="tickets-timeline-step-item">
                            <Reassign />
                            <Popover
                                overlayClassName="tickets-timeline-popover"
                                overlayInnerStyle={popoverOverlayInnerStyle}
                                getPopupContainer={getPopoverContainer}
                                content={renderPopoverContent(`${t("Customer.ticketsDetails.ticketTimeline.automaticallyopendes")} ${item?.handlUserName}`)}
                            >
                                {/* <div>
                                    {t("Customer.ticketsDetails.ticketTimeline.changedStatusTo")}
                                    <span className="_tip_color">{item.changeStatusObj?.nameEn}</span>
                                </div> */}

                               <div className="text-ellipsis">
                                       
                                            <span>
                                                <Trans
                                                    i18nKey="Customer.ticketsDetails.ticketTimeline.automaticallyopen"
                                                    values={{
                                                        actorName: item.handlUserName,
                                                    }}
                                                />
                                            </span>
                                    </div>
                            </Popover>
                        </div>
                    )}
                    {
                        item.handleDes && !['Pending Customer', 'Resolved', 'Department Processing', 'Cancelled', 'Completed','Open','Department Processed'].includes(item?.changeStatusObj?.statusName || '') && (
                            <div className="tickets-timeline-step-item">
                                <Reassign />
                                <Popover
                                    overlayClassName="tickets-timeline-popover"
                                    overlayInnerStyle={popoverOverlayInnerStyle}
                                    getPopupContainer={getPopoverContainer}
                                    content={renderPopoverContent(item.handleDes)}
                                >
                                    <div className="text-ellipsis">{item.handleDes}</div>
                                </Popover>
                            </div>
                        )
                    }
                    {(item.enqiryProcessInfo?.note || item.reason ) && (
                     <hr style={{margin: '12px'}} />
                    )}
                    {
                        item.enqiryProcessInfo?.problemCauseObj && (
                            <div className="tickets-timeline-step-item">
                                <Reassign />
                                <div className="tickets-Problem-Cause">
                                    {t("Customer.ticketsDetails.ticketTimeline.problemCause")}: <span className="_tip_color"> {i18n.resolvedLanguage === 'en' ? item.enqiryProcessInfo?.problemCauseObj.nameEn : item.enqiryProcessInfo?.problemCauseObj.nameAr}</span>
                            </div>
                            </div>
                        )
                    }
                    {
                        item.reason && (
                            <Popover
                                overlayClassName="tickets-timeline-popover"
                                overlayInnerStyle={popoverOverlayInnerStyle}
                                getPopupContainer={getPopoverContainer}
                                content={renderPopoverContent(item?.reason || '')}
                            >
                                <div className="tickets-timeline-step-item tickets-timeline-step-note">
                                    {item?.reason || ''}
                                </div>
                            </Popover>
                        )
                    }

                    <Popover
                        overlayClassName="tickets-timeline-popover"
                        overlayInnerStyle={popoverOverlayInnerStyle}
                        getPopupContainer={getPopoverContainer}
                        content={renderPopoverContent(item?.enqiryProcessInfo?.note || '')}
                    >
                        <div className="tickets-timeline-step-item tickets-timeline-step-note">
                            {item?.enqiryProcessInfo?.note || ''}
                        </div>
                    </Popover>


                    {/* <div className="tickets-timeline-step-item tickets-timeline-step-note">
                        {item?.enqiryProcessInfo?.note || ''}
                    </div> */}


                    {renderTimelineAttachments(item.enqiryProcessInfo?.attachmentUrls)}
                </div>} />))}
            </Steps>
          </div>
        </div>
        <Modal
            visible={selectedAttachments.length > 0}
            title={t("Customer.ticketsDetails.ticketTimeline.attachments")}
            onCancel={() => setSelectedAttachments([])}
            footer={null}
            width={960}
            centered
            destroyOnClose
            className="tickets-timeline__attachments-modal"
        >
            <InspectionAttachmentGrid
                attachments={selectedAttachments.map((fileUrl) => ({ fileUrl }))}
                className="tickets-timeline__attachments-grid inspection-attachment-grid--two-columns"
            />
        </Modal>
    </section>
}
