import React, { useState, useEffect } from "react";
import { Modal } from "antd";
import WebIcon from "@/assets/icons/WebIcon";
import { useTranslation } from "react-i18next";
import "./index.less";
interface Props {
    visible: boolean;
    onCancel: () => void;
    content: React.ReactNode; // or any other type that suits your needs
}

const PreviewModal: React.FC<Props> = ({
    visible,
    onCancel,
    content
}) => {
    const { t } = useTranslation();
    const [lan, setLan] = useState<string>("en");
    const [equipment, setEquipment] = useState<string>("web");
    return (
        <Modal
            className="preview-modal"
            title={t("CMS.common.preview")}
            width="100%"
            centered
            style={{ top: 0, paddingBottom: 0 }}
            wrapClassName="page-preview-modal"
            footer={false}
            visible={visible}
            onCancel={onCancel}
        >
            <div className="preview-box">
                <div className="select-line">
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
                    <div className="lan lan2">
                        <div
                            className={equipment == "web" ? "lanitem active" : "lanitem"}
                            onClick={() => setEquipment("web")}
                        >
                            <WebIcon />
                            {t("CMS.common.web")}
                        </div>
                        <div
                            className={equipment == "tablet" ? "lanitem active" : "lanitem"}
                            onClick={() => setEquipment("tablet")}
                        >
                            {t("CMS.common.tablet")}
                        </div>
                        <div
                            className={equipment == "mobile" ? "lanitem active" : "lanitem"}
                            onClick={() => setEquipment("mobile")}
                        >
                            {t("CMS.common.mobile")}
                        </div>
                    </div>
                </div>
                <div className="preview-content">{content}</div>
            </div>
        </Modal>
    )
};

export default PreviewModal;