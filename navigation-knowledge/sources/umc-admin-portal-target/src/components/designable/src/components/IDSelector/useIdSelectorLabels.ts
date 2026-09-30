import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import type { PortalFormLang } from "@/components/designable/playground/FormPreviewLangContext";

/**
 * Designer canvas: follow form preview `contentLang`. Runtime forms: follow global
 * `i18n.language` (see `FormliyView` / portal `react-i18next`).
 */
export function useIDSelectorDisplayLang(): PortalFormLang {
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n } = useTranslation();
  if (host === "designer") {
    return contentLang;
  }
  return mapDesignerLanguageToContentLang(i18n.language);
}

export function useIDSelectorLabels() {
  const lang = useIDSelectorDisplayLang();
  const { i18n } = useTranslation();
  const lng = lang === "ar" ? "ar" : "en";

  return useMemo(() => {
    const t = (key: string) => i18n.t(`IDSelector.${key}`, { lng });
    return {
      optionEmiratesId: t("optionEmiratesId"),
      optionUid: t("optionUid"),
      optionPassport: t("optionPassport"),
      genderMale: t("genderMale"),
      genderFemale: t("genderFemale"),
      queryLabel: t("queryLabel"),
      dateFormat: t("dateFormat"),
      labelDateOfBirth: t("labelDateOfBirth"),
      labelEmiratesId: t("labelEmiratesId"),
      labelUid: t("labelUid"),
      labelPassportNumber: t("labelPassportNumber"),
      labelFullNameAr: t("labelFullNameAr"),
      labelFullNameEn: t("labelFullNameEn"),
      labelNationality: t("labelNationality"),
      labelGender: t("labelGender"),
      labelOccupation: t("labelOccupation"),
      labelExpiryDate: t("labelExpiryDate"),
      labelPassportExpiry: t("labelPassportExpiry"),
      labelVisaExpiry: t("labelVisaExpiry"),
      labelPassportType: t("labelPassportType"),
      labelPlaceOfIssueEn: t("labelPlaceOfIssueEn"),
      labelPlaceOfIssueAr: t("labelPlaceOfIssueAr"),
      labelMobileNo: t("labelMobileNo"),
      labelTelephoneNo: t("labelTelephoneNo"),
      labelFax: t("labelFax"),
      labelWorkNo: t("labelWorkNo"),
      labelContactArea: t("labelContactArea"),
      labelEmailAddress: t("labelEmailAddress"),
      labelPersonalPhoto: t("labelPersonalPhoto"),
      labelEmiratesIdDoc: t("labelEmiratesIdDoc"),
      labelPassportDoc: t("labelPassportDoc"),
      labelVisaDoc: t("labelVisaDoc"),
      labelPassportScan: t("labelPassportScan"),
      phEnterEmiratesId: t("phEnterEmiratesId"),
      phEnterUid: t("phEnterUid"),
      phEnterPassportNumber: t("phEnterPassportNumber"),
      phFullNameAr: t("phFullNameAr"),
      phFullNameEn: t("phFullNameEn"),
      phNationality: t("phNationality"),
      phGender: t("phGender"),
      phOccupation: t("phOccupation"),
      phEnterPassportType: t("phEnterPassportType"),
      phPlaceOfIssueEn: t("phPlaceOfIssueEn"),
      phPlaceOfIssueAr: t("phPlaceOfIssueAr"),
      phMobileNumber: t("phMobileNumber"),
      phTelephoneNumber: t("phTelephoneNumber"),
      phFax: t("phFax"),
      phWorkNumber: t("phWorkNumber"),
      phSelectContactArea: t("phSelectContactArea"),
      phEmailAddress: t("phEmailAddress"),
      valEnterEmiratesId: t("valEnterEmiratesId"),
      valEnterUid: t("valEnterUid"),
      valEnterPassport: t("valEnterPassport"),
      valFullNameAr: t("valFullNameAr"),
      valFullNameEn: t("valFullNameEn"),
      valNationality: t("valNationality"),
      valGender: t("valGender"),
      valOccupation: t("valOccupation"),
      valDate: t("valDate"),
      valRequired: t("valRequired"),
      valValidEmiratesId: t("valValidEmiratesId"),
      valPassportTypeRequired: t("valPassportTypeRequired"),
      valPassportTypeMax: t("valPassportTypeMax"),
      valPlaceOfIssueEnRequired: t("valPlaceOfIssueEnRequired"),
      valPlaceOfIssueEnMax: t("valPlaceOfIssueEnMax"),
      valPlaceOfIssueEnInvalid: t("valPlaceOfIssueEnInvalid"),
      valPlaceOfIssueArRequired: t("valPlaceOfIssueArRequired"),
      valPlaceOfIssueArMax: t("valPlaceOfIssueArMax"),
      valPlaceOfIssueArInvalid: t("valPlaceOfIssueArInvalid"),
      valPhoneNumberRequired: t("valPhoneNumberRequired"),
      valPhoneNumberInvalid: t("valPhoneNumberInvalid"),
      valContactAreaRequired: t("valContactAreaRequired"),
      valContactAreaMax: t("valContactAreaMax"),
      valEmailAddressRequired: t("valEmailAddressRequired"),
      valEmailAddressInvalid: t("valEmailAddressInvalid"),
      valPassportExpiryFuture: t("valPassportExpiryFuture"),
      valLoadFailed: t("valLoadFailed"),
      valLoadFailedEmiratesId: t("valLoadFailedEmiratesId"),
      valLoadFailedUid: t("valLoadFailedUid"),
      valLoadFailedPassport: t("valLoadFailedPassport"),
      uploadPlaceholder: t("uploadPlaceholder"),
      uploadTipImage5mb: t("uploadTipImage5mb"),
      uploadTipPdf5mb: t("uploadTipPdf5mb"),
      valVisaNotFuture: t("valVisaNotFuture"),
    };
  }, [i18n, lng]);
}

export type IDSelectorLabels = ReturnType<typeof useIDSelectorLabels>;
