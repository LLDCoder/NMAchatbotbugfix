import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Card, Col, Row } from "antd";
import { observer, useField } from "@formily/react";
import DocumentViewer from "@/components/common/DocumentViewer";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import {
  getAreaList,
  getEmirateList,
  getRegionList,
  type AreaItem,
  type EmirateItem,
  type RegionItem,
} from "@/services/address";
import i18n from "@/localization/config";
import { DISPLAY_DATE, fmt } from "@/utils/gstTime";
import {
  normalizeProfileFormReviewDocumentValue,
  resolveProfileFormReviewValue,
} from "./profileFormRules";
import "./reviewStyles.less";

type ProfileAddressReviewValue = {
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
};

type ProfileFormReviewValue = {
  establishmentSubTypes?: string;
  workEmail?: string;
  commercialLicenseNumber?: string;
  licenseExpiryDate?: string;
  establishmentNameArabic?: string;
  establishmentNameEnglish?: string;
  emirate?: string | number;
  establishmentEmirateName?: string;
  licensingAuthority?: string;
  phoneNumber?: string;
  tenancyContractEndDate?: string;
  commercialLicense?: unknown;
  tenancyContract?: unknown;
  memorandumOfAssociation?: unknown;
  powerOfAttorney?: unknown;
  hasTradeLicense?: boolean;
  reserveTradeNumber?: string;
  reserveTradeName?: unknown;
  addressPicker?: ProfileAddressReviewValue;
};

type ProfileFormReviewFormField = {
  value?: unknown;
  form: {
    values: Record<string, unknown>;
  };
};

type ProfileFormReviewFieldProps = {
  title?: unknown;
  titleEn?: unknown;
  titleAr?: unknown;
};

type AddressLookups = {
  emirates: EmirateItem[];
  regions: RegionItem[];
  areas: AreaItem[];
};

const EMPTY_ADDRESS_LOOKUPS: AddressLookups = {
  emirates: [],
  regions: [],
  areas: [],
};

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "-";
  return fmt(value, DISPLAY_DATE, value);
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "-";
}

export const ProfileFormReviewField: React.FC<ProfileFormReviewFieldProps> =
  observer(({ title, titleEn, titleAr }) => {
    const field = useField() as unknown as ProfileFormReviewFormField;
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const t = i18n.getFixedT(lang);
    const [addressLookups, setAddressLookups] =
      useState<AddressLookups>(EMPTY_ADDRESS_LOOKUPS);
    const displayValue = resolveProfileFormReviewValue(
      field.value,
      field.form.values,
    ) as ProfileFormReviewValue;
    const addressValue = displayValue.addressPicker;

    useEffect(() => {
      let cancelled = false;

      Promise.all([getEmirateList(), getRegionList(), getAreaList()])
        .then(([emirateResponse, regionResponse, areaResponse]) => {
          if (cancelled) return;
          setAddressLookups({
            emirates: Array.isArray(emirateResponse.data)
              ? emirateResponse.data
              : [],
            regions: Array.isArray(regionResponse.data)
              ? regionResponse.data
              : [],
            areas: Array.isArray(areaResponse.data) ? areaResponse.data : [],
          });
        })
        .catch(() => {
          if (!cancelled) {
            setAddressLookups(EMPTY_ADDRESS_LOOKUPS);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    const cardTitle = getBilingualValueByLang({
      lang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: title,
      fallback: String(t("ProfileForm.defaultCardTitle")),
    });
    const addressLabels = useMemo(() => {
      const getLocationLabel = <T extends { id: number; nameEn: string; nameAr: string }>(
        items: T[],
        id: number | undefined,
      ) => {
        const item = items.find((candidate) => candidate.id === Number(id));
        return item ? (lang === "ar" ? item.nameAr : item.nameEn) : undefined;
      };

      return {
        emirate:
          getLocationLabel(addressLookups.emirates, addressValue?.emirateId) ??
          displayValue.establishmentEmirateName ??
          displayValue.emirate ??
          addressValue?.emirateId,
        region:
          getLocationLabel(addressLookups.regions, addressValue?.regionId) ??
          addressValue?.regionId,
        area:
          getLocationLabel(addressLookups.areas, addressValue?.areaId) ??
          addressValue?.areaId,
      };
    }, [addressLookups, addressValue, displayValue, lang]);

    const renderReviewValue = (label: string, value: unknown) => (
      <div className="profile-form-review__field">
        <div className="profile-form-review__label">{label}</div>
        <div className="profile-form-review__value">{formatValue(value)}</div>
      </div>
    );

    const renderDocument = (label: string, value: unknown) => {
      const normalizedValue = normalizeProfileFormReviewDocumentValue(value);
      const documentPaths = Array.isArray(normalizedValue)
        ? normalizedValue
        : normalizedValue
          ? [normalizedValue]
          : [];

      return (
        <div className="profile-form-review__field">
          <div className="profile-form-review__label">{label}</div>
          {documentPaths.length > 0 ? (
            documentPaths.map((documentPath) => (
              <DocumentViewer
                key={documentPath}
                fileName={documentPath}
                fileUrl={documentPath}
                hasView
                hasDelete={false}
                disabled
              />
            ))
          ) : (
            <div className="profile-form-review__value">-</div>
          )}
        </div>
      );
    };

    const hasTradeLicenseLabel =
      displayValue.hasTradeLicense === undefined
        ? "-"
        : String(
            t(
              displayValue.hasTradeLicense
                ? "ProfileForm.optionYes"
                : "ProfileForm.optionNo",
            ),
          );

    return (
      <div className="profile-form-review">
        <Card className="profile-form-review__card" title={cardTitle}>
          <Row gutter={[24, 20]}>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelEstablishmentSubTypes")),
                displayValue.establishmentSubTypes,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelWorkEmail")),
                displayValue.workEmail,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelEstablishmentNameArabic")),
                displayValue.establishmentNameArabic,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelEstablishmentNameEnglish")),
                displayValue.establishmentNameEnglish,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelEmirate")),
                addressLabels.emirate,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelLicensingAuthority")),
                displayValue.licensingAuthority,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelHasTradeLicense")),
                hasTradeLicenseLabel,
              )}
            </Col>
            {displayValue.hasTradeLicense === true ? (
              <>
                <Col span={12}>
                  {renderReviewValue(
                    String(t("ProfileForm.labelTradeLicenseNumber")),
                    displayValue.commercialLicenseNumber,
                  )}
                </Col>
                <Col span={12}>
                  {renderReviewValue(
                    String(t("ProfileForm.labelLicenseExpiryDate")),
                    formatDate(displayValue.licenseExpiryDate),
                  )}
                </Col>
              </>
            ) : null}
            {displayValue.hasTradeLicense === false ? (
              <Col span={12}>
                {renderReviewValue(
                  String(t("ProfileForm.labelReserveTradeNumber")),
                  displayValue.reserveTradeNumber,
                )}
              </Col>
            ) : null}
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelPhoneNumber")),
                displayValue.phoneNumber,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("ProfileForm.labelTenancyContractEndDate")),
                formatDate(displayValue.tenancyContractEndDate),
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="profile-form-review__card"
          title={String(t("ProfileForm.cardEstablishmentDocuments"))}
        >
          <Row gutter={[24, 20]}>
            {displayValue.hasTradeLicense === true ? (
              <Col span={12}>
                {renderDocument(
                  String(t("ProfileForm.labelUploadCommercialLicense")),
                  displayValue.commercialLicense,
                )}
              </Col>
            ) : null}
            {displayValue.hasTradeLicense === false ? (
              <Col span={12}>
                {renderDocument(
                  String(t("ProfileForm.labelUploadReserveTradeName")),
                  displayValue.reserveTradeName,
                )}
              </Col>
            ) : null}
            <Col span={12}>
              {renderDocument(
                String(t("ProfileForm.labelUploadTenancyContract")),
                displayValue.tenancyContract,
              )}
            </Col>
            <Col span={12}>
              {renderDocument(
                String(t("ProfileForm.labelMemorandumOfAssociation")),
                displayValue.memorandumOfAssociation,
              )}
            </Col>
            <Col span={12}>
              {renderDocument(
                String(t("ProfileForm.labelPowerOfAttorney")),
                displayValue.powerOfAttorney,
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="profile-form-review__card"
          title={String(t("ProfileForm.cardAddressInformation"))}
        >
          <Row gutter={[24, 20]}>
            <Col span={12}>
              {renderReviewValue(
                String(t("AddressPicker.labelEmirate")),
                addressLabels.emirate,
              )}
            </Col>
            {Number(addressValue?.emirateId) === 1 ? (
              <Col span={12}>
                {renderReviewValue(
                  String(t("AddressPicker.labelRegion")),
                  addressLabels.region,
                )}
              </Col>
            ) : null}
            <Col span={12}>
              {renderReviewValue(
                String(t("AddressPicker.labelArea")),
                addressLabels.area,
              )}
            </Col>
            <Col span={12}>
              {renderReviewValue(
                String(t("AddressPicker.labelStreet")),
                addressValue?.street,
              )}
            </Col>
          </Row>
        </Card>
      </div>
    );
  });

ProfileFormReviewField.displayName = "ProfileFormReviewField";
