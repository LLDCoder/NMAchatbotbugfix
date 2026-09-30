import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import EstablishmentInfo from './EstablishmentInfo';
import EstablishmentDocuments from "./EstablishmentDocuments";
import LegalPersonInfo from "./LegalPersonInfo";
import AddressInfo from "./AddressInfo";
import PartnerList from "@/components/BusinessCmps/PartnerList/PartnerList";

interface ModalObject {
  visible: boolean;
  cancle: () => void;
}

export default function EstablishmentModal({ visible, cancle }: ModalObject) {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      title={t("Licensing.details.tabs.establishmentOverview")}
      width={960}
      style={{ width: '960px' }}
      visible={visible}
      footer={false}
      onCancel={() => {
        cancle();
      }}
    >
      <div
        style={{
          height: '680px',
          overflow: 'auto',
          overflowY: 'scroll',
          scrollbarWidth: '4px',
        }}
      >
        <EstablishmentInfo params={{}} />
        <EstablishmentDocuments params={{}} />
        <LegalPersonInfo params={{}} />
        <AddressInfo params={{}} />
        <PartnerList params={[]} />
      </div>
    </Modal>
  );
}
