import React, { useCallback, useEffect, useMemo, useState } from "react";
import { observer, useField, useForm } from "@formily/react";
import { Button, Card, Col, Input, Modal, Radio, Row, Select, Table } from "antd";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";
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
import "./styles.less";
import CustomButton from "../../../../common/CustomButton";
import EmptyBox from "../../../../common/EmptyBox/EmptyBox";
import GoogleMapPicker from "./GoogleMapPicker";

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

type FilmingLocationsFieldProps = Record<string, unknown> & {
  className?: string;
};
type FilmingLocationsArrayField = {
  value?: unknown;
  setValue: (value: FilmingLocationItem[]) => void;
  pattern?: string;
  required?: boolean;
  setValidator?: (validator: (value: unknown) => string) => void;
  decoratorProps?: Record<string, unknown>;
  selfErrors?: string[];
};

export const FilmingLocationsField: React.FC<FilmingLocationsFieldProps> = observer((props) => {
  const { className, ...restProps } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tx = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`AddressList.${key}`, {
          lng: previewLang,
          ...(options ?? {}),
        }),
      ),
    [previewLang],
  );
  const field = useField() as unknown as FilmingLocationsArrayField;
  const form = useForm();
  const isReadOnly =
    field.pattern === "disabled" ||
    field.pattern === "readOnly" ||
    field.pattern === "readPretty" ||
    form.pattern === "disabled" ||
    form.pattern === "readOnly" ||
    form.pattern === "readPretty";
  const value = useMemo(
    () => (Array.isArray(field.value) ? field.value : []) as FilmingLocationItem[],
    [field.value]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [method, setMethod] = useState<LocationMethod>(DEFAULT_METHOD);
  const [emirateId, setEmirateId] = useState<number | undefined>(undefined);
  const [regionId, setRegionId] = useState<number | undefined>(undefined);
  const [areaId, setAreaId] = useState<number | undefined>(undefined);
  const [street, setStreet] = useState<string>("");
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);

  const [emirates, setEmirates] = useState<EmirateItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const requiredMessage = tx("validationAtLeastOne");

  const getLocationName = useCallback(
    (item?: { nameEn?: string; nameAr?: string } | null) => {
      if (!item) return "-";
      return previewLang === "ar"
        ? item.nameAr || item.nameEn || "-"
        : item.nameEn || item.nameAr || "-";
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

  const filteredRegions = useMemo(() => {
    if (!emirateId) return [];
    return regions.filter((r) => r.emirateId === emirateId);
  }, [regions, emirateId]);

  const filteredAreas = useMemo(() => {
    if (!regionId) return [];
    return areas.filter((a) => a.regionId === regionId);
  }, [areas, regionId]);

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

  useEffect(() => {
    field.required = true;
    field.setValidator?.((nextValue: unknown) => {
      return Array.isArray(nextValue) && nextValue.length > 0 ? "" : requiredMessage;
    });
    field.decoratorProps = {
      ...field.decoratorProps,
      feedbackLayout: "none",
    };
  }, [field, requiredMessage]);

  const openAdd = () => {
    setEditingId(null);
    setMethod(DEFAULT_METHOD);
    setEmirateId(undefined);
    setRegionId(undefined);
    setAreaId(undefined);
    setStreet("");
    setLongitude(undefined);
    setLatitude(undefined);
    setModalOpen(true);
  };

  const openEdit = (record: FilmingLocationItem) => {
    setEditingId(record.id);
    setMethod(record.method || DEFAULT_METHOD);
    setEmirateId(record.emirateId);
    setRegionId(record.regionId);
    setAreaId(record.areaId);
    setStreet(record.street || "");
    setLongitude(record.Longitude);
    setLatitude(record.Latitude);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSaving(false);
  };

  const removeItem = useCallback((id: string) => {
    const next = value.filter((v) => v.id !== id);
    field.setValue(next);
  }, [field, value]);

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
    []
  );

  const validateAndBuildPayload = (): FilmingLocationItem | null => {
    if (method === "data") {
      if (!emirateId || !regionId || !areaId) {
        return null;
      }
      if (!street?.trim()) {
        return null;
      }
      return {
        id: editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method,
        emirateId,
        regionId,
        areaId,
        street: street.trim(),
      };
    }

    if (typeof longitude !== "number" || typeof latitude !== "number") {
      return null;
    }

    if (!street?.trim()) {
      return null;
    }

    return {
      id: editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      street: street.trim(),
      Longitude: longitude,
      Latitude: latitude,
    };
  };

  const onSave = async () => {
    const payload = validateAndBuildPayload();
    if (!payload) {
      Modal.warning({
        centered: true,
        title: tx("validationTitle"),
        content: tx("validationContent"),
      });
      return;
    }

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
    () => [
      {
        title: tx("columnEmirate"),
        dataIndex: "emirateId",
        key: "emirateId",
        render: (id: number | undefined) => {
          const emirate = id ? emirateMap.get(id) : undefined;
          return getLocationName(emirate);
        },
      },
      {
        title: tx("columnRegion"),
        dataIndex: "regionId",
        key: "regionId",
        render: (id: number | undefined) => {
          const region = id ? regionMap.get(id) : undefined;
          return getLocationName(region);
        },
      },
      {
        title: tx("columnArea"),
        dataIndex: "areaId",
        key: "areaId",
        render: (id: number | undefined) => {
          const area = id ? areaMap.get(id) : undefined;
          return getLocationName(area);
        },
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
          <div className="filming-locations-actions">
            <Button type="link" onClick={() => openEdit(record)}>
              {tx("actionEdit")}
            </Button>
            <Button type="link" danger onClick={() => removeItem(record.id)}>
              {tx("actionDelete")}
            </Button>
          </div>
        ),
      },
    ].filter((column) => !isReadOnly || column.key !== "actions"),
    [
      areaMap,
      emirateMap,
      getLocationName,
      isReadOnly,
      regionMap,
      removeItem,
      tx,
    ]
  );

  return (
    <div
      {...restProps}
      className={["filming-locations-container", className].filter(Boolean).join(" ")}
    >
      <Card
        className="filming-locations-card"
        title={
          <div className="filming-locations-title">
            {tx("defaultLabelName")}
            <span className="required-icon">*</span>
          </div>
        }
        extra={!isReadOnly ? (
          <CustomButton className="filming-locations-add" onClick={openAdd}>
            {tx("defaultAddButton")}
          </CustomButton>
        ) : null}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={value}
          pagination={false}
          size="middle"
          locale={{ emptyText: <EmptyBox /> }}
        />
      </Card>

      {!!field.selfErrors?.length && (
        <div style={{ marginTop: 6, color: "#EA4F49", fontSize: 12 }}>
          {field.selfErrors[0]}
        </div>
      )}

      <Modal
        centered
        title={tx("modalAddNew")}
        visible={modalOpen}
        onCancel={closeModal}
        onOk={onSave}
        okText={tx("save")}
        cancelText={tx("cancel")}
        confirmLoading={saving}
        width={900}
        wrapClassName="filming-locations-modal-root"
      >
        <div className="filming-locations-modal">
          <div className="filming-locations-method">
            <Radio.Group
              value={method}
              onChange={(e) => setMethod(e.target.value as LocationMethod)}
            >
              <Radio value="data">{tx("methodData")}</Radio>
              <Radio value="map">{tx("methodMap")}</Radio>
            </Radio.Group>
          </div>

          {method === "data" ? (
            <Row gutter={24}>
              <Col span={12}>
                <div className="filming-locations-label">
                  {tx("columnEmirate")} *
                </div>
                <Select
                className="umc-select-arrow-manual"
                  placeholder={tx("placeholderEmirate")}
                  value={emirateId}
                  onChange={(v) => {
                    setEmirateId(v);
                    setRegionId(undefined);
                    setAreaId(undefined);
                  }}
                  loading={loadingAddress}
                  showSearch
                  optionFilterProp="children"
                  style={{ width: "100%" }}
                >
                  {emirates.map((e) => (
                    <Select.Option key={e.id} value={e.id}>
                      {getLocationName(e)}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <div className="filming-locations-label">
                  {tx("columnRegion")} *
                </div>
                <Select
                className="umc-select-arrow-manual"
                  placeholder={tx("placeholderRegion")}
                  value={regionId}
                  onChange={(v) => {
                    setRegionId(v);
                    setAreaId(undefined);
                  }}
                  disabled={!emirateId}
                  loading={loadingAddress}
                  showSearch
                  optionFilterProp="children"
                  style={{ width: "100%" }}
                >
                  {filteredRegions.map((r) => (
                    <Select.Option key={r.id} value={r.id}>
                      {getLocationName(r)}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <div className="filming-locations-label">
                  {tx("columnArea")} *
                </div>
                <Select
                className="umc-select-arrow-manual"
                  placeholder={tx("placeholderArea")}
                  value={areaId}
                  onChange={(v) => setAreaId(v)}
                  disabled={!regionId}
                  loading={loadingAddress}
                  showSearch
                  optionFilterProp="children"
                  style={{ width: "100%" }}
                >
                  {filteredAreas.map((a) => (
                    <Select.Option key={a.id} value={a.id}>
                      {getLocationName(a)}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <div className="filming-locations-label">
                  {tx("labelStreet")} *
                </div>
                <Input.TextArea
                  placeholder={tx("placeholderStreet")}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  maxLength={200}
                  autoSize={{ minRows: 4, maxRows: 4 }}
                />
                <div className="filming-locations-counter">{street.length} / 200</div>
              </Col>
            </Row>
          ) : (
            <div className="filming-locations-map-placeholder">
              <GoogleMapPicker
                value={street}
                latitude={latitude}
                longitude={longitude}
                onLocationSelect={handleMapLocationSelect}
              />
              <div className="filming-locations-label">
                {tx("labelStreet")} *
              </div>
              <Input.TextArea
                placeholder={tx("placeholderStreet")}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                maxLength={200}
                autoSize={{ minRows: 4, maxRows: 4 }}
              />
              <div className="filming-locations-counter">{street.length} / 200</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
});
