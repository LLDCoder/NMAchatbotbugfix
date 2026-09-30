import { useTranslation } from "react-i18next";

export default function FinancialPayment(){
    const { t } = useTranslation();
    return (
        <div>
            <h1>{t("menu.financialPayment")}</h1>
        </div>
    )
}
