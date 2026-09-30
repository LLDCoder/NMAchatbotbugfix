import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import PaymentsList from "./components/PaymentsList";
import './index.less';
export default function Transactions(){
    const { t } = useTranslation();
    return <div className="transactions">
        <Tabs
            defaultActiveKey='1'
            className="custom-tabs"
        >
            <Tabs.TabPane tab={t("Finance.transactions.tabs.payments")} key="1" />
        </Tabs>
        <PaymentsList />
    </div>
}
