import React from "react";
import { useTranslation } from "react-i18next";
import type { IApplicationDeliveryInfo } from "@/services/application";
import { buildApplicationDeliveryDisplay } from "./viewModel";
import "./index.less";

type DeliveryInformationProps = {
  deliveryInfo: IApplicationDeliveryInfo;
};

const DeliveryInformation: React.FC<DeliveryInformationProps> = ({
  deliveryInfo,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.toLowerCase().startsWith("ar");
  const display = buildApplicationDeliveryDisplay(deliveryInfo, isArabic);
  const items = [
    {
      key: "courierService",
      label: t("applications.details.deliveryInformation.courierService"),
      value: display.courierService,
    },
    {
      key: "recipientName",
      label: t("applications.details.deliveryInformation.recipientName"),
      value: display.recipientName,
    },
    {
      key: "mobileNumber",
      label: t("applications.details.deliveryInformation.mobileNumber"),
      value: display.mobileNumber,
    },
    {
      key: "address",
      label: t("applications.details.deliveryInformation.address"),
      value: display.address,
    },
  ];

  return (
    <section className="application-delivery-card">
      <h3 className="application-delivery-card__title">
        {t("applications.details.deliveryInformation.title")}
      </h3>
      <dl className="application-delivery-card__list">
        {items.map((item) => (
          <div className="application-delivery-card__item" key={item.key}>
            <dt className="application-delivery-card__label">{item.label}</dt>
            <dd
              className="application-delivery-card__value"
              dir={item.key === "mobileNumber" ? "ltr" : undefined}
            >
              {item.value || "-"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default DeliveryInformation;
