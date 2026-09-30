import "@wangeditor/editor/dist/css/style.css";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Form, Input, Switch } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { i18nChangeLanguage } from "@wangeditor/editor";
import type {
  IDomEditor,
  IEditorConfig,
} from "@wangeditor/editor";
import { useLocation, useHistory } from "react-router-dom";
import {
  getMessageTemplateById,
  testBroadcastTemplate,
  updateMessageTemplate,
  type MessageTemplateDetail,
} from "@/services/messageTemplate";
import {
  ConfirmModal,
  CustomButton,
  CustomFooter,
  FormPanel,
  RichTextEditor,
  CustomMessage,
  TestConfirmModal,
} from "@/components/common";
import type { FormPanelSectionConfig } from "@/components/common/FormPanel";
import EnvelopeSimpleIcon from "@/assets/images/EnvelopeSimple.svg";
import ChatDotsIcon from "@/assets/images/ChatDots.svg";
import BellRingingIcon from "@/assets/images/BellRinging.svg";
import "./index.less";
import moment from "moment";
import { useUserStore } from "@/store/user";
import { useTranslation } from "react-i18next";

interface TemplateData {
  templateId: string;
  modifiedBy: string;
  lastUpdatedTime: string;
  templateName: string;
  protalTypes: string;
  protalType: string;
  description: string;
  channels: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  emailSubjectEn: string;
  emailBodyEn: string;
  emailSubjectAr: string;
  emailBodyAr: string;
  smsBodyEn: string;
  smsBodyAr: string;
  inAppTitleEn: string;
  inAppBodyEn: string;
  inAppTitleAr: string;
  inAppBodyAr: string;
  channelsInfo?: {
    code: string;
    name: string;
  }[];
}

const EditTemplate: React.FC = () => {
  const { t } = useTranslation();
  const et = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.editTemplate.${key}` as never, opts))
        : String(t(`Settings.editTemplate.${key}` as never)),
    [t],
  );
  const location = useLocation();
  const history = useHistory();
  const userInfo = useUserStore((state) => state.userInfo);
  const [templateData, setTemplateData] = useState<TemplateData>({
    templateId: "Admin-001",
    modifiedBy: "Asma Alhammadi",
    lastUpdatedTime: "18/11/2025 12:12:12",
    templateName: "Approval Result Notification",
    protalTypes: "",
    protalType: "Admin",
    description:
      "This notification informs the user that their submission has been successfully reviewed and approved. It confirms the approval status and may include relevant details such as the request type, reference number, and any next steps required.",
    channels: {
      email: false,
      sms: false,
      inApp: false,
    },
    emailSubjectEn: "Enter email subject in English",
    emailBodyEn: "",
    emailSubjectAr: "Enter email subject in Arabic",
    emailBodyAr: "",
    smsBodyEn: "",
    smsBodyAr: "",
    inAppTitleEn: "",
    inAppBodyEn: "",
    inAppTitleAr: "",
    inAppBodyAr: "",
  });
  const [testing, setTesting] = useState(false);
  const [testConfirmVisible, setTestConfirmVisible] = useState(false);
  const handleTest = async () => {
    try {
      setTesting(true);
      if (!templateDetail?.id) {
        CustomMessage.error(et("messages.operationFailed"));
        return;
      }
      const response = await testBroadcastTemplate(templateDetail.id);
      const success =
        typeof response === "boolean"
          ? response
          : typeof response.data === "boolean"
            ? response.data
            : response.isSuccess === true &&
              typeof response.statusCode === "number" &&
              response.statusCode >= 200 &&
              response.statusCode < 300;
      if (success) {
        CustomMessage.success(et("messages.operationSuccess"));
      } else {
        CustomMessage.error(et("messages.operationFailed"));
      }
    } catch (error) {
      console.error("Template test failed", error);
      CustomMessage.error(et("messages.operationFailed"));
    } finally {
      setTesting(false);
      setTestConfirmVisible(false);
    }
  };
  const [templateDetail, setTemplateDetail] =
    useState<MessageTemplateDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const [emailEnEditor, setEmailEnEditor] = useState<IDomEditor | null>(null);
  const [emailArEditor, setEmailArEditor] = useState<IDomEditor | null>(null);
  const [smsEnEditor, setSmsEnEditor] = useState<IDomEditor | null>(null);
  const [smsArEditor, setSmsArEditor] = useState<IDomEditor | null>(null);
  const [inAppEnEditor, setInAppEnEditor] = useState<IDomEditor | null>(null);
  const [inAppArEditor, setInAppArEditor] = useState<IDomEditor | null>(null);

  const [emailExpanded, setEmailExpanded] = useState(false);
  const [smsExpanded, setSmsExpanded] = useState(false);
  const [inAppExpanded, setInAppExpanded] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [initialTemplateData, setInitialTemplateData] =
    useState<TemplateData | null>(null);

  const [emailSubjectEnForm] = Form.useForm();
  const [emailSubjectArForm] = Form.useForm();
  const [inAppTitleEnForm] = Form.useForm();
  const [inAppTitleArForm] = Form.useForm();
  const [emailBodyEnForm] = Form.useForm();
  const [emailBodyArForm] = Form.useForm();
  const [smsBodyEnForm] = Form.useForm();
  const [smsBodyArForm] = Form.useForm();
  const [inAppBodyEnForm] = Form.useForm();
  const [inAppBodyArForm] = Form.useForm();

  useEffect(() => {
    i18nChangeLanguage("en");
  }, []);

  const handleBack = () => {
    history.goBack();
    setLeaveVisible(false);
  };

  const hasUnsavedChanges = () => {
    if (!initialTemplateData) return false;

    // Get current form values
    const currentEmailSubjectEn =
      emailSubjectEnForm.getFieldValue("emailSubjectEn") || "";
    const currentEmailSubjectAr =
      emailSubjectArForm.getFieldValue("emailSubjectAr") || "";
    const currentInAppTitleEn =
      inAppTitleEnForm.getFieldValue("inAppTitleEn") || "";
    const currentInAppTitleAr =
      inAppTitleArForm.getFieldValue("inAppTitleAr") || "";

    // Compare with initial data
    return (
      JSON.stringify(templateData.channels) !==
        JSON.stringify(initialTemplateData.channels) ||
      currentEmailSubjectEn !== initialTemplateData.emailSubjectEn ||
      currentEmailSubjectAr !== initialTemplateData.emailSubjectAr ||
      templateData.emailBodyEn !== initialTemplateData.emailBodyEn ||
      templateData.emailBodyAr !== initialTemplateData.emailBodyAr ||
      templateData.smsBodyEn !== initialTemplateData.smsBodyEn ||
      templateData.smsBodyAr !== initialTemplateData.smsBodyAr ||
      currentInAppTitleEn !== initialTemplateData.inAppTitleEn ||
      currentInAppTitleAr !== initialTemplateData.inAppTitleAr ||
      templateData.inAppBodyEn !== initialTemplateData.inAppBodyEn ||
      templateData.inAppBodyAr !== initialTemplateData.inAppBodyAr
    );
  };

  useEffect(() => {
    const fetchDetail = async () => {
      const searchParams = new URLSearchParams(location.search);
      const id = searchParams.get("id");
      if (!id) return;
      try {
        const res = await getMessageTemplateById(id);
        const data = res.data;
        setTemplateDetail(data);
        const channelsValue = data.channels || "";
        const hasEmail = channelsValue.includes("1");
        const hasSms = channelsValue.includes("2");
        const hasInApp = channelsValue.includes("3");

        setTemplateData({
          templateId: data.templateNumber || data.templateCode || "-",
          modifiedBy: data.updateOnInfo?.name || "-",
          lastUpdatedTime: data.updateAt
            ? moment(data.updateAt).format("DD/MM/YYYY HH:mm:ss")
            : "-",
          templateName: data.templateName || "-",
          protalTypes:
            data.protalTypeInfo?.map((item) => item.name).join(",") || "-",
          protalType: data.protalType || "-",
          description: data.description || "-",
          channels: {
            email: hasEmail,
            sms: hasSms,
            inApp: hasInApp,
          },
          channelsInfo: data.channelsInfo,
          emailSubjectEn: data.emailSubjectEn,
          emailBodyEn: data.emailBodyEn,
          emailSubjectAr: data.emailSubjectAr,
          emailBodyAr: data.emailBodyAr,
          smsBodyEn: data.smsen,
          smsBodyAr: data.smsar,
          inAppTitleEn: data.inAppTitleEn,
          inAppBodyEn: data.inAppMessageEn,
          inAppTitleAr: data.inAppTitleAr,
          inAppBodyAr: data.inAppMessageAr,
        });

        // Store initial data for comparison
        const initialData = {
          templateId: data.templateNumber || data.templateCode || "-",
          modifiedBy: data.updateOnInfo?.name || "-",
          lastUpdatedTime: data.updateAt
            ? moment(data.updateAt).format("DD/MM/YYYY HH:mm:ss")
            : "-",
          templateName: data.templateName || "-",
          protalTypes:
            data.protalTypeInfo?.map((item) => item.name).join(",") || "-",
          protalType: data.protalType || "-",
          description: data.description || "-",
          channels: {
            email: hasEmail,
            sms: hasSms,
            inApp: hasInApp,
          },
          channelsInfo: data.channelsInfo,
          emailSubjectEn: data.emailSubjectEn,
          emailBodyEn: data.emailBodyEn,
          emailSubjectAr: data.emailSubjectAr,
          emailBodyAr: data.emailBodyAr,
          smsBodyEn: data.smsen,
          smsBodyAr: data.smsar,
          inAppTitleEn: data.inAppTitleEn,
          inAppBodyEn: data.inAppMessageEn,
          inAppTitleAr: data.inAppTitleAr,
          inAppBodyAr: data.inAppMessageAr,
        };
        setInitialTemplateData(initialData);
        emailSubjectEnForm.setFieldsValue({
          emailSubjectEn: data.emailSubjectEn,
        });
        emailSubjectArForm.setFieldsValue({
          emailSubjectAr: data.emailSubjectAr,
        });
        emailBodyEnForm.setFieldsValue({ emailBodyEn: data.emailBodyEn });
        emailBodyArForm.setFieldsValue({ emailBodyAr: data.emailBodyAr });
        smsBodyEnForm.setFieldsValue({ smsBodyEn: data.smsen });
        smsBodyArForm.setFieldsValue({ smsBodyAr: data.smsar });
        inAppTitleEnForm.setFieldsValue({ inAppTitleEn: data.inAppTitleEn });
        inAppTitleArForm.setFieldsValue({ inAppTitleAr: data.inAppTitleAr });
        inAppBodyEnForm.setFieldsValue({ inAppBodyEn: data.inAppMessageEn });
        inAppBodyArForm.setFieldsValue({ inAppBodyAr: data.inAppMessageAr });
      } catch (error) {
        console.error(error);
      }
    };

    fetchDetail();
  }, [location.search]);

  // useEffect(() => {
  //   return () => {
  //     [emailEnEditor, emailArEditor, inAppEnEditor, inAppArEditor].forEach(
  //       (editor) => {
  //         if (editor) {
  //           editor.destroy();
  //         }
  //       }
  //     );
  //   };
  // }, [emailEnEditor, emailArEditor, inAppEnEditor, inAppArEditor]);

  const editorConfig: Partial<IEditorConfig> = useMemo(
    () => ({
      placeholder: "",
      maxLength: 500,
    }),
    [],
  );

  const templatePropertiesSections = useMemo((): FormPanelSectionConfig[] => {
    return [
      {
        key: "template-properties",
        title: et("sections.templateProperties"),
        columns: 3,
        items: [
          { key: "templateId", label: et("labels.templateNo") },
          { key: "lastUpdatedTime", label: et("labels.lastUpdatedTime") },
          { key: "modifiedBy", label: et("labels.modifiedBy") },
        ],
      },
    ];
  }, [et]);

  const basicInformationSections = useMemo((): FormPanelSectionConfig[] => {
    return [
      {
        key: "basic-information",
        title: et("sections.basicInformation"),
        columns: 3,
        items: [
          { key: "templateName", label: et("labels.templateName") },
          { key: "protalTypes", label: et("labels.portalType") },
          { key: "description", label: et("labels.description") },
        ],
      },
    ];
  }, [et]);
  const variableTags = [
    "{{customer_name}}",
    "{{license_number}}",
    "{{expiry_date}}",
    "{{days_remaining}}",
    "{{request_type}}",
    "{{fine_amount}}",
  ];
  const isEditorContentEmpty = (html: string) => {
    const text = html
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim();
    return !text;
  };
  const canRunTest = () => {
    const { channels } = templateData;
    if (!channels.email && !channels.sms && !channels.inApp) return false;

    const isTextEmpty = (value?: string) => !value || !value.trim();

    if (channels.email) {
      if (
        isTextEmpty(templateData.emailSubjectEn) ||
        isTextEmpty(templateData.emailSubjectAr) ||
        isEditorContentEmpty(templateData.emailBodyEn) ||
        isEditorContentEmpty(templateData.emailBodyAr)
      ) {
        return false;
      }
    }

    if (channels.sms) {
      if (
        isEditorContentEmpty(templateData.smsBodyEn) ||
        isEditorContentEmpty(templateData.smsBodyAr)
      ) {
        return false;
      }
    }

    if (channels.inApp) {
      if (
        isTextEmpty(templateData.inAppTitleEn) ||
        isTextEmpty(templateData.inAppTitleAr) ||
        isEditorContentEmpty(templateData.inAppBodyEn) ||
        isEditorContentEmpty(templateData.inAppBodyAr)
      ) {
        return false;
      }
    }

    return true;
  };

  const handleChannelToggle = (channel: "email" | "sms" | "inApp") => {
    setTemplateData((prev) => {
      const flag = !prev.channels[channel];
      if (channel === "email") {
        setEmailExpanded(flag);
      }
      if (channel === "sms") {
        setSmsExpanded(flag);
      }
      if (channel === "inApp") {
        setInAppExpanded(flag);
      }
      return {
        ...prev,
        channels: {
          ...prev.channels,
          [channel]: flag,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!templateDetail || saving) return;

    let hasValidationError = false;

    if (templateData.channels.email) {
      const results = await Promise.allSettled([
        emailSubjectEnForm.validateFields(),
        emailSubjectArForm.validateFields(),
        emailBodyEnForm.validateFields(),
        emailBodyArForm.validateFields(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        hasValidationError = true;
      }
    }

    if (templateData.channels.sms) {
      const results = await Promise.allSettled([
        smsBodyEnForm.validateFields(),
        smsBodyArForm.validateFields(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        hasValidationError = true;
      }
    }

    if (templateData.channels.inApp) {
      const results = await Promise.allSettled([
        inAppTitleEnForm.validateFields(),
        inAppTitleArForm.validateFields(),
        inAppBodyEnForm.validateFields(),
        inAppBodyArForm.validateFields(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        hasValidationError = true;
      }
    }

    if (hasValidationError) {
      return;
    }
    setSaving(true);
    const channelCodes: string[] = [];
    if (templateData.channels.email) channelCodes.push("1");
    if (templateData.channels.sms) channelCodes.push("2");
    if (templateData.channels.inApp) channelCodes.push("3");

    // Get latest values from forms
    const emailSubjectEnValues = emailSubjectEnForm.getFieldsValue();
    const emailSubjectArValues = emailSubjectArForm.getFieldsValue();
    const inAppTitleEnValues = inAppTitleEnForm.getFieldsValue();
    const inAppTitleArValues = inAppTitleArForm.getFieldsValue();

    const payload: MessageTemplateDetail = {
      ...templateDetail,
      templateCode: templateData.templateId,
      templateName: templateData.templateName,
      protalType: templateData.protalType,
      description: templateData.description,
      channels: channelCodes.join(","),
      emailSubjectEn:
        emailSubjectEnValues.emailSubjectEn || templateData.emailSubjectEn,
      emailSubjectAr:
        emailSubjectArValues.emailSubjectAr || templateData.emailSubjectAr,
      emailBodyEn: templateData.emailBodyEn,
      emailBodyAr: templateData.emailBodyAr,
      smsen: templateData.smsBodyEn,
      smsar: templateData.smsBodyAr,
      inAppTitleEn:
        inAppTitleEnValues.inAppTitleEn || templateData.inAppTitleEn,
      inAppTitleAr:
        inAppTitleArValues.inAppTitleAr || templateData.inAppTitleAr,
      inAppMessageEn: templateData.inAppBodyEn,
      inAppMessageAr: templateData.inAppBodyAr,
      updateOn: userInfo.id,
    };

    try {
      await updateMessageTemplate(payload);
      history.goBack();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const renderVariableTags = (onTagClick?: (tag: string) => void) => (
    <div className="variable-tags">
      {variableTags.map((tag) => (
        <span
          key={tag}
          className="tag"
          onClick={() => {
            console.log("variable tag clicked", tag);
            if (onTagClick) {
              onTagClick(tag);
            }
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );

  return (
    <div className="edit-template">
      <FormPanel
        mode="view"
        record={templateData}
        sections={templatePropertiesSections}
      />

      <FormPanel
        mode="view"
        record={templateData}
        sections={basicInformationSections}
      />
      <div className="channels-wrapper">
        <h3>{et("sections.channelsContent")}</h3>
        <div className="section channels-content">
          <div
            className={`channel-panel ${
              templateData.channels.email ? "enabled" : ""
            } ${emailExpanded ? "expanded" : ""}`}
          >
            <div
              className="channel-header"
              onClick={() => {
                if (!templateData.channels.email) return;
                setEmailExpanded((v) => !v);
              }}
            >
              <div className="channel-title">
                <img src={EnvelopeSimpleIcon} />
                <span>{et("channels.email")}</span>
              </div>
              <div className="channel-actions">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Switch
                    checked={templateData.channels.email}
                    onChange={() => handleChannelToggle("email")}
                  />
                </div>
                <div className="arrow-wrapper">
                  {templateData.channels.email && (
                    <DownOutlined
                      className={`arrow ${emailExpanded ? "open" : ""}`}
                    />
                  )}
                </div>
              </div>
            </div>
            <div
              className="channel-body"
              style={{ display: emailExpanded ? "block" : "none" }}
            >
              <div>
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={emailSubjectEnForm}
                  initialValues={{
                    emailSubjectEn: templateData.emailSubjectEn,
                  }}
                  onValuesChange={(_, values) => {
                    if (values.emailSubjectEn !== undefined) {
                      setTemplateData((prev) => ({
                        ...prev,
                        emailSubjectEn: values.emailSubjectEn,
                      }));
                    }
                  }}
                >
                  <Form.Item
                    label={et("labels.emailSubjectEn")}
                    name="emailSubjectEn"
                    rules={[
                      {
                        required: true,
                        message: et("validation.emailSubjectEnRequired"),
                      },
                    ]}
                  >
                    <Input placeholder={et("placeholders.emailSubjectEn")} />
                  </Form.Item>
                </Form>
              </div>

              <div className="editor-block editor-blockTop">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={emailBodyEnForm}
                  initialValues={{ emailBodyEn: templateData.emailBodyEn }}
                >
                  <Form.Item
                    label={et("labels.emailBodyEn")}
                    name="emailBodyEn"
                    rules={[
                      {
                        required: true,
                        message: et("validation.emailBodyEnRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(et("validation.emailBodyEnRequired")),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Email Body in English <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!emailEnEditor) return;
                  emailEnEditor.focus();
                  emailEnEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.emailBodyEn}
                  editor={emailEnEditor}
                  onCreated={setEmailEnEditor}
                  maxLength={1000}
                  showCharCount
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      emailBodyEn: html,
                    }));
                    emailBodyEnForm.setFieldsValue({ emailBodyEn: html });
                  }}
                  editorConfig={editorConfig}
                  // toolbarConfig={toolbarConfig}
                />
              </div>

              <div className="two-columns">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={emailSubjectArForm}
                  initialValues={{
                    emailSubjectAr: templateData.emailSubjectAr,
                  }}
                  onValuesChange={(_, values) => {
                    if (values.emailSubjectAr !== undefined) {
                      setTemplateData((prev) => ({
                        ...prev,
                        emailSubjectAr: values.emailSubjectAr,
                      }));
                    }
                  }}
                >
                  <Form.Item
                    label={et("labels.emailSubjectAr")}
                    name="emailSubjectAr"
                    rules={[
                      {
                        required: true,
                        message: et("validation.emailSubjectArRequired"),
                      },
                    ]}
                  >
                    <Input
                      dir="rtl"
                      placeholder={et("placeholders.emailSubjectAr")}
                    />
                  </Form.Item>
                </Form>
              </div>

              <div className="editor-block">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={emailBodyArForm}
                  initialValues={{ emailBodyAr: templateData.emailBodyAr }}
                >
                  <Form.Item
                    label={et("labels.emailBodyAr")}
                    name="emailBodyAr"
                    rules={[
                      {
                        required: true,
                        message: et("validation.emailBodyArRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(et("validation.emailBodyArRequired")),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Email Body in Arabic <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!emailArEditor) return;
                  emailArEditor.focus();
                  emailArEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.emailBodyAr}
                  editor={emailArEditor}
                  onCreated={setEmailArEditor}
                  dir="rtl"
                  className="edit-template__arabic-editor"
                  maxLength={1000}
                  showCharCount
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      emailBodyAr: html,
                    }));
                    emailBodyArForm.setFieldsValue({ emailBodyAr: html });
                  }}
                  editorConfig={{
                    placeholder: "",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className={`channel-panel ${
              templateData.channels.sms ? "enabled" : ""
            } ${smsExpanded ? "expanded" : ""}`}
          >
            <div
              className="channel-header"
              onClick={() => {
                if (!templateData.channels.sms) return;
                setSmsExpanded((v) => !v);
              }}
            >
              <div className="channel-title">
                <img src={ChatDotsIcon} />
                <span>{et("channels.sms")}</span>
              </div>
              <div className="channel-actions">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Switch
                    checked={templateData.channels.sms}
                    onChange={() => handleChannelToggle("sms")}
                  />
                </div>
                <div className="arrow-wrapper">
                  {templateData.channels.sms && (
                    <DownOutlined
                      className={`arrow ${smsExpanded ? "open" : ""}`}
                    />
                  )}
                </div>
              </div>
            </div>
            <div
              className="channel-body"
              style={{ display: smsExpanded ? "block" : "none" }}
            >
              <div className="editor-block editor-blockTop">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={smsBodyEnForm}
                  initialValues={{ smsBodyEn: templateData.smsBodyEn }}
                >
                  <Form.Item
                    label={et("labels.smsMessageEn")}
                    name="smsBodyEn"
                    rules={[
                      {
                        required: true,
                        message: et("validation.smsMessageEnRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(et("validation.smsMessageEnRequired")),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Message in English <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!smsEnEditor) return;
                  smsEnEditor.focus();
                  smsEnEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.smsBodyEn}
                  editor={smsEnEditor}
                  maxLength={1000}
                  showCharCount
                  onCreated={setSmsEnEditor}
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      smsBodyEn: html,
                    }));
                    smsBodyEnForm.setFieldsValue({ smsBodyEn: html });
                  }}
                  editorConfig={{
                    placeholder: "",
                  }}
                />
              </div>
              <div className="editor-block">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={smsBodyArForm}
                  initialValues={{ smsBodyAr: templateData.smsBodyAr }}
                >
                  <Form.Item
                    label={et("labels.smsMessageAr")}
                    name="smsBodyAr"
                    rules={[
                      {
                        required: true,
                        message: et("validation.smsMessageArRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(et("validation.smsMessageArRequired")),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Message in Arabic <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!smsArEditor) return;
                  smsArEditor.focus();
                  smsArEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.smsBodyAr}
                  editor={smsArEditor}
                  maxLength={1000}
                  onCreated={setSmsArEditor}
                  dir="rtl"
                  className="edit-template__arabic-editor"
                  showCharCount
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      smsBodyAr: html,
                    }));
                    smsBodyArForm.setFieldsValue({ smsBodyAr: html });
                  }}
                  editorConfig={{
                    placeholder: "",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className={`channel-panel ${
              templateData.channels.inApp ? "enabled" : ""
            } ${inAppExpanded ? "expanded" : ""}`}
          >
            <div
              className="channel-header"
              onClick={() => {
                if (!templateData.channels.inApp) return;
                setInAppExpanded((v) => !v);
              }}
            >
              <div className="channel-title">
                <img src={BellRingingIcon} />
                <span>{et("channels.inPortal")}</span>
              </div>
              <div className="channel-actions">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Switch
                    checked={templateData.channels.inApp}
                    onChange={() => handleChannelToggle("inApp")}
                  />
                </div>
                <div className="arrow-wrapper">
                  {templateData.channels.inApp && (
                    <DownOutlined
                      className={`arrow ${inAppExpanded ? "open" : ""}`}
                    />
                  )}
                </div>
              </div>
            </div>
            <div
              className="channel-body"
              style={{ display: inAppExpanded ? "block" : "none" }}
            >
              <div>
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={inAppTitleEnForm}
                  initialValues={{ inAppTitleEn: templateData.inAppTitleEn }}
                  onValuesChange={(_, values) => {
                    if (values.inAppTitleEn !== undefined) {
                      setTemplateData((prev) => ({
                        ...prev,
                        inAppTitleEn: values.inAppTitleEn,
                      }));
                    }
                  }}
                >
                  <Form.Item
                    label={et("labels.inAppTitleEn")}
                    name="inAppTitleEn"
                    rules={[
                      {
                        required: true,
                        message: et("validation.inAppTitleEnRequired"),
                      },
                    ]}
                  >
                    <Input placeholder={et("placeholders.inAppTitleEn")} />
                  </Form.Item>
                </Form>
              </div>

              <div className="editor-block editor-blockTop">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={inAppBodyEnForm}
                  initialValues={{ inAppBodyEn: templateData.inAppBodyEn }}
                >
                  <Form.Item
                    label={et("labels.inAppMessageEn")}
                    name="inAppBodyEn"
                    rules={[
                      {
                        required: true,
                        message: et("validation.inAppMessageEnRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(
                                et("validation.inAppMessageEnRequired"),
                              ),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Message in English <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!inAppEnEditor) return;
                  inAppEnEditor.focus();
                  inAppEnEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.inAppBodyEn}
                  editor={inAppEnEditor}
                  onCreated={setInAppEnEditor}
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      inAppBodyEn: html,
                    }));
                    inAppBodyEnForm.setFieldsValue({ inAppBodyEn: html });
                  }}
                />
              </div>

              <div className="two-columns">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={inAppTitleArForm}
                  initialValues={{ inAppTitleAr: templateData.inAppTitleAr }}
                  onValuesChange={(_, values) => {
                    if (values.inAppTitleAr !== undefined) {
                      setTemplateData((prev) => ({
                        ...prev,
                        inAppTitleAr: values.inAppTitleAr,
                      }));
                    }
                  }}
                >
                  <Form.Item
                    label={et("labels.inAppTitleAr")}
                    name="inAppTitleAr"
                    rules={[
                      {
                        required: true,
                        message: et("validation.inAppTitleArRequired"),
                      },
                    ]}
                  >
                    <Input
                      dir="rtl"
                      className="edit-template__arabic-input"
                      placeholder={et("placeholders.inAppTitleAr")}
                    />
                  </Form.Item>
                </Form>
              </div>

              <div className="editor-block">
                <Form
                  layout="vertical"
                  className="custorm-form"
                  form={inAppBodyArForm}
                  initialValues={{ inAppBodyAr: templateData.inAppBodyAr }}
                >
                  <Form.Item
                    label={et("labels.inAppMessageAr")}
                    name="inAppBodyAr"
                    rules={[
                      {
                        required: true,
                        message: et("validation.inAppMessageArRequired"),
                      },
                      {
                        validator: (_, value) => {
                          if (!value || isEditorContentEmpty(value)) {
                            return Promise.reject(
                              new Error(
                                et("validation.inAppMessageArRequired"),
                              ),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  ></Form.Item>
                </Form>
                {/* <label className="field-label">Message in Arabic <span className="required">*</span></label> */}
                {renderVariableTags((tag) => {
                  if (!inAppArEditor) return;
                  inAppArEditor.focus();
                  inAppArEditor.insertText(tag);
                })}
                <RichTextEditor
                  value={templateData.inAppBodyAr}
                  editor={inAppArEditor}
                  onCreated={setInAppArEditor}
                  dir="rtl"
                  className="edit-template__arabic-editor"
                  onChange={(html) => {
                    setTemplateData((prev) => ({
                      ...prev,
                      inAppBodyAr: html,
                    }));
                    inAppBodyArForm.setFieldsValue({ inAppBodyAr: html });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        visible={leaveVisible}
        type="danger"
        title={et("confirm.unsavedLeave.title")}
        content={et("confirm.unsavedLeave.content")}
        cancelText={et("buttons.cancel")}
        confirmText={et("buttons.leave")}
        onCancel={() => setLeaveVisible(false)}
        onConfirm={handleBack}
      />
      <TestConfirmModal
        visible={testConfirmVisible}
        width={600}
        title={et("confirm.test.title")}
        description={et("confirm.test.description")}
        account={et("confirm.test.account")}
        note={et("confirm.test.note")}
        cancelText={et("buttons.cancel")}
        confirmText={et("buttons.confirm")}
        loading={testing}
        onCancel={() => setTestConfirmVisible(false)}
        onConfirm={handleTest}
      />
      <CustomFooter
        onBack={() => {
          if (hasUnsavedChanges()) {
            setLeaveVisible(true);
          } else {
            handleBack();
          }
        }}
        rightContent={
          <>
            {" "}
            <CustomButton
              text={et("buttons.test")}
              variant="outline"
              onClick={() => setTestConfirmVisible(true)}
              loading={testing}
              disabled={!canRunTest()}
            />
            <CustomButton
              text={et("buttons.save")}
              variant="primary"
              onClick={handleSave}
              loading={saving}
            />
          </>
        }
      />
    </div>
  );
};

export default EditTemplate;
