import type { IApplicationDeliveryInfo } from "@/services/application";

type ReviewDetailWithDelivery = {
  deliveryInfo?: IApplicationDeliveryInfo | null;
};

export type ApplicationDeliveryState = {
  taskId: string;
  data: IApplicationDeliveryInfo | null;
};

const text = (value: string | null | undefined) => value?.trim() || "";

export const resolveApplicationDeliveryInformation = (
  reviewDetail: ReviewDetailWithDelivery | null | undefined,
) => reviewDetail?.deliveryInfo ?? null;

export const resolveActiveTaskDeliveryInformation = (
  state: ApplicationDeliveryState | null,
  taskId: string | null,
) => (state?.taskId === taskId ? state.data : null);

export const buildApplicationDeliveryDisplay = (
  deliveryInfo: IApplicationDeliveryInfo,
  isArabic: boolean,
) => ({
  courierService: text(
    isArabic
      ? deliveryInfo.courierNameAr
      : deliveryInfo.courierNameEn,
  ),
  recipientName: text(deliveryInfo.recipientName),
  mobileNumber: text(deliveryInfo.mobile),
  address: text(isArabic ? deliveryInfo.addressAr : deliveryInfo.addressEn),
});
