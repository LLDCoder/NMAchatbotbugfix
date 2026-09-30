// import "antd/dist/antd.less";
import WarningRed from "@/assets/images/WarningRed.png";

// import "./main.less";
import {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useCallback,
} from "react";
import { useDesigner } from "@designable/react";
import { saveSchema, loadInitialSchema } from "./service";
import { useServiceStore } from "@/store/service-store";

import {
  AddFormStep,
  UpdateFormStep,
  getFormStepList,
  ServiceSaveForm,
  delFormStep,
} from "@/services/serviceApi";
import {
  Select as AntdSelect,
  Space as AntdSpace,
  Modal,
  Input,
  Form,
} from "antd";
import {
  setStoredDesignerContentLang,
  type PortalFormLang,
} from "./FormPreviewLangContext";
import { useTranslation } from "react-i18next";
import { isArabicLanguage } from "@/localization/language";
import type { RefSelectProps } from "antd/es/select";
const { confirm } = Modal;

interface StepProps {
  callParent: () => void;
  contentLang: PortalFormLang;
  setDesignerContentLang: (lang: PortalFormLang) => void;
  onBeforeSchemaLoad?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
}

const Step = forwardRef((props: StepProps, ref) => {
  const {
    contentLang,
    readOnly = false,
    setDesignerContentLang,
    onBeforeSchemaLoad,
    onDirtyChange,
    callParent,
  } = props;
  const { t, i18n } = useTranslation();
  const selectRef = useRef<RefSelectProps>(null);
  const designer = useDesigner();
  const setData = useServiceStore((state) => state.serviceData);
  interface StepFormInfo {
    id?: string | number | null;
    formsData?: string | null;
    [k: string]: unknown;
  }
  interface stepoptionsinterface {
    id?: number;
    stepNameEN?: string;
    stepNameAR?: string;
    code?: string;
    serviceId?: number;
    forms?: StepFormInfo | StepFormInfo[] | null;
    formsData?: string | null;
    formId?: string | number | null;
    [k: string]: unknown;
  }
  const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);
  const getStepDisplayName = (item?: Partial<stepoptionsinterface>) => {
    if (!item) return "";
    return isArabic
      ? item.stepNameAR || item.stepNameEN || ""
      : item.stepNameEN || item.stepNameAR || "";
  };

  const [stepstatus, setstepstatus] = useState<string>("");
  const getStepModalTitle = () =>
    stepstatus === "edit"
      ? t("addNewService.formSteps.editStep")
      : t("addNewService.formSteps.addNewStep");
  const [checkselectValue, setCheckselectValue] =
    useState<stepoptionsinterface>({});
  const [checksEditValue, setchecksEditValue] = useState<stepoptionsinterface>(
    {}
  );
  const [stepoptions, setstepoptions] = useState<stepoptionsinterface[]>([]);
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;

    if (stepstatus === "edit") {
      form.setFieldsValue({
        stepNameEN: checksEditValue.stepNameEN,
        stepNameAR: checksEditValue.stepNameAR,
      });
      return;
    }

    form.resetFields();
  }, [
    checksEditValue.stepNameAR,
    checksEditValue.stepNameEN,
    form,
    open,
    stepstatus,
  ]);
  const hideModal = () => {
    setOpen(false);
  };
  const resetModal = () => {
    form.resetFields();
    setchecksEditValue({});
  };
  const clickModal = () => {
    form.submit();
  };
  const onFinish = (values: { stepNameEN: string; stepNameAR: string }) => {
    if (stepstatus == "edit") {
      const forms = checksEditValue.forms;
      const formId =
        (Array.isArray(forms) ? forms[0]?.id : forms?.id) ??
        checksEditValue.formId;
      UpdateFormStep({
        id: checksEditValue.id as number,
        stepNameEN: values.stepNameEN,
        stepNameAR: values.stepNameAR,
        serviceId: setData.serviceId as number,
        code: checksEditValue.code || "",
        formId,
      }).then(() => {
        setOpen(false);
        FormStepList();
        onDirtyChange?.(true);
      });
    } else {
      AddFormStep({
        NameEN: values.stepNameEN,
        NameAR: values.stepNameAR,
        code: "0",
        id: 0,
        serviceId: setData.serviceId as number,
      }).then(() => {
        setOpen(false);
        FormStepList();
        onDirtyChange?.(true);
      });
    }
  };

  const onFinishFailed = () => {
    // console.log("Failed:", errorInfo);
  };
  const showDeleteConfirm = (item: stepoptionsinterface) => {
    confirm({
      content: (
        <div className="main">
          <img src={WarningRed} />
          <div className="dom">
            <p className="title">
              {t("addNewService.formSteps.deleteStep")}
            </p>
            <p className="content">
              {t("addNewService.formSteps.deleteStepDescription")}
            </p>
          </div>
        </div>
      ),
      okText: t("addNewService.formSteps.confirm"),
      okType: "danger",
      cancelText: t("addNewService.formSteps.cancel"),
      className: "stepDelModel",
      onOk() {
        delFormStep(item.id as number).then(() => {
          FormStepList();
          onDirtyChange?.(true);
        });
      },
      onCancel() {},
    });
  };
  const onSelect = (value: number) => {
    const currentId = checkselectValue.id;
    if (currentId === value) {
      setSelectOpen(false);
      return;
    }
    const selected = stepoptions.find((item) => item.id === value);
    callParent();
    if (selected) {
      setCheckselectValue(selected);
      // if (selected.forms.formsData) setSchema(selected.forms.formsData);
    }
  };
  const setSchema = useCallback((val: string) => {
    localStorage.setItem("formily-schema", val);
    onBeforeSchemaLoad?.();
    loadInitialSchema(designer);
  }, [designer, onBeforeSchemaLoad]);
  useEffect(() => {
    const forms = checkselectValue.forms;
    const schema =
      checkselectValue.formsData ??
      (Array.isArray(forms) ? forms[0]?.formsData : forms?.formsData);
    if (schema) setSchema(schema);
  }, [checkselectValue, setSchema]);
  const [selectOpen, setSelectOpen] = useState(false);
  const FormStepList = useCallback(() => {
    getFormStepList(setData.serviceId ?? undefined).then((res) => {
      const list: stepoptionsinterface[] = Array.isArray(res.data) ? res.data : [];
      setstepoptions(list);

      if (!list.length) {
        setCheckselectValue({});
        return;
      }

      const currentId = checkselectValue.id;
      if (!currentId) {
        setCheckselectValue(list[0]);
        return;
      }

      const latestSelected = list.find((item) => item.id === currentId);
      setCheckselectValue(latestSelected ?? list[0]);
    });
  }, [checkselectValue.id, setData.serviceId]);
  useEffect(() => {
    if(setData.serviceId){
      FormStepList();
    }
  }, [FormStepList, setData.serviceId]);
  useImperativeHandle(ref, () => ({
    saveForm: async () => {
      saveSchema(designer);
      return await ServiceSaveForm({
        serviceId: setData.serviceId as number,
        title: "",
        description: "",
        formsData: localStorage.getItem("formily-schema") || "",
        status: "",
        version: "",
        // createdAt: "",
        // updatedAt: "",
        stepNameEN: checkselectValue.stepNameEN || "",
        stepNameAR: checkselectValue.stepNameAR || "",
        code: checkselectValue.code || "",
        stepId: checkselectValue.id as number,
      }).then(() => {
        FormStepList();
      });
    },
  }));
  return (
    <div className="step">
      <Modal
        centered
        title={getStepModalTitle()}
        visible={open}
        forceRender
        afterClose={resetModal}
        onOk={clickModal}
        onCancel={hideModal}
        okText={t("addNewService.formSteps.save")}
        cancelText={t("addNewService.formSteps.cancel")}
        className="stepModelForm"
      >
        <Form
          form={form}
          name="basic"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item
            label={t("addNewService.formSteps.stepNameInEnglish")}
            name="stepNameEN"
            rules={[
              {
                required: true,
                message: t("addNewService.formSteps.stepNameRequired"),
              },
            ]}
          >
            <Input
              placeholder={t("addNewService.formSteps.enterStepNameInEnglish")}
            />
          </Form.Item>

          <Form.Item
            label={t("addNewService.formSteps.stepNameInArabic")}
            name="stepNameAR"
            rules={[
              {
                required: true,
                message: t("addNewService.formSteps.stepNameRequired"),
              },
            ]}
          >
            <Input
              placeholder={t("addNewService.formSteps.enterStepNameInArabic")}
            />
          </Form.Item>
        </Form>
      </Modal>
      <div className="stepbox">
        <span className="Current">
          {t("addNewService.formSteps.currentStep")}
        </span>
        <AntdSelect
          ref={selectRef}
          value={checkselectValue.id}
          // defaultValue="Application Step 1"
          className="CurrentAntdSelect"
          dropdownClassName="CurrentAntdSelectDropdown"
          optionLabelProp="label"
          open={selectOpen}
          onSelect={onSelect}
          // fieldNames={{ value: "stepNameEN" }}
          onDropdownVisibleChange={(visible) => setSelectOpen(visible)}
          dropdownRender={(menu) => (
            <>
              {menu}
              {!readOnly && (
                <AntdSpace
                  style={{
                    padding: "0 8px 4px",
                  }}
                  className="addAntdSpace"
                >
                  <span
                    style={{ color: "#92722A", cursor: "pointer" }}
                    onClick={() => {
                      selectRef.current?.blur();
                      setstepstatus("add");
                      setSelectOpen(false);
                      setTimeout(() => {
                        setOpen(true);
                      }, 100);
                    }}
                  >
                    {t("addNewService.formSteps.addNewStep")}
                  </span>
                </AntdSpace>
              )}
            </>
          )}
        >
          {stepoptions.map((item) => (
            <AntdSelect.Option
              key={item.id}
              value={item.id}
              label={getStepDisplayName(item)}
            >
              <div className="playgroundoptionlist">
                {getStepDisplayName(item)}
                {!readOnly && (
                  <div
                    className="playgroundoptionlistBtn"
                    style={{
                      display: "flex",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{ color: "#92722A" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRef.current?.blur();
                        setstepstatus("edit");
                        setchecksEditValue(item);
                        setTimeout(() => {
                          setOpen(true);
                        }, 100);
                      }}
                    >
                      {t("addNewService.formSteps.edit")}
                    </span>
                    <span
                      style={{ color: "#92722A" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectRef.current?.blur();
                        showDeleteConfirm(item);
                      }}
                    >
                      {t("addNewService.formSteps.delete")}
                    </span>
                  </div>
                )}
              </div>
            </AntdSelect.Option>
          ))}
        </AntdSelect>
      </div>

      <div className="lan">
        <div
          className={contentLang === "en" ? "lanitem active" : "lanitem"}
          onClick={() => {
            setDesignerContentLang("en");
            setStoredDesignerContentLang("en");
          }}
        >
          {t("addNewService.formSteps.languageEnglish")}
        </div>
        <div
          className={contentLang === "ar" ? "lanitem active" : "lanitem"}
          onClick={() => {
            setDesignerContentLang("ar");
            setStoredDesignerContentLang("ar");
          }}
        >
          {t("addNewService.formSteps.languageArabic")}
        </div>
      </div>
    </div>
  );
});

export default Step;
