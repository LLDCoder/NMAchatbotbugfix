import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  observer,
  useField,
  useForm,
  Field,
  FormProvider,
} from "@formily/react";
import { createForm } from "@formily/core";
import type { Form as FormilyForm } from "@formily/core";
import {
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Table,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/address";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import AddressPicker from "../AddressPicker/AddressPicker";
import GoogleMapPicker from "../FilmingLocations/GoogleMapPicker";
import "../FormItemWithHtmlTooltip/index.less";
import "./styles.less";
import CustomButton from "../../../../common/CustomButton";

type LocationMethod = "data" | "map";

type FilmingLocationItem = {
  id: string;
  method: LocationMethod;
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  street?: string;
  Longitude?: number;
  Latitude?: number;
};

const DEFAULT_METHOD: LocationMethod = "data";

function isNonEditablePattern(pattern: string | undefined) {
  return (
    pattern === "disabled" ||
    pattern === "readOnly" ||
    pattern === "readPretty"
  );
}

type AddressListProps = Record<string, unknown> & {
  disabled?: boolean;
  labelName?: string;
  labelNameEn?: string;
  labelNameAr?: string;
  addButtonLabel?: string;
  addButtonLabelEn?: string;
  addButtonLabelAr?: string;
  className?: string;
};

type AddressListField = {
  value?: unknown;
  setValue: (value: FilmingLocationItem[]) => void;
  pattern?: string;
  required?: boolean;
  setValidator?: (validator: (value: unknown) => string) => void;
  decoratorProps?: Record<string, unknown>;
  selfErrors?: string[];
};

function isHtmlString(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmpty(str: string): boolean {
  if (!str) return true;
  const text = str.replace(/<[^>]*>/g, "").trim();
  return text.length === 0 && !/<img\s/i.test(str) && !/<video\s/i.test(str);
}

export const FilmingLocationsField: React.FC<AddressListProps> = observer(
  (props) => {
    const {
      disabled = false,
      labelName: legacyLabelName,
      labelNameEn,
      labelNameAr,
      addButtonLabel: legacyAddButtonLabel,
      addButtonLabelEn,
      addButtonLabelAr,
      className,
      ...restProps
    } = props;
    const field = useField() as unknown as AddressListField;
    const form = useForm();
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n } = useTranslation();
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18n.language);
    const lngOpt = previewLang === "ar" ? "ar" : "en";
    const tx = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(i18n.t(`AddressList.${key}`, { lng: lngOpt, ...options })),
      [i18n, lngOpt],
    );
    const editableLabelPath =
      previewLang === "ar"
        ? "x-component-props.labelNameAr"
        : "x-component-props.labelNameEn";
    const value = useMemo(
      () => (Array.isArray(field.value) ? field.value : []) as FilmingLocationItem[],
      [field.value],
    );
    const labelName = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: labelNameEn,
      ar: labelNameAr,
      legacy: legacyLabelName,
      fallback: tx("defaultLabelName"),
    });
    const addButtonLabel = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: addButtonLabelEn,
      ar: addButtonLabelAr,
      legacy: legacyAddButtonLabel,
      fallback: tx("defaultAddButton"),
    });
    const decoratorProps = (field.decoratorProps ?? {}) as Record<string, unknown>;
    const tooltipHtml = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: decoratorProps.tooltipEn,
      ar: decoratorProps.tooltipAr,
      legacy: decoratorProps.tooltip,
      fallback: "",
    });
    const showTooltip =
      typeof tooltipHtml === "string" && !isEffectivelyEmpty(tooltipHtml);
    const tooltipTitle = showTooltip
      ? isHtmlString(tooltipHtml)
        ? (
            <div
              className="html-tooltip-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltipHtml) }}
            />
          )
        : tooltipHtml
      : undefined;
    const isInteractionDisabled =
      disabled ||
      isNonEditablePattern(field.pattern) ||
      isNonEditablePattern(form.pattern);
    const showActionColumn = !isInteractionDisabled;

    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [method, setMethod] = useState<LocationMethod>(DEFAULT_METHOD);
    const [addressForm, setAddressForm] = useState<FormilyForm | null>(null);
    const [street, setStreet] = useState<string>("");
    const [longitude, setLongitude] = useState<number | undefined>(undefined);
    const [latitude, setLatitude] = useState<number | undefined>(undefined);

    const [emirates, setEmirates] = useState<EmirateItem[]>([]);
    const [regions, setRegions] = useState<RegionItem[]>([]);
    const [areas, setAreas] = useState<AreaItem[]>([]);
    const requiredMessage = tx("validationAtLeastOne");

    const getLocationName = useCallback(
      (
        item?: { nameEn?: string; nameAr?: string } | null,
        fallback = "-",
      ) => {
        if (!item) return fallback;
        return previewLang === "ar"
          ? item.nameAr || item.nameEn || fallback
          : item.nameEn || item.nameAr || fallback;
      },
      [previewLang],
    );

    const emirateMap = useMemo(() => {
      const map = new Map<number, EmirateItem>();
      emirates.forEach((e) => map.set(e.id, e));
      return map;
    }, [emirates]);

    const regionMap = useMemo(() => {
      const map = new Map<number, RegionItem>();
      regions.forEach((r) => map.set(r.id, r));
      return map;
    }, [regions]);

    const areaMap = useMemo(() => {
      const map = new Map<number, AreaItem>();
      areas.forEach((a) => map.set(a.id, a));
      return map;
    }, [areas]);

    useEffect(() => {
      const load = async () => {
        try {
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
        }
      };
      load();
    }, []);

    useEffect(() => {
      field.required = true;
      field.setValidator?.((nextValue: unknown) => {
        return Array.isArray(nextValue) && nextValue.length > 0
          ? ""
          : requiredMessage;
      });
      field.decoratorProps = {
        ...field.decoratorProps,
        feedbackLayout: "none",
      };
    }, [field, requiredMessage]);

    const openAdd = () => {
      if (isInteractionDisabled) return;
      setEditingId(null);
      setMethod(DEFAULT_METHOD);
      setStreet("");
      setLongitude(undefined);
      setLatitude(undefined);
      setAddressForm(
        createForm({
          initialValues: {
            address: {},
          },
        }),
      );
      setModalOpen(true);
    };

    const openEdit = useCallback((record: FilmingLocationItem) => {
      if (isInteractionDisabled) return;
      setEditingId(record.id);
      const nextMethod = record.method || DEFAULT_METHOD;
      setMethod(nextMethod);
      setStreet(record.street || "");
      setLongitude(record.Longitude);
      setLatitude(record.Latitude);
      if (nextMethod === "data") {
        setAddressForm(
          createForm({
            initialValues: {
              address: {
                emirateId: record.emirateId,
                regionId: record.regionId,
                areaId: record.areaId,
                street: record.street || "",
              },
            },
          }),
        );
      } else {
        setAddressForm(null);
      }
      setModalOpen(true);
    }, [isInteractionDisabled]);

    const closeModal = () => {
      setModalOpen(false);
      setSaving(false);
      setAddressForm(null);
    };

    const onMethodChange = (next: LocationMethod) => {
      if (isInteractionDisabled) return;
      setMethod(next);
      if (next === "data") {
        setAddressForm(
          (prev) =>
            prev ??
            createForm({
              initialValues: { address: {} },
            }),
        );
      } else {
        setAddressForm(null);
      }
    };

    const removeItem = useCallback(
      (id: string) => {
        if (isInteractionDisabled) return;
        const next = value.filter((v) => v.id !== id);
        field.setValue(next);
      },
      [field, isInteractionDisabled, value],
    );

    const handleMapLocationSelect = useCallback(
      ({
        address,
        latitude: nextLatitude,
        longitude: nextLongitude,
      }: {
        address?: string;
        latitude: number;
        longitude: number;
      }) => {
        if (address) {
          setStreet(address);
        }
        setLatitude(nextLatitude);
        setLongitude(nextLongitude);
      },
      [],
    );

    const onSave = async () => {
      if (isInteractionDisabled) return;
      if (method === "data") {
        if (!addressForm) {
          Modal.warning({
            centered: true,
            title: tx("validationTitle"),
            content: tx("validationContent"),
          });
          return;
        }
        setSaving(true);
        try {
          await addressForm.validate();
          const addr = (addressForm.values.address || {}) as {
            emirateId?: number;
            regionId?: number;
            areaId?: number;
            street?: string;
          };
          const payload: FilmingLocationItem = {
            id:
              editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            method: "data",
            emirateId: addr.emirateId,
            regionId: addr.regionId,
            areaId: addr.areaId,
            street: String(addr.street ?? "").trim(),
          };
          if (editingId) {
            const next = value.map((v) => (v.id === editingId ? payload : v));
            field.setValue(next);
          } else {
            field.setValue([...value, payload]);
          }
          closeModal();
        } catch {
          // AddressPicker / form field errors are shown on the form
        } finally {
          setSaving(false);
        }
        return;
      }

      const streetTrim = street?.trim();
      if (
        !streetTrim ||
        typeof longitude !== "number" ||
        typeof latitude !== "number"
      ) {
        Modal.warning({
          centered: true,
          title: tx("validationTitle"),
          content: tx("validationContent"),
        });
        return;
      }

      const payload: FilmingLocationItem = {
        id: editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method: "map",
        street: streetTrim,
        Longitude: longitude,
        Latitude: latitude,
      };

      setSaving(true);
      try {
        if (editingId) {
          const next = value.map((v) => (v.id === editingId ? payload : v));
          field.setValue(next);
        } else {
          field.setValue([...value, payload]);
        }
        closeModal();
      } finally {
        setSaving(false);
      }
    };

    const columns = useMemo(
      () =>
        [
          {
            title: tx("columnEmirate"),
            dataIndex: "emirateId",
            key: "emirateId",
            render: (id: number | undefined) =>
              id ? getLocationName(emirateMap.get(id)) : "-",
          },
          {
            title: tx("columnRegion"),
            dataIndex: "regionId",
            key: "regionId",
            render: (id: number | undefined) =>
              id ? getLocationName(regionMap.get(id)) : "-",
          },
          {
            title: tx("columnArea"),
            dataIndex: "areaId",
            key: "areaId",
            render: (id: number | undefined) =>
              id ? getLocationName(areaMap.get(id)) : "-",
          },
          {
            title: tx("columnStreet"),
            dataIndex: "street",
            key: "street",
            render: (s: string | undefined) => s || "-",
          },
          {
            title: tx("columnActions"),
            key: "actions",
            render: (_: unknown, record: FilmingLocationItem) => (
              <div className="filming-locations-actions Formliy-action">
                  <Button
                    type="link"
                    className="Edit"
                    disabled={isInteractionDisabled}
                    onClick={() => openEdit(record)}
                  >
                    {tx("actionEdit")}
                  </Button>
                  <Button
                    type="link"
                    className="Delete"
                    danger
                    disabled={isInteractionDisabled}
                    onClick={() => removeItem(record.id)}
                >
                  {tx("actionDelete")}
                </Button>
              </div>
            ),
          },
        ].filter((column) => showActionColumn || column.key !== "actions"),
      [
        areaMap,
        emirateMap,
        getLocationName,
        isInteractionDisabled,
        openEdit,
        regionMap,
        removeItem,
        showActionColumn,
        tx,
      ],
    );

    return (
      <div
        {...restProps}
        className={["filming-locations-container", className]
          .filter(Boolean)
          .join(" ")}
      >
        <Card
          className="filming-locations-card"
          title={
            <div className="filming-locations-title">
              <span data-content-editable={editableLabelPath}>{labelName}</span>
              {showTooltip ? (
                <Tooltip title={tooltipTitle} overlayInnerStyle={{ maxWidth: 800 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      marginLeft: 4,
                      lineHeight: 1,
                    }}
                  >
                    <QuestionCircleOutlined
                      style={{
                        color: "rgba(0,0,0,0.45)",
                        cursor: "help",
                        fontSize: 14,
                      }}
                    />
                  </span>
                </Tooltip>
              ) : null}
            </div>
          }
          extra={
            !isInteractionDisabled ? (
              <CustomButton
                className="filming-locations-add"
                disabled={isInteractionDisabled}
                onClick={openAdd}
              >
                {addButtonLabel}
              </CustomButton>
            ) : null
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={value}
            pagination={false}
            size="middle"
            locale={{ emptyText: <EmptyBox title={tx("emptyText")} /> }}
          />
        </Card>

        {!!field.selfErrors?.length && (
          <div style={{ marginTop: 6, color: "#EA4F49", fontSize: 12 }}>
            {field.selfErrors[0]}
          </div>
        )}

        <Modal
          centered
          title={editingId ? tx("modalEdit") : tx("modalAddNew")}
          visible={modalOpen}
          onCancel={closeModal}
          okText={tx("save")}
          cancelText={tx("cancel")}
          confirmLoading={saving}
          width={900}
          footer={null}
          wrapClassName="filming-locations-modal-root"
        >
          <div className="filming-locations-modal">
            <div className="filming-locations-method">
              <Radio.Group
                {...restProps}
                disabled={isInteractionDisabled}
                value={method}
                onChange={(e) =>
                  onMethodChange(e.target.value as LocationMethod)
                }
              >
                <Radio value="data">{tx("methodData")}</Radio>
                <Radio value="map">{tx("methodMap")}</Radio>
              </Radio.Group>
            </div>

            {method === "data" && addressForm ? (
              <FormProvider form={addressForm}>
                <Field
                  name="address"
                  pattern={isInteractionDisabled ? "disabled" : field.pattern}
                  component={[AddressPicker]}
                />
              </FormProvider>
            ) : (
              <div className="filming-locations-map-placeholder">
                <GoogleMapPicker
                  value={street}
                  latitude={latitude}
                  longitude={longitude}
                  onLocationSelect={handleMapLocationSelect}
                />
                <div className="filming-locations-label">{tx("labelStreet")} *</div>
                <Input.TextArea
                  placeholder={tx("placeholderStreet")}
                  value={street}
                  disabled={isInteractionDisabled}
                  onChange={(e) => setStreet(e.target.value)}
                  maxLength={1000}
                  autoSize={{ minRows: 4 }}
                />
                <div className="filming-locations-counter">
                  {street.length} / 1000
                </div>
              </div>
            )}
          </div>
          <div className="formily-modal-footer">
            <CustomButton
              variant="outline"
              customStyle={{ width: 140 }}
              onClick={closeModal}
            >
              {tx("cancel")}
            </CustomButton>
            <CustomButton
              variant="gold"
              customStyle={{ width: 140 }}
              disabled={isInteractionDisabled}
              onClick={onSave}
            >
              {editingId ? tx("save") : tx("confirm")}
            </CustomButton>
          </div>
        </Modal>
      </div>
    );
  },
);
