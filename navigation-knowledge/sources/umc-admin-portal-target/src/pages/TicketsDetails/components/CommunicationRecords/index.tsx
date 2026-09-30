import DefaultAvatar from "@/assets/images/tickets-chat-avatar-placeholder.png";
import Paperclip from "@/assets/icons/Paperclip";
import "./index.less";
import { Divider, Input, Tabs, Upload } from "antd";
import DocumentViewer from "@/components/common/DocumentViewer";
import { CustomButton, CustomMessage } from "@/components/common";
import type { RcFile } from "antd/lib/upload";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FileItem } from "@/components/common/FileUpload";
import { fileUpload } from "@/services/media";
import { postConversation, type EnquiryConversation } from "@/services/tickets";
import moment from "moment";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import NoMessages from "@/assets/icons/NoMessages";
import More from "@/assets/images/more.png";
import { useTranslation } from "react-i18next";
import { canShowTicketChatInput } from "@/pages/TicketsDetails/utils/canShowTicketChatInput";
import { scrollWhenReady } from "@/utils/scrollPageContent";
import { getVisibleTicketConversations } from "@/pages/Tickets/utils/ticketVisibility";

interface ICommunicationRecordsProps {
  status: number;
  records: Partial<EnquiryConversation>[];
  refresh: () => void;
  isCustomerHappness: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  scrollToInputRequest?: number;
  isCanMessage?: boolean | null;
  canAddInternalNote?: boolean | null;
}

const DEFAULT_VISIBLE_MESSAGE_COUNT = 3;
const RENDERABLE_SOURCE_TYPES = [1, 2, 3, 4, 5, 6, 7];

export default function CommunicationRecords({
  isCustomerHappness,
  status,
  records,
  refresh,
  isExpanded,
  onExpand,
  onCollapse,
  scrollToInputRequest = 0,
  isCanMessage,
  canAddInternalNote,
}: ICommunicationRecordsProps) {
  const { t } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const isTeamTaskTodo = urlParams.get("from") === "TeamTasks-todo";
  const chatInputRef = useRef<HTMLDivElement>(null);
  const accessibleRecords = getVisibleTicketConversations(
    records,
    isCustomerHappness,
  );
  const shouldShowToggle =
    accessibleRecords.length > DEFAULT_VISIBLE_MESSAGE_COUNT;
  const visibleRecords = isExpanded
    ? accessibleRecords
    : accessibleRecords.slice(-DEFAULT_VISIBLE_MESSAGE_COUNT);
  const canShowChatInput = canShowTicketChatInput({
    isTeamTaskTodo,
    isCustomerHappness,
    status,
  });
  const shouldShowChatInput =
    (canShowChatInput && isCanMessage == true) ||
    canAddInternalNote === true;

  useEffect(() => {
    if (!scrollToInputRequest || !shouldShowChatInput) {
      return;
    }

    return scrollWhenReady(() => chatInputRef.current, { offset: 80 });
  }, [shouldShowChatInput, scrollToInputRequest]);

  function renderChatBoxItem(list: Partial<EnquiryConversation>[]) {
    const renderableList = list.filter((item) =>
      RENDERABLE_SOURCE_TYPES.includes(item.surceTypeId || 0),
    );

    return renderableList.map((item, index) => {
      const isLastItem = index === renderableList.length - 1;
      const recordKey = `${item.submissionTime || "message"}-${
        item.userId || item.userName || index
      }-${index}`;

      switch (item.surceTypeId) {
        case 1:
        case 2:
          return (
            <ChatBoxItem
              key={recordKey}
              record={item}
              hideDivider={isLastItem}
            />
          );
        case 3:
        case 6:
        case 5:
        case 7:
          return (
            <TooltipItem
              key={recordKey}
              record={item}
              hideDivider={isLastItem}
            />
          );
        case 4:
          return (
            <MyChatBoxItem
              key={recordKey}
              record={item}
              hideDivider={isLastItem}
            />
          );
        default:
          return null;
      }
    });
  }
  function renderChatBox() {
    if (accessibleRecords.length > 0) {
      return (
        <>
          {!isExpanded && shouldShowToggle && (
            <div
              className="communication-records-show-more"
              onClick={onExpand}
            >
              <div className="show-more-icon">
                <img src={More} alt="" />
              </div>
              <div className="show-more-text">
                {t("Customer.ticketsDetails.communication.showMoreMessages")}
              </div>
            </div>
          )}
          {renderChatBoxItem(visibleRecords)}
          {isExpanded && shouldShowToggle && (
            <div
              className="communication-records-show-more communication-records-show-more-collapse"
              onClick={onCollapse}
            >
              <div className="show-more-icon">
                <img src={More} alt="" />
              </div>
              <div className="show-more-text">
                {t("Customer.ticketsDetails.communication.collapseHistory")}
              </div>
            </div>
          )}
        </>
      );
    } else {
      return (
        <div className="communication-records-empty">
          <div className="empty-icon">
            <NoMessages />
          </div>
          <div className="empty-text">
            {t("Customer.ticketsDetails.communication.noMessagesYet")}
          </div>
        </div>
      );
    }
  }
  return (
    <div className="communication-records">
      <div className="tickets-details-section-title">
        {t("Customer.ticketsDetails.communication.title")}
      </div>
      <div className="chat-box">{renderChatBox()}</div>
      {shouldShowChatInput && (
        <ChatInput
          inputRef={chatInputRef}
          isCustomerHappness={isCustomerHappness}
          status={status}
          refresh={refresh}
          canAddInternalNote={canAddInternalNote}
        />
      )}
    </div>
  );
}
interface IChatInputProps {
  refresh: () => void;
  status: number;
  isCustomerHappness: boolean;
  inputRef?: RefObject<HTMLDivElement>;
  canAddInternalNote?: boolean | null;
}
function ChatInput({
  isCustomerHappness,
  status,
  refresh,
  inputRef,
  canAddInternalNote,
}: IChatInputProps) {
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState("1");
  const { t } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const canSend = Boolean(message.trim()) || fileList.length > 0;

  useEffect(() => {
    setActiveKey(isCustomerHappness ? "1" : "2");
  }, [isCustomerHappness]);
  function beforeUpload(file: RcFile) {
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const fileName = file.name;
    const fileExt = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const isExtValid = allowedExtensions.includes(fileExt);

    if (!isExtValid) {
      CustomMessage.error(
        t("Customer.ticketsDetails.communication.invalidFileFormat"),
      );
    }
    return isExtValid;
  }
  async function handleUpload(options: UploadRequestOption) {
    if (fileList.length === 3) {
      CustomMessage.error(
        t("Customer.ticketsDetails.communication.maxFilesError"),
      );
      return;
    }
    const { file } = options;
    // @ts-ignore
    if (file.size / 1024 / 1024 > 5) {
      CustomMessage.error(
        t("Customer.ticketsDetails.communication.maxFileSizeError"),
      );
      return;
    }
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      const newFile: FileItem = {
        url: res.data[0],
        //@ts-ignore
        name: file.name,
      };
      const newFileList = [...fileList, newFile];
      setFileList(newFileList);
      CustomMessage.success(
        t("Customer.ticketsDetails.communication.fileUploaded"),
      );
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }

  async function handleSend() {
    const id = urlParams.get("id");
    if (!id) return;
    try {
      setLoading(true);
      const attachments = fileList.map((file) => file.url);
      await postConversation(Number(id), {
        sourceTypeId: activeKey === "1" ? 2 : 4,
        messageContent: message,
        attachments,
      });
      setMessage("");
      setFileList([]);
      refresh();
      CustomMessage.success(
        t("Customer.ticketsDetails.communication.sendSuccessful"),
      );
    } catch (error) {
      console.error("Failed to send ticket communication:", error);
      CustomMessage.error(t("common.operationFailed"));
    }
     finally {
      setLoading(false);
    }
  }
  const ele = [];
  if (isCustomerHappness) {
    ele.push(
      <Tabs.TabPane
        tab={t("Customer.ticketsDetails.communication.replyToCustomer")}
        key="1"
      />,
    );
    if (status === 3) {
      ele.push(
        <Tabs.TabPane
          tab={t("Customer.ticketsDetails.communication.internalNote")}
          key="2"
        />,
      );
    }
  } else {
    ele.push(
      <Tabs.TabPane
        tab={t("Customer.ticketsDetails.communication.internalNote")}
        key="2"
      />,
    );
  }
  return (
    <div className="chat-box-input-wrapper" ref={inputRef}>
      <div className="chat-box-input">
        {canAddInternalNote !== true && (
          <div className="chat-box-input-tabs">
            <Tabs activeKey={activeKey} onChange={setActiveKey}>
              {ele}
            </Tabs>
          </div>
        )}
        <div className="chat-box-input-textarea-wrapper">
          <Input.TextArea
            className="chat-box-input-textarea"
            value={message}
            maxLength={1000}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
            rows={3}
            placeholder={
              activeKey === "1"
                ? t("Customer.ticketsDetails.communication.replyToCustomer")
                : t(
                    "Customer.ticketsDetails.communication.internalNotePlaceholder",
                  )
            }
          />
          {fileList.length > 0 && (
            <div className="chat-box-input-attachment">
              {fileList.map((file, index) => {
                return (
                  <DocumentViewer
                    hasDelete
                    onDelete={() => {
                      const newFileList = fileList.filter(
                        (_, i) => i !== index,
                      );
                      setFileList(newFileList);
                    }}
                    hasDownload={false}
                    hasView
                    fileName={file.name}
                    fileUrl={file.url}
                  />
                );
              })}
            </div>
          )}
          <div className="chat-box-send-wrapper">
            <div className="chat-box-input-char-count">
              {message.length}/1000
            </div>
            <div className="chat-box-send-actions">
              <Upload
                beforeUpload={beforeUpload}
                maxCount={3}
                showUploadList={false}
                customRequest={handleUpload}
                accept=".jpg,.jpeg,.png,.pdf"
              >
                <div
                  className={`chat-box-send-attachment ${
                    fileList.length === 3 ? "disabled" : ""
                  }`}
                  onClick={(e) => {
                    if (fileList.length === 3) {
                      e.stopPropagation();
                    }
                  }}
                >
                  <Paperclip />
                </div>
              </Upload>
              <div>
                <CustomButton
                  loading={loading}
                  disabled={!canSend}
                  onClick={handleSend}
                  text={t("common.send")}
                  permissionCode="CustomerModule.Tickets.TicketsDetails.Send"
                  permissionRoutePath="/happiness/tickets/tickets-details"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface IMyChatBoxItemProps {
  record: {
    photoUrl?: string;
    userName?: string;
    submissionTime?: string;
    messageContent?: string;
    attachements?: string[];
    departmentInfoObj?: {
      id: number;
      nameAr: string;
      nameEn: string;
    };
  };
  hideDivider?: boolean;
}
function MyChatBoxItem({ record, hideDivider }: IMyChatBoxItemProps) {
  const { i18n, t } = useTranslation();
  return (
    <div className="my-chat-box-item">
      <div className="my-chat-box-item-content">
        <div className="my-chat-box-item-top-row">
          <div className="my-chat-box-item-icon">
            <AuthenticatedDocumentImage
              src={record.photoUrl}
              fallbackSrc={DefaultAvatar}
              alt=""
            />
          </div>
          <div className="my-chat-box-item-header">
            <div className="my-chat-box-item-head-main">
              <span className="my-chat-box-item-name">{record.userName}</span>
              <div className="my-chat-box-item-tags">
                <span className="my-chat-box-item-type">
                  {i18n.resolvedLanguage === "en"
                    ? record.departmentInfoObj?.nameEn
                    : record.departmentInfoObj?.nameAr}
                </span>
              </div>
            </div>
            <div className="my-chat-box-item-time">
              <span className="my-chat-box-item-tag">
                {t("Customer.ticketsDetails.communication.internalNote")}
              </span>
              {record.submissionTime
                ? moment(record.submissionTime).format("DD/MM/YYYY HH:mm:ss")
                : ""}
            </div>
          </div>
        </div>
        <div className="my-chat-box-item-msg">{record.messageContent}</div>
        {Array.isArray(record.attachements) &&
          record.attachements.length > 0 && (
            <div className="my-chat-box-attachments">
              {record.attachements.map((item) => {
                return <DocumentViewer fileName={item} hasDownload />;
              })}
            </div>
          )}
        {!hideDivider && <Divider className="chat-box-divider" />}
      </div>
    </div>
  );
}

interface IChatBoxItemProps {
  record: {
    photoUrl?: string;
    userName?: string;
    surceTypeId?: number;
    submissionTime?: string;
    messageContent?: string;
    attachements?: string[];
  };
  hideDivider?: boolean;
}
function ChatBoxItem({ record, hideDivider }: IChatBoxItemProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`chat-box-item ${
        record.surceTypeId === 1 ? "chat-box-item-customer" : ""
      }`}
    >
      <div className="chat-box-item-content">
        <div className="chat-box-item-top-row">
          <div className="chat-box-item-icon">
            <AuthenticatedDocumentImage
              src={record.photoUrl}
              fallbackSrc={DefaultAvatar}
              alt=""
            />
          </div>
          <div className="chat-box-item-header">
            <div className="chat-box-item-head-main">
              <div className="chat-box-item-name">{record.userName}</div>
              <div className="chat-box-item-tags">
                <div className="chat-box-item-type">
                  {record.surceTypeId === 2
                    ? t(
                        "Customer.ticketsDetails.communication.customerHappiness",
                      )
                    : t("Customer.ticketsDetails.communication.customer")}
                </div>
              </div>
            </div>
            <div className="chat-box-item-time">
              {record.submissionTime
                ? moment(record.submissionTime).format("DD/MM/YYYY HH:mm:ss")
                : ""}
            </div>
          </div>
        </div>
        <div className="chat-box-item-msg">{record.messageContent}</div>
        {Array.isArray(record.attachements) &&
          record.attachements.length > 0 && (
            <div className="chat-box-attachments">
              {record.attachements.map((item) => {
                return <DocumentViewer fileName={item} hasDownload />;
              })}
            </div>
          )}
        {!hideDivider && <Divider className="chat-box-divider" />}
      </div>
    </div>
  );
}
interface ITooltipItemProps {
  record: {
    userName?: string;
    submissionTime?: string;
    messageContent?: string;
    departmentDeadLine?: string;
    departmentProcessTypeId?: number;
    surceTypeId?: number;
    departmentInfoObj?: {
      id: number;
      nameAr: string;
      nameEn: string;
    };
    problemCauseObj: any;
    attachements?: string[];
    transferDepartmentInfoObj?: {
      id: number;
      nameAr: string;
      nameEn: string;
    };
  };
  hideDivider?: boolean;
}
function TooltipItem({ record, hideDivider }: ITooltipItemProps) {
  const { i18n, t } = useTranslation();
  console.log("record", record);
  return (
    <>
      <div className="tooltip-item">
        <div className="tooltip-item-header">
          <div className="tooltip-item-head-main">
            <div className="tooltip-item-header-name-wrapper">
              <div className="tooltip-item-header-name">
                {record?.surceTypeId === 7 &&
                  t("Customer.ticketsDetails.communication.transferDepartment")}
                {record?.surceTypeId === 3 &&
                  t("Customer.ticketsDetails.communication.changeStatus")}
                {record?.surceTypeId === 5 &&
                  t("Customer.ticketsDetails.communication.ticketProcessed")}
                {record?.surceTypeId === 6 &&
                  t("Customer.ticketsDetails.communication.ticketSentBack")}

                {record?.surceTypeId && [5, 6].includes(record?.surceTypeId) ? (
                  <span>
                    {i18n.resolvedLanguage === "en"
                      ? record.departmentInfoObj?.nameEn
                      : record.departmentInfoObj?.nameAr}
                  </span>
                ) : (
                  <span>
                    {i18n.resolvedLanguage === "en"
                      ? record.transferDepartmentInfoObj?.nameEn
                      : record.transferDepartmentInfoObj?.nameAr}
                  </span>
                )}
                {record?.surceTypeId === 3 &&
                  t(
                    "Customer.ticketsDetails.communication.byCustomerHappiness",
                  )}
              </div>
            </div>
          </div>
          <div className="tooltip-item-header-time">
            <div className="tooltip-item-tags">
              <div className="tooltip-item-header-tag">
                {t("Customer.ticketsDetails.communication.internalNote")}
              </div>
            </div>
            <div>
              {record.submissionTime
                ? moment(record.submissionTime).format("DD/MM/YYYY HH:mm:ss")
                : ""}
            </div>
          </div>
        </div>
        {record?.problemCauseObj ? (
          <div className="tooltip-item-problem-cause">
            {t("Customer.ticketsDetails.communication.problemCause")}:{" "}
            <span className="tooltip-item-problem-cause-name">
              {i18n.resolvedLanguage === "en"
                ? record.problemCauseObj?.nameEn
                : record.problemCauseObj?.nameAr}
            </span>
          </div>
        ) : null}
        <div className="tooltip-item-msg">{record.messageContent}</div>
        {!!record.departmentDeadLine && (
          <div className="tooltip-item-deadline-wrapper">
            <span className="tooltip-item-deadline-title">
              {t("Customer.ticketsDetails.communication.responseDeadline")}:
            </span>
            <span className="tooltip-item-deadline-time" dir="ltr">
              {moment(record.departmentDeadLine).format("DD/MM/YYYY HH:mm:ss")}
            </span>
          </div>
        )}
      </div>
      {Array.isArray(record.attachements) && record.attachements.length > 0 && (
        <div className="tooltip-item-attachments">
          {record.attachements.map((item) => {
            return <DocumentViewer fileName={item} hasDownload />;
          })}
        </div>
      )}
      {!hideDivider && (
        <div className="tooltip-divider">
          <Divider className="chat-box-divider" />
        </div>
      )}
    </>
  );
}
