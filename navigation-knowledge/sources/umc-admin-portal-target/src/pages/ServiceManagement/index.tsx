import { useTranslation } from "react-i18next";

export default function ServiceManagement(){
    const { t } = useTranslation();
    return (
        <div>
            <h1>{t("menu.serviceManagement")}</h1>
        </div>
    )
}
