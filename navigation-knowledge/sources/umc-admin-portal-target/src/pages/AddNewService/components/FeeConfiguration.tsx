import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Form, Select, InputNumber, Table } from "antd";
import { useTranslation } from "react-i18next";
import SealCheckIcon from "@/assets/images/seal-check.png";
import FileCodeIcon from "@/assets/images/file-code.png";
import EmptyIcon from "@/assets/images/empty.svg";
import { getFeeLinkedService, getSeviceFeeRule } from "@/services/dictionary";
import {
  getEconomicActivitys,
  createServiceFee,
  putUpdateServiceFee,
} from "@/services/serviceApi";
import type { IDict } from "@/services/dictionary";
import "./FeeConfiguration.less";
import { CustomMessage } from "@/components/common";
import Paid from "@/assets/icons/Paid";
import Free from "@/assets/icons/Free";
import { useServiceStore } from "@/store/service-store";
interface FeeConfigurationProps {
  serviceId: number | null;
}
interface ServiceCustomActivityFee {
  id: number;
  customFeeId: number;
  code: string;
  g3code: string;
  economicActivityId: number;
  nameAr: string;
  nameEn: string;
  fee: number;
  creatAt: string;
  updaterAt: string;
  customFee: null | any;
}

export interface CustomFee {
  id: number;
  serviceId: number;
  ruleType: string;
  ruleConfigFile: null | string;
  isFee: boolean;
  version: string;
  creatAt: string;
  updaterAt: string;
  linkedServiceCode: string;
  serviceCustomActivityFees: ServiceCustomActivityFee[];
  serviceCustomActivityFeeDtos: IActivityProps["value"];
}

export interface FeeConfigurationRef {
  save: () => Promise<void>;
  setData: (data: CustomFee) => void;
}

function FeeConfiguration(
  { serviceId }: FeeConfigurationProps,
  ref: React.ForwardedRef<FeeConfigurationRef>,
) {
  const { i18n, t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState("manual");
  const [manualActivity, setManualActivity] = useState<any[]>([]);
  const [form1] = Form.useForm();
  const [form2] = Form.useForm();
  const [feeLinkedService, setFeeLinkedService] = useState<any[]>([]);
  const [feeRules, setFeeRules] = useState<any[]>([]);
  const [activityValue, setActivityValue] = useState<IActivityProps["value"]>(
    {},
  );
  const [id, setId] = useState<number | null>(null);
  const { serviceFee, setServiceFee } = useServiceStore((state) => ({
    serviceFee: state.serviceFee,
    setServiceFee: state.setServiceFee,
  }));
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get("from");
  const [mode, setMode] = useState<string>(from ?? "edit");
  useImperativeHandle(ref, () => {
    return {
      save: async () => {
        let data: any = {};
        if (!checked) {
          data = {
            serviceId,
            isFee: false,
            version: "1",
          };
        }
        if (checked && active === "manual") {
          const feeData = await form1.validateFields();
          if (activityValue) {
            data = {
              ...feeData,
              serviceId,
              isFee: true,
              version: "1",
            };
            if (id) {
              delete data.createActivityFeeDtos;
              data.serviceCustomActivityFeeDtos = Object.keys(
                activityValue,
              ).map((key) => ({
                ...activityValue[key],
              }));
            } else {
              data.createActivityFeeDtos = Object.keys(activityValue).map(
                (key) => ({
                  ...activityValue[key],
                }),
              );
            }
          }
        }
        if (checked && active === "file") {
          const feeData = await form2.validateFields();
          if (activityValue) {
            data = {
              ...feeData,
              serviceId,
              isFee: true,
              version: "1",
            };
          }
        }
        if (id) {
          data.id = id;
          await putUpdateServiceFee(
            id,
            checked ? regManualActivity(manualActivity, data) : data,
          );
          setServiceFee(
            checked ? regManualActivity(manualActivity, data) : data,
          );
          CustomMessage.success("Operation successful!");
        } else {
          await createServiceFee(
            checked ? regManualActivity(manualActivity, data) : data,
          );
          setMode("edit");
          setServiceFee(
            checked ? regManualActivity(manualActivity, data) : data,
          );
          CustomMessage.success("Operation successful!");
        }
      },
      setData: (data) => {
        setServiceFee(data);
      },
    };
  });
  const regManualActivity = (manualActivity: any[], data: any) => {
    const allmanualActivityIds = manualActivity.flatMap((item) => {
      const ids = [item.id];
      if (item.childData && Array.isArray(item.childData)) {
        ids.push(...item.childData.map((child: any) => child.id));
      }
      return ids;
    });
    return {
      ...data,
      serviceCustomActivityFeeDtos: data.serviceCustomActivityFeeDtos.filter(
        (item: any) => allmanualActivityIds.includes(item.economicActivityId),
      ),
    };
  };
  useEffect(() => {
    return () => {
      setServiceFee(null);
    };
  }, []);

  useEffect(() => {
    if (serviceFee) {
      setId(mode === "edit" ? serviceFee.id : null);
      setChecked(serviceFee.isFee);
      if (serviceFee.isFee) {
        if (serviceFee.ruleConfigFile) {
          setActive("file");
          form2.setFieldsValue({
            ruleConfigFile: serviceFee.ruleConfigFile,
          });
        } else {
          let createActivityFeeDtos: IActivityProps["value"] = {};
          if (serviceFee.serviceCustomActivityFees && createActivityFeeDtos) {
            serviceFee.serviceCustomActivityFees.forEach((record) => {
              // @ts-ignore
              createActivityFeeDtos[record.economicActivityId] = record;
            });
          } else if (serviceFee.serviceCustomActivityFeeDtos) {
            createActivityFeeDtos = serviceFee.serviceCustomActivityFeeDtos;
          }
          if (serviceFee.linkedServiceCode) {
            pullEconomicActivitys(serviceFee.linkedServiceCode);
          }
          setActivityValue(createActivityFeeDtos);
          form1.setFieldsValue({
            ...serviceFee,
            createActivityFeeDtos: createActivityFeeDtos,
          });
        }
      }
    }
  }, [serviceFee]);

  useEffect(() => {
    getFeeLinkedService().then((res) => {
      if (Array.isArray(res.data)) {
        setFeeLinkedService(res.data || []);
      }
    });
    getSeviceFeeRule().then((res) => {
      if (Array.isArray(res.data)) {
        setFeeRules(res.data || []);
      }
    });
  }, []);

  function pullEconomicActivitys(v: string) {
    getEconomicActivitys(v).then((res) => {
      if (Array.isArray(res.data)) {
        setManualActivity(res.data || []);
      }
    });
  }
  const getSelectTableSchema = () => {
    try {
      const formilySchema = window.localStorage.getItem("formily-schema");
      if (!formilySchema) return null;

      const parsed = JSON.parse(formilySchema);
      return parsed?.schema?.properties?.SelectTable || null;
    } catch (error) {
      console.warn("notfound formily-schema:", error);
      return null;
    }
  };
  const isView = new URLSearchParams(location.search).get("view") === "1";
  return (
    <div
      className={`fee-configuration-container ${isView ? "page-disabled" : ""}`}
    >
      <div
        className={`fee-configuration-box ${
          checked && active === "manual" ? "fee-configuration-wrapper" : ""
        }`}
      >
        <div className="fee-header">
          <div>
            <div className="fee-header-title">Payment Type</div>
            <div className="fee-header-desc">
              Choose whether this service requires a fee
            </div>
          </div>
          <div className="custorm-form fee-header-switch">
            <div className="fee-header-switch-wrapper">
              <div
                className={`fee-header-switch-paid ${
                  checked ? "fee-header-switch-active" : ""
                }`}
                onClick={() => setChecked(true)}
              >
                <Paid />
                Paid
              </div>
              <div
                className={`fee-header-switch-free ${
                  !checked ? "fee-header-switch-active" : ""
                }`}
                onClick={() => setChecked(false)}
              >
                <Free />
                Free
              </div>
            </div>
          </div>
        </div>
        {!checked && (
          <div className="fee-body-nocharge">
            <div>Applicants can submit this service with no charge.</div>
            <div>
              Total Cost: <span>0 AED</span>
            </div>
          </div>
        )}
        {checked && (
          <div className="fee-body-wrapper">
            <div className="fee-body-config">
              <div
                className={`fee-body-config-item ${
                  active === "manual" ? "active" : ""
                }`}
                onClick={() => setActive("manual")}
              >
                <div className="fee-body-config-icon">
                  <img src={SealCheckIcon} />
                </div>
                <div>
                  <div className="fee-body-title">Manual Confiquration</div>
                </div>
              </div>
              <div
                className={`fee-body-config-item ${
                  active === "file" ? "active" : ""
                }`}
                onClick={() => setActive("file")}
              >
                <div className="fee-body-config-icon">
                  <img src={FileCodeIcon} />
                </div>
                <div>
                  <div className="fee-body-title">Formula-based</div>
                </div>
              </div>
            </div>
            <div className="fee-body-manual">
              {active === "manual" && (
                <Form
                  form={form1}
                  layout="vertical"
                  className="custorm-form fee-manual-form"
                >
                  <Form.Item
                    name="linkedServiceCode"
                    label="Linked Service"
                    rules={[
                      { required: true, message: "Please select a service" },
                    ]}
                  >
                    <Select
                      defaultValue={getSelectTableSchema()}
                      getPopupContainer={(node) => node}
                      onChange={pullEconomicActivitys}
                      placeholder="Select a service"
                    >
                      {feeLinkedService?.map((item: IDict) => (
                        <Select.Option key={item.code} value={item.code}>
                          {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="ruleType"
                    label="Fee Rules"
                    rules={[
                      { required: true, message: "Please select a fee rule" },
                    ]}
                  >
                    <Select
                      getPopupContainer={(node) => node}
                      placeholder="Select a fee rule"
                    >
                      {feeRules?.map((item: IDict) => (
                        <Select.Option key={item.code} value={item.code}>
                          {i18n.resolvedLanguage === "en" ? item.nameEn : item.nameAr}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    className="fee-manual-activity-wrapper"
                    name="createActivityFeeDtos"
                    label="Activity"
                    rules={[
                      {
                        required: true,
                        message:
                          "Please select a service to configure activity fees",
                      },
                    ]}
                  >
                    <Activity
                      data={manualActivity}
                      value={activityValue}
                      onChange={(value) => {
                        setActivityValue(value);
                      }}
                    />
                  </Form.Item>
                </Form>
              )}
            </div>
          </div>
        )}
      </div>
      {checked && active === "file" && (
        <div className="fee-file">
          <div className="fee-file-title">Payment Details</div>
          <Form
            form={form2}
            layout="vertical"
            className="custorm-form fee-file-form"
          >
            <Form.Item
              name="ruleConfigFile"
              label="Configuration File"
              rules={[
                {
                  required: true,
                  message: "Please select a configuration file",
                },
              ]}
            >
              <Select />
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );
}

export default React.forwardRef(FeeConfiguration);

interface IActivityItem {
  id: number;
  nameAr: string | null;
  nameEn: string | null;
  code: string;
  isRequireThirdPartyApproval: boolean;
  descAr: string | null;
  descEn: string | null;
  isShown: boolean;
  isForFreezone: boolean;
  isAllowedForIndividual: boolean;
  isForSpc: boolean;
  parentId: number;
  serviceTypeCode: string;
  serviceTypeName: string | null;
  childData: any | null;
  number?: number;
}
interface IActivityData {
  id: number;
  nameAr: string | null;
  nameEn: string | null;
  code: string;
  isRequireThirdPartyApproval: boolean;
  descAr: string | null;
  descEn: string | null;
  isShown: boolean;
  isForFreezone: boolean;
  isAllowedForIndividual: boolean;
  isForSpc: boolean;
  parentId: number;
  serviceTypeCode: string;
  serviceTypeName: string | null;
  childData: IActivityItem[] | null;
}
interface IActivityFeeDto {
  economicActivityId: number;
  nameAr: string;
  nameEn: string;
  fee: number | null;
}

interface IActivityProps {
  value: { [key: string]: IActivityFeeDto } | null;
  onChange: (v: IActivityProps["value"]) => void;
  data: IActivityData[];
}

function Activity({ data, value = {}, onChange }: IActivityProps) {
  const { i18n } = useTranslation();
  const memoData = useMemo(() => {
    return data.map((item) => {
      if (!item.childData) {
        return {
          ...item,
          nameEn: "",
          nameAr: "",
          childData: [
            {
              ...item,
              number: 1,
            },
          ],
        };
      } else {
        return {
          ...item,
          childData: item.childData?.map((one, index) => {
            return {
              ...one,
              number: index + 1,
            };
          }),
        };
      }
    });
  }, [data]);
  const columns = [
    {
      title: "Number",
      dataIndex: "number",
      key: "number",
    },
    {
      title: "Activity",
      dataIndex: i18n.resolvedLanguage === "ar" ? "nameAr" : "nameEn",
      key: "activity",
    },
    {
      title: "Fee",
      dataIndex: "fee",
      key: "fee",
      render: (_: string, record: IActivityItem) => {
        return (
          <div className="custorm-form fee-input-number">
            <InputNumber
              min={0}
              value={value?.[record.id]?.fee}
              onChange={(v) => {
                if (!value) value = {};
                if (v !== null && v !== undefined && v !== "") {
                  value[record.id] = {
                    economicActivityId: record.id,
                    nameAr: record.nameAr || "",
                    nameEn: record.nameEn || "",
                    fee: v,
                  };
                } else {
                  delete value[record.id];
                }
                onChange(Object.keys(value).length === 0 ? null : { ...value });
              }}
            />
          </div>
        );
      },
    },
  ];
  return (
    <div className="fee-manual-activity">
      {(!data || data.length === 0) && (
        <div className="fee-manual-activity-empty">
          <img src={EmptyIcon} alt="empty" />
          <div>Please select a service to configure activity fees</div>
        </div>
      )}
      {data && data.length > 0 && (
        <div className="fee-manual-activity-tables">
          {memoData.map((item) => (
            <div className="fee-manual-activity-tables-item">
              <div className="fee-manual-activity-tables-title">
                {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
              </div>
              <Table
                className="admin-table fee-manual-table"
                key={item.id}
                columns={columns}
                dataSource={item?.childData ?? []}
                pagination={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
