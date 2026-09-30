import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import infoCircleIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_circle.svg";
import infoMarkIcon from "@/pages/CustomerRefunds/assets/icons/change_status_info_mark.svg";
import "./index.less";

export default function AttachmentFormLabel() {
    const { t } = useTranslation();

    return (
        <span className="ticket-attachment-form-label">
            {t("Customer.tickets.addModal.attachments")}{" "}
            <Tooltip title={t("Customer.tickets.upload.tip")}>
                <span
                    className="ticket-attachment-form-label__info"
                    role="img"
                    aria-label={t("Customer.tickets.upload.tip")}
                >
                    <img
                        src={infoCircleIcon}
                        alt=""
                        className="ticket-attachment-form-label__circle"
                    />
                    <img
                        src={infoMarkIcon}
                        alt=""
                        className="ticket-attachment-form-label__mark"
                    />
                </span>
            </Tooltip>
        </span>
    );
}
