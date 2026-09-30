import { Col, Form, Input, Row, Select } from "antd";
import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import type { IProps, ISEOFieldType, ILocationRef } from "./type";
import "./index.less";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/userProfile";
import { useTranslation } from "react-i18next";

export const Location = forwardRef<ILocationRef, IProps>(
  ({ LocationForm }, ref) => {
    const { t } = useTranslation();
    const regionFormItemRef = useRef<HTMLDivElement>(null);
    const { Option } = Select;
    const containerRef = useRef<HTMLDivElement>(null);
    const [filteredRegionList, setFilteredRegionList] = useState<RegionItem[]>(
      []
    );
    const [filteredAreaList, setFilteredAreaList] = useState<AreaItem[]>([]);
    const [emirateList, setEmirateList] = useState<EmirateItem[]>([]);
    const [allRegionList, setAllRegionList] = useState<RegionItem[]>([]);
    const [allAreaList, setAllAreaList] = useState<AreaItem[]>([]);
    const listsLoadedRef = useRef(false);

    const [emirateName, setEmirateName] = useState("");
    const [emirateNameAr, setEmirateNameAr] = useState("");
    const [regionName, setRegionName] = useState("");
    const [regionNameAr, setRegionNameAr] = useState("");
    const [areaName, setAreaName] = useState("");
    const [areaNameAr, setAreaNameAr] = useState("");
    const [streetName, setStreetName] = useState("");
    const [streetNameAr, setStreetNameAr] = useState("");

    const watchEmirateId = Form.useWatch("emirateId", LocationForm);
    const watchRegionId = Form.useWatch("regionId", LocationForm);
    const watchAreaId = Form.useWatch("areaId", LocationForm);
    const watchStreet = Form.useWatch("street", LocationForm);
    const watchStreetAr = Form.useWatch("streetAr", LocationForm);

    const waitForListsLoaded = useCallback(() => {
      return new Promise<void>((resolve) => {
        if (listsLoadedRef.current) {
          resolve();
          return;
        }
        const checkInterval = setInterval(() => {
          if (listsLoadedRef.current) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });
    }, []);

    const setLocationValues = useCallback(
      async (values: {
        emirateId?: number;
        regionId?: number;
        areaId?: number;
        street?: string;
        streetAr?: string;
      }) => {
        await waitForListsLoaded();

        const { emirateId, regionId, areaId, street, streetAr } = values;

        if (emirateId !== undefined) {
          LocationForm.setFieldValue("emirateId", emirateId);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (regionId !== undefined) {
          LocationForm.setFieldValue("regionId", regionId);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (areaId !== undefined) {
          LocationForm.setFieldValue("areaId", areaId);
        }

        if (street !== undefined) {
          LocationForm.setFieldValue("street", street);
        }

        if (streetAr !== undefined) {
          LocationForm.setFieldValue("streetAr", streetAr);
        }
      },
      [LocationForm, waitForListsLoaded]
    );

    useImperativeHandle(ref, () => ({
      emirateName,
      emirateNameAr,
      regionName,
      regionNameAr,
      areaName,
      areaNameAr,
      streetName,
      streetNameAr,
      setLocationValues,
    }));

    const updateEmirateName = (emirateId: number, list: EmirateItem[]) => {
      const selected = list.find((item) => item.id === emirateId);
      if (selected) {
        setEmirateName(selected.nameEn);
        setEmirateNameAr(selected.nameAr);
      }
    };

    const updateRegionName = (regionId: number, list: RegionItem[]) => {
      const selected = list.find((item) => item.id === regionId);
      if (selected) {
        setRegionName(selected.nameEn);
        setRegionNameAr(selected.nameAr);
      }
    };

    const updateAreaName = (areaId: number, list: AreaItem[]) => {
      const selected = list.find((item) => item.id === areaId);
      if (selected) {
        setAreaName(selected.nameEn);
        setAreaNameAr(selected.nameAr);
      }
    };

    useEffect(() => {
      const initLists = async () => {
        const [emirateRes, regionRes, areaRes] = await Promise.all([
          getEmirateList(),
          getRegionList(),
          getAreaList(),
        ]);
        setEmirateList(emirateRes.data);
        setAllRegionList(regionRes.data);
        setAllAreaList(areaRes.data);
        listsLoadedRef.current = true;
      };
      initLists();
    }, []);
    useEffect(() => {
      if (watchEmirateId && emirateList.length > 0) {
        updateEmirateName(watchEmirateId, emirateList);
        const filtered = allRegionList.filter(
          (item) => item.emirateId === watchEmirateId
        );

        if (watchEmirateId != 1 && filtered.length) { 
          LocationForm.setFieldsValue({
            regionId:filtered.length ? filtered[0]?.id : undefined,
          });
          updateRegionName(filtered[0].id, allRegionList);

          const filteredArea = allAreaList.filter(
            (item) => item.regionId === filtered[0].id
          );
          setFilteredAreaList((prev) => [...filteredArea]);
        } else {
          LocationForm.setFieldsValue({
            regionId: undefined,
          });
          setFilteredAreaList([]);
        }
        setFilteredRegionList(filtered);
      } else {
        setEmirateName("");
        setEmirateNameAr("");
        setFilteredRegionList([]);
        setFilteredAreaList([]);
      }
    }, [watchEmirateId, emirateList, allRegionList]);

    useEffect(() => {
      if (watchRegionId && allRegionList.length > 0) {
        updateRegionName(watchRegionId, allRegionList);
        const filtered = allAreaList.filter(
          (item) => item.regionId === watchRegionId
        );
        setFilteredAreaList(filtered);
      } else {
        setRegionName("");
        setRegionNameAr("");
        if (regionFormItemRef.current) {
          setFilteredAreaList([]);
        }
      }
    }, [watchRegionId, allRegionList, allAreaList]);

    useEffect(() => {
      if (watchAreaId && allAreaList.length > 0) {
        updateAreaName(watchAreaId, allAreaList);
      } else {
        setAreaName("");
        setAreaNameAr("");
      }
    }, [watchAreaId, allAreaList]);

    useEffect(() => {
      setStreetName(watchStreet || "");
    }, [watchStreet]);

    useEffect(() => {
      setStreetNameAr(watchStreetAr || "");
    }, [watchStreetAr]);

    const handleEmirateChange = () => {
      LocationForm.setFieldsValue({
        regionId: undefined,
        areaId: undefined,
      });
      setRegionName("");
      setRegionNameAr("");
      setAreaName("");
      setAreaNameAr("");
    };

    const handleRegionChange = () => {
      LocationForm.setFieldsValue({
        areaId: undefined,
      });
      setAreaName("");
      setAreaNameAr("");
    };

    const handleAreaChange = () => {
      // Area name is updated via useEffect watching watchAreaId
    };

    const handleStreet = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setStreetName(e.target.value);
    };

    const handleStreetAr = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setStreetNameAr(e.target.value);
    };

    return (
      <div ref={containerRef}>
        <Form<ISEOFieldType>
          form={LocationForm}
          className="custom-form seo-form"
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="emirateId"
                label={t("CMS.addEventManagement.location.emirate")}
                rules={[{ required: true, message: t("CMS.common.requiredField") }]}
                className="form-item"
              >
                <Select
                  placeholder={t("CMS.addEventManagement.location.placeholders.selectEmirate")}
                  onChange={handleEmirateChange}
                >
                  {emirateList.map((emirate) => (
                    <Option key={emirate.id} value={emirate.id}>
                      {emirate.nameEn}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            {watchEmirateId == 1 ? (
              <Col span={12}>
                <Form.Item
                  ref={regionFormItemRef}
                  name="regionId"
                  label={t("CMS.addEventManagement.location.region")}
                  rules={[{ required: true, message: t("CMS.common.requiredField") }]}
                  className="form-item"
                >
                  <Select
                    placeholder={t("CMS.addEventManagement.location.placeholders.selectRegion")}
                    onChange={handleRegionChange}
                  >
                    {filteredRegionList.map((region) => (
                      <Option key={region.id} value={region.id}>
                        {region.nameEn}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            ) : (
              <Col span={12}>
                <Form.Item
                  name="areaId"
                  label={t("CMS.addEventManagement.location.area")}
                  rules={[{ required: true, message: t("CMS.common.requiredField") }]}
                  className="form-item"
                >
                  <Select
                    placeholder={t("CMS.addEventManagement.location.placeholders.selectArea")}
                    onChange={handleAreaChange}
                  >
                    {filteredAreaList.map((area) => (
                      <Option key={area.id} value={area.id}>
                        {area.nameEn}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
          <Row gutter={16}>
            {watchEmirateId == 1 && (
              <Col span={12}>
                <Form.Item
                  name="areaId"
                  label={t("CMS.addEventManagement.location.area")}
                  rules={[{ required: true, message: t("CMS.common.requiredField") }]}
                  className="form-item"
                >
                  <Select
                    placeholder={t("CMS.addEventManagement.location.placeholders.selectArea")}
                    onChange={handleAreaChange}
                  >
                    {filteredAreaList.map((area) => (
                      <Option key={area.id} value={area.id}>
                        {area.nameEn}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="street"
                label={t("CMS.addEventManagement.location.streetEn")}
                rules={[
                  { required: true, message: t("CMS.common.requiredField") },
                ]}
                className="form-item"
              >
                <Input.TextArea
                  placeholder={t("CMS.addEventManagement.location.placeholders.street")}
                  rows={4}
                  maxLength={200}
                  onChange={handleStreet}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="streetAr"
                label={t("CMS.addEventManagement.location.streetAr")}
                rules={[
                  { required: true, message: t("CMS.common.requiredField") },
                ]}
                className="form-item"
              >
                <Input.TextArea
                  placeholder={t("CMS.addEventManagement.location.placeholders.streetAr")}
                  rows={4}
                  maxLength={200}
                  onChange={handleStreetAr}
                  dir="rtl"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    );
  }
);
