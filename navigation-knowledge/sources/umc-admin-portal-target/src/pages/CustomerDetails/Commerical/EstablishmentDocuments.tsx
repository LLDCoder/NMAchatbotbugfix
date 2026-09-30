import { Row, Col } from "antd";
import DocumentViewer from "@/components/common/DocumentViewer";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function EstablishmentDocuments({ params }: any) {
  const { t } = useTranslation();

  const imgUrlName = (str: string) => {
    if (!str) {
      return;
    }
    const arr = str.split("/");
    return arr[arr.length - 1];
  };

  return (
    <div className="establishment-documents">
      <h3>{t("Licensing.details.establishmentDocuments.title")}</h3>
      <Row gutter={[16, 24]}>
        <Col span={12}>
          <div className="_label">{t("Licensing.details.establishmentDocuments.powerOfAttorney")}</div>
          <div className="_document">
            <DocumentViewer
              fileName={imgUrlName(params?.powerOfAttorneyCopyUrl)}
              fileUrl={params?.powerOfAttorneyCopyUrl}
              hasView={Boolean(params?.powerOfAttorneyCopyUrl)}
              hasDownload={Boolean(params?.powerOfAttorneyCopyUrl)}
              key={params?.powerOfAttorneyCopyUrl || "empty"}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className="_label">{t("Licensing.details.establishmentDocuments.memorandumOfAssociation")}</div>
          <div className="_document">
            <DocumentViewer
              fileName={imgUrlName(params?.memorandumOfAssociationCopyUrl)}
              fileUrl={params?.memorandumOfAssociationCopyUrl}
              hasView={Boolean(params?.memorandumOfAssociationCopyUrl)}
              hasDownload={Boolean(params?.memorandumOfAssociationCopyUrl)}
              key={params?.memorandumOfAssociationCopyUrl || "empty"}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className="_label">{t("Licensing.details.establishmentDocuments.commercialLicense")}</div>
          <div className="_document">
            <DocumentViewer
              fileName={imgUrlName(params?.licenseCopyUrl)}
              fileUrl={params?.licenseCopyUrl}
              hasView={Boolean(params?.licenseCopyUrl)}
              hasDownload={Boolean(params?.licenseCopyUrl)}
              key={params?.licenseCopyUrl || "empty"}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className="_label">{t("Licensing.details.establishmentDocuments.tenancyContract")}</div>
          <div className="_document">
            <DocumentViewer
              fileName={imgUrlName(params?.tenancyContractCopyUrl)}
              fileUrl={params?.tenancyContractCopyUrl}
              hasView={Boolean(params?.tenancyContractCopyUrl)}
              hasDownload={Boolean(params?.tenancyContractCopyUrl)}
              key={params?.tenancyContractCopyUrl || "empty"}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
