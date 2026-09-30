import React, { useCallback, useEffect, useMemo, useState } from "react";
import { observer, useField, useForm } from "@formily/react";
import { Col, Input, Row, Select } from "antd";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/address";
import "./AddressPicker.less";

type AddressValue = {
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
};

type AddressErrorKey = "emirateId" | "regionId" | "areaId" | "street";

function getAddressFieldErrors(
  v: AddressValue | undefined,
  requiredMsg: string,
): Partial<Record<AddressErrorKey, string>> {
  const val = v || {};
  const out: Partial<Record<AddressErrorKey, string>> = {};

  if (val.emirateId === undefined || val.emirateId === null) {
    out.emirateId = requiredMsg;
  }

  if (Number(val.emirateId) === 1) {
    if (val.regionId === undefined || val.regionId === null) {
      out.regionId = requiredMsg;
    }
  }

  if (val.areaId === undefined || val.areaId === null) {
    out.areaId = requiredMsg;
  }

  if (!String(val.street ?? "").trim()) {
    out.street = requiredMsg;
  }

  return out;
}

function firstAddressError(v: AddressValue | undefined, requiredMsg: string): string {
  const e = getAddressFieldErrors(v, requiredMsg);
  return e.emirateId || e.regionId || e.areaId || e.street || "";
}

const AddressPicker: React.FC<any> = observer((props) => {
  const field = useField<any>();
  const form = useForm();
  const value: AddressValue = field.value || {};
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n } = useTranslation();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18n.language);
  const lngOpt = previewLang === "ar" ? "ar" : "en";

  const tx = useCallback(
    (key: string) =>
      String(i18n.t(`AddressPicker.${key}`, { lng: lngOpt })),
    [i18n, lngOpt],
  );

  const geoLabel = useCallback(
    (item: { nameEn: string; nameAr: string }) =>
      lngOpt === "ar" ? item.nameAr : item.nameEn,
    [lngOpt],
  );

  const [emirates, setEmirates] = useState<EmirateItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const showRegion = Number(value.emirateId) === 1;

  const filteredRegions = useMemo(() => {
    if (!value.emirateId) return [];
    return regions.filter((r) => r.emirateId === value.emirateId);
  }, [regions, value.emirateId]);

  const filteredAreas = useMemo(() => {
    if (!value.emirateId) return [];
    if (Number(value.emirateId) === 1) {
      if (!value.regionId) return [];
      return areas.filter((a) => a.regionId === value.regionId);
    }
    const regionIds = new Set(
      regions
        .filter((r) => r.emirateId === value.emirateId)
        .map((r) => r.id),
    );
    return areas.filter((a) => regionIds.has(a.regionId));
  }, [areas, regions, value.emirateId, value.regionId]);

  const requiredMsg = useMemo(
    () => String(i18n.t("AddressPicker.requiredField", { lng: lngOpt })),
    [i18n, lngOpt],
  );

  const fieldErrors = useMemo(
    () => getAddressFieldErrors(value, requiredMsg),
    [value, requiredMsg],
  );

  const showValidationHints = field.selfInvalid;

  useEffect(() => {
    field.setValidator((val: AddressValue) =>
      firstAddressError(val, requiredMsg),
    );
  }, [field, requiredMsg]);

  useEffect(() => {
    if (Number(value.emirateId) !== 1 && value.regionId != null) {
      field.setValue({ ...value, regionId: undefined });
    }
  }, [value.emirateId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingAddress(true);
        const [eRes, rRes, aRes] = await Promise.all([
          getEmirateList(),
          getRegionList(),
          getAreaList(),
        ]);
        setEmirates(eRes.data || []);
        setRegions(rRes.data || []);
        setAreas(aRes.data || []);
      } catch (err) {
        console.error("Failed to load address lists", err);
      } finally {
        setLoadingAddress(false);
      }
    };
    load();
  }, []);

  const updateValue = (patch: Partial<AddressValue>) => {
    field.setValue({ ...value, ...patch });
  };

  const isLockedPattern = (pattern?: string) =>
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty";
  const isDisabled =
    Boolean(props.disabled) ||
    isLockedPattern(field.pattern) ||
    isLockedPattern(form.pattern);


  const areaDisabled =
    isDisabled ||
    !value.emirateId ||
    (Number(value.emirateId) === 1 && !value.regionId);

  const renderFieldError = (key: AddressErrorKey) =>
    showValidationHints && fieldErrors[key] ? (
      <div className="address-picker-field-error">{fieldErrors[key]}</div>
    ) : null;

  return (
    <div className="address-picker-container">
      <Row gutter={24}>
        <Col span={12}>
          <div className="address-picker-label">
            {tx("labelEmirate")}{" "}
            <span className="address-picker-required">*</span>
          </div>
          <Select
            placeholder={tx("phSelectEmirate")}
            value={value.emirateId}
            onChange={(v) =>
              updateValue({
                emirateId: v,
                regionId: undefined,
                areaId: undefined,
              })
            }
            loading={loadingAddress}
            disabled={isDisabled}
            showSearch
            optionFilterProp="children"
            className={
              showValidationHints && fieldErrors.emirateId
                ? "address-picker-select-error"
                : undefined
            }
            style={{ width: "100%" }}
          >
            {emirates.map((e) => (
              <Select.Option key={e.id} value={e.id}>
                {geoLabel(e)}
              </Select.Option>
            ))}
          </Select>
          {renderFieldError("emirateId")}
        </Col>
        {showRegion ? (
          <Col span={12}>
            <div className="address-picker-label">
              {tx("labelRegion")}{" "}
              <span className="address-picker-required">*</span>
            </div>
            <Select
              placeholder={tx("phSelectRegion")}
              value={value.regionId}
              onChange={(v) =>
                updateValue({ regionId: v, areaId: undefined })
              }
              disabled={isDisabled || !value.emirateId}
              loading={loadingAddress}
              showSearch
              optionFilterProp="children"
              className={
                showValidationHints && fieldErrors.regionId
                  ? "address-picker-select-error"
                  : undefined
              }
              style={{ width: "100%" }}
            >
              {filteredRegions.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {geoLabel(r)}
                </Select.Option>
              ))}
            </Select>
            {renderFieldError("regionId")}
          </Col>
        ) : null}
        <Col span={12}>
          <div className="address-picker-label">
            {tx("labelArea")}{" "}
            <span className="address-picker-required">*</span>
          </div>
          <Select
            placeholder={tx("phSelectArea")}
            value={value.areaId}
            onChange={(v) => updateValue({ areaId: v })}
            disabled={areaDisabled}
            loading={loadingAddress}
            showSearch
            optionFilterProp="children"
            className={
              showValidationHints && fieldErrors.areaId
                ? "address-picker-select-error"
                : undefined
            }
            style={{ width: "100%" }}
          >
            {filteredAreas.map((a) => (
              <Select.Option key={a.id} value={a.id}>
                {geoLabel(a)}
              </Select.Option>
            ))}
          </Select>
          {renderFieldError("areaId")}
        </Col>
        <Col span={12}>
          <div className="address-picker-label">
            {tx("labelStreet")}{" "}
            <span className="address-picker-required">*</span>
          </div>
          <Input.TextArea
            placeholder={tx("phEnterStreet")}
            value={value.street}
            onChange={(e) => updateValue({ street: e.target.value })}
            disabled={isDisabled}
            maxLength={1000}
            autoSize={{ minRows: 4 }}
            className={
              showValidationHints && fieldErrors.street
                ? "address-picker-input-error"
                : undefined
            }
          />
          {renderFieldError("street")}
        </Col>
      </Row>
    </div>
  );
});

export default AddressPicker;
