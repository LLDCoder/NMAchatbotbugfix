import React from "react";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import { exportPhotographyApplicationForm } from "@/services/photographyDocumentExport";

interface BasicInformationExportButtonProps {
  /** Identifies the application whose Basic Information section is exported. */
  applicationId?: number;
}

const BasicInformationExportButton: React.FC<
  BasicInformationExportButtonProps
> = ({ applicationId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);

  const handleExport = async () => {
    if (loading) return;
    if (applicationId == null) return;
    setLoading(true);
    try {
      await exportPhotographyApplicationForm(applicationId);
    } catch (error) {
      console.error("Failed to export basic information:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomButton
      variant="primary"
      size="medium"
      loading={loading}
      onClick={handleExport}
    >
      {t("common.export")}
    </CustomButton>
  );
};

export default BasicInformationExportButton;
