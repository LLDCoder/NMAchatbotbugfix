import * as React from "react";
import { useEffect, useState } from "react";
import { observer, useField } from "@formily/react";
import { Input, Radio, Row, Col, Select, Card as AntdCard } from "antd";
import type { RadioChangeEvent } from "antd/lib/radio";
import type { RcFile } from "antd/lib/upload";
import { useTranslation } from "react-i18next";
import DocumentViewer from "@/components/common/DocumentViewer";
import CustomMessage from "@/components/common/CustomMessage";
import { getAuthoritiesByEmirateId } from "@/services/services";
import { getEmirateList, type EmirateItem } from "@/services/userProfile";
import {
  normalizeTradeLicenseAuthorityList,
  unwrapTradeLicenseListResponse,
  type TradeLicenseAuthorityItem,
} from "@/services/tradeLicense";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import "./styles.less";

const { Option } = Select;

export type TradeLicenseDetailsValue = {
  tradeLicenseNumber?: string;
  hasValidTaxRegistration?: boolean;
  taxRegistrationNumber?: string;
  emirateId?: number;
  authorityId?: number;
  tradeLicenseFile?: string;
};

const MAX_LEN = 50;

const slice50 = (s: string) => s.slice(0, MAX_LEN);

function validateTradeLicenseDetailsValue(
  val: TradeLicenseDetailsValue | undefined,
  tf: (key: string, options?: Record<string, unknown>) => string
): string {
  const v = val || {};
  if (!String(v.tradeLicenseNumber || "").trim()) {
    return tf("validationTradeLicenseNumberRequired");
  }
  if (typeof v.hasValidTaxRegistration !== "boolean") {
    return tf("validationTaxRegistrationChoiceRequired");
  }
  if (
    v.hasValidTaxRegistration &&
    !String(v.taxRegistrationNumber || "").trim()
  ) {
    return tf("validationTaxRegistrationNumberRequired");
  }
  if (v.emirateId == null || Number.isNaN(Number(v.emirateId))) {
    return tf("validationEmirateRequired");
  }
  if (v.authorityId == null || Number.isNaN(Number(v.authorityId))) {
    return tf("validationAuthorityRequired");
  }
  if (
    v.tradeLicenseFile == null ||
    v.tradeLicenseFile === "" ||
    (Array.isArray(v.tradeLicenseFile) && v.tradeLicenseFile.length === 0)
  ) {
    return tf("validationTradeLicenseFileRequired");
  }
  return "";
}

type TradeLicenseDetailsFieldProps = {
  className?: string;
  disabled?: boolean;
};

export const TradeLicenseDetailsField: React.FC<TradeLicenseDetailsFieldProps> =
  observer((props) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- align with other designable composite fields
    const field = useField<any>();
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    const disabled = !!props.disabled;
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);
    const tf = React.useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`TradeLicenseDetails.${key}`, {
            lng: previewLang,
            ...(options ?? {}),
          })
        ),
      [previewLang]
    );

    const raw = (field.value || {}) as TradeLicenseDetailsValue;
    const current: TradeLicenseDetailsValue = {
      tradeLicenseNumber: raw.tradeLicenseNumber ?? "",
      hasValidTaxRegistration:
        typeof raw.hasValidTaxRegistration === "boolean"
          ? raw.hasValidTaxRegistration
          : true,
      taxRegistrationNumber: raw.taxRegistrationNumber ?? "",
      emirateId: raw.emirateId,
      authorityId: raw.authorityId,
      tradeLicenseFile: raw.tradeLicenseFile,
    };

    const [emirateOptions, setEmirateOptions] = useState<EmirateItem[]>([]);
    const [emirateLoading, setEmirateLoading] = useState(true);
    const [authorityOptions, setAuthorityOptions] = useState<
      TradeLicenseAuthorityItem[]
    >([]);
    const [authorityLoading, setAuthorityLoading] = useState(false);

    useEffect(() => {
      const v = field.value as TradeLicenseDetailsValue | undefined;
      if (v != null && typeof v.hasValidTaxRegistration === "boolean") return;
      field.setValue({
        tradeLicenseNumber: v?.tradeLicenseNumber ?? "",
        hasValidTaxRegistration: v?.hasValidTaxRegistration ?? true,
        taxRegistrationNumber: v?.taxRegistrationNumber ?? "",
        emirateId: v?.emirateId,
        authorityId: v?.authorityId,
        tradeLicenseFile: v?.tradeLicenseFile,
      });
    }, [field]);

    useEffect(() => {
      let cancelled = false;
      setEmirateLoading(true);
      getEmirateList()
        .then((res) => {
          if (cancelled) return;
          const data =
            res && typeof res === "object" && "data" in res
              ? (res as { data?: EmirateItem[] }).data
              : undefined;
          setEmirateOptions(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (!cancelled) setEmirateOptions([]);
        })
        .finally(() => {
          if (!cancelled) setEmirateLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    const emirateId = current.emirateId;

    useEffect(() => {
      const id = emirateId != null ? Number(emirateId) : NaN;
      if (emirateId == null || Number.isNaN(id)) {
        setAuthorityOptions([]);
        return;
      }
      let cancelled = false;
      setAuthorityLoading(true);
      getAuthoritiesByEmirateId(id)
        .then((res) => {
          if (cancelled) return;
          setAuthorityOptions(
            normalizeTradeLicenseAuthorityList(
              unwrapTradeLicenseListResponse(res),
              { visibleOnly: true }
            )
          );
        })
        .catch(() => {
          if (!cancelled) setAuthorityOptions([]);
        })
        .finally(() => {
          if (!cancelled) setAuthorityLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [emirateId]);

    useEffect(() => {
      field.setValidator((val: TradeLicenseDetailsValue | undefined) =>
        validateTradeLicenseDetailsValue(val, tf)
      );
    }, [field, tf]);

    const patch = (partial: Partial<TradeLicenseDetailsValue>) => {
      field.setValue({
        ...current,
        ...partial,
      });
    };

    const handleTradeLicenseNumber = (s: string) => {
      patch({ tradeLicenseNumber: slice50(s) });
    };

    const handleTaxRadio = (e: RadioChangeEvent) => {
      const yes = e.target.value === true;
      patch({
        hasValidTaxRegistration: yes,
        taxRegistrationNumber: yes ? current.taxRegistrationNumber : "",
      });
    };

    const handleTaxNumber = (s: string) => {
      patch({ taxRegistrationNumber: slice50(s) });
    };

    const handleEmirate = (id: number | undefined) => {
      patch({ emirateId: id, authorityId: undefined });
    };

    const handleAuthority = (id: number | undefined) => {
      patch({ authorityId: id });
    };

    const beforeUploadFile = (file: RcFile) => {
      const ok = /\.(jpe?g|png|pdf)$/i.test(file.name);
      if (!ok) {
        CustomMessage.error(tf("errorInvalidFileType"));
        return false;
      }
      if (file.size / 1024 / 1024 > 4) {
        CustomMessage.error(tf("errorFileSizeExceeds4MB"));
        return false;
      }
      return true;
    };

    const showTax = current.hasValidTaxRegistration === true;

    const renderLabel = (label: string, required = true) => (
      <div className="trade-license-details-label">
        <span>
          {label}
          {required && (
            <span className="trade-license-details-required">*</span>
          )}
        </span>
      </div>
    );

    return (
      <div
        className={`trade-license-details-container ${props.className || ""}`}
      >
        <AntdCard
          className="trade-license-details-card"
          title={tf("defaultCardTitle")}
        >
          <Row gutter={24}>
            <Col span={12}>
              <div className="trade-license-details-field">
                {renderLabel(tf("labelTradeLicenseNumber"))}
                <Input
                  disabled={disabled}
                  placeholder={tf("phTradeLicenseNumber")}
                  value={current.tradeLicenseNumber}
                  onChange={(e) => handleTradeLicenseNumber(e.target.value)}
                  maxLength={MAX_LEN}
                />
              </div>
            </Col>
            <Col span={12}>
              <div className="trade-license-details-field">
                {renderLabel(tf("labelHasValidTaxRegistration"), true)}
                <Radio.Group
                  disabled={disabled}
                  value={current.hasValidTaxRegistration}
                  onChange={handleTaxRadio}
                  className="trade-license-details-radio-group"
                >
                  <Radio value={true}>{tf("optionYes")}</Radio>
                  <Radio value={false}>{tf("optionNo")}</Radio>
                </Radio.Group>
              </div>
            </Col>
          </Row>

          <div
            className={`trade-license-details-tax-wrap ${
              showTax
                ? "trade-license-details-tax-wrap--visible"
                : "trade-license-details-tax-wrap--hidden"
            }`}
            aria-hidden={!showTax}
          >
            <Row gutter={24}>
              <Col span={12}>
                <div className="trade-license-details-field">
                  {renderLabel(tf("labelTaxRegistrationNumber"))}
                  <Input
                    disabled={disabled}
                    placeholder={tf("phTaxRegistrationNumber")}
                    value={current.taxRegistrationNumber}
                    onChange={(e) => handleTaxNumber(e.target.value)}
                    maxLength={MAX_LEN}
                  />
                </div>
              </Col>
            </Row>
          </div>

          <Row gutter={24}>
            <Col span={12}>
              <div className="trade-license-details-field">
                {renderLabel(tf("labelEmirate"))}
                <Select
                  disabled={disabled}
                  loading={emirateLoading}
                  placeholder={tf("phSelectEmirate")}
                  value={current.emirateId}
                  onChange={handleEmirate}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  className="umc-select-arrow-manual"
                >
                  {emirateOptions.map((e) => (
                    <Option
                      key={e.id}
                      value={e.id}
                      label={previewLang === "ar" ? e.nameAr : e.nameEn}
                    >
                      {previewLang === "ar" ? e.nameAr : e.nameEn}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col span={12}>
              <div className="trade-license-details-field">
                {renderLabel(tf("labelAuthorityOfTradeLicensesIssued"))}
                <Select
                  disabled={disabled || emirateId == null}
                  loading={authorityLoading}
                  placeholder={tf("phSelectAuthority")}
                  value={current.authorityId}
                  onChange={handleAuthority}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  className="umc-select-arrow-manual"
                >
                  {authorityOptions.map((a) => (
                    <Option
                      key={a.id}
                      value={a.id}
                      label={previewLang === "ar" ? a.nameAr || a.nameEn : a.nameEn}
                    >
                      {previewLang === "ar" ? a.nameAr || a.nameEn : a.nameEn}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <div className="trade-license-details-field trade-license-details-upload">
                {renderLabel(tf("labelTradeLicense"))}
                <DocumentViewer
                  hasDelete={!disabled}
                  disabled={disabled}
                  value={current.tradeLicenseFile}
                  onChange={(v) =>
                    patch({
                      tradeLicenseFile: Array.isArray(v) ? v[0] : (v as string),
                    })
                  }
                  uploadConfig={{
                    maxCount: 1,
                    maxSize: 4,
                    accept: ".jpg,.jpeg,.png,.pdf",
                    uploadTip: tf("uploadTip"),
                    placeholder: tf("uploadPlaceholder"),
                    beforeUpload: beforeUploadFile,
                  }}
                />
              </div>
            </Col>
          </Row>
        </AntdCard>
      </div>
    );
  });

TradeLicenseDetailsField.displayName = "TradeLicenseDetailsField";

export default TradeLicenseDetailsField;
