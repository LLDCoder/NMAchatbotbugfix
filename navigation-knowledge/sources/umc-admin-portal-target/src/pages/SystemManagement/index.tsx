
import { useTranslation } from "react-i18next";

export default function SystemManagement(){
    const { t } = useTranslation();
    return (
        <div>
            {t("menu.systemManagement")}
        </div>
    )
}
