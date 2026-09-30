import "@wangeditor/editor/dist/css/style.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { DownOutlined } from "@ant-design/icons";
import { Form, Input, Switch } from "antd";
import type { IDomEditor } from "@wangeditor/editor";
import { ConfirmModal, RichTextEditor } from "@/components/common";
import EnvelopeSimpleIcon from "@/assets/images/EnvelopeSimple.svg";
import ChatDotsIcon from "@/assets/images/ChatDots.svg";
import BellRingingIcon from "@/assets/images/BellRinging.svg";
import { resolveWangEditorLocaleFromPortalLang } from "@/components/common/RichTextEditor/portalLocale";

export interface BroadcastChannelValues {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  emailSubjectEn: string;
  emailSubjectAr: string;
  emailBodyEn: string;
  emailBodyAr: string;
  smsBodyEn: string;
  smsBodyAr: string;
  inAppTitleEn: string;
  inAppTitleAr: string;
  inAppMessageEn: string;
  inAppMessageAr: string;
}

export interface ChannelsContentRef {
  validate: () => Promise<BroadcastChannelValues>;
  getValue: () => BroadcastChannelValues;
}

interface ChannelsContentProps {
  value: BroadcastChannelValues;
  language: string;
  labels: (key: string) => string;
  onValidityChange?: (valid: boolean) => void;
}

type EditorField = "emailBodyEn" | "emailBodyAr" | "smsBodyEn" | "smsBodyAr" | "inAppMessageEn" | "inAppMessageAr";
type ValidationErrors = Partial<Record<keyof BroadcastChannelValues | "channels", string>>;

const EMAIL_EDITOR_FIELDS: EditorField[] = ["emailBodyEn", "emailBodyAr"];
const SMS_EDITOR_FIELDS: EditorField[] = ["smsBodyEn", "smsBodyAr"];
const IN_APP_EDITOR_FIELDS: EditorField[] = ["inAppMessageEn", "inAppMessageAr"];
const SMS_TOOLBAR_KEYS = ["bold", "underline", "justifyLeft", "textCase", "fontSize", "lineHeight", "insertLink"];

const isHtmlEmpty = (html?: string) =>
  !html
    ?.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

const hasEmailContent = (value: BroadcastChannelValues) =>
  Boolean(
    value.emailSubjectEn.trim() ||
      value.emailSubjectAr.trim() ||
      !isHtmlEmpty(value.emailBodyEn) ||
      !isHtmlEmpty(value.emailBodyAr),
  );

const getValidationErrors = (
  value: BroadcastChannelValues,
  labels: ChannelsContentProps["labels"],
): ValidationErrors => {
  const errors: ValidationErrors = {};
  if (!value.email && !value.sms && !value.inApp) {
    errors.channels = labels("validation.channelRequired");
  }

  if (value.email) {
    if (!value.emailSubjectEn.trim()) errors.emailSubjectEn = labels("validation.emailSubjectEnRequired");
    if (!value.emailSubjectAr.trim()) errors.emailSubjectAr = labels("validation.emailSubjectArRequired");
    if (isHtmlEmpty(value.emailBodyEn)) errors.emailBodyEn = labels("validation.emailBodyEnRequired");
    if (isHtmlEmpty(value.emailBodyAr)) errors.emailBodyAr = labels("validation.emailBodyArRequired");
  }

  if (value.sms) {
    if (isHtmlEmpty(value.smsBodyEn)) errors.smsBodyEn = labels("validation.smsMessageEnRequired");
    if (isHtmlEmpty(value.smsBodyAr)) errors.smsBodyAr = labels("validation.smsMessageArRequired");
  }

  if (value.inApp) {
    if (!value.inAppTitleEn.trim()) errors.inAppTitleEn = labels("validation.inAppTitleEnRequired");
    if (!value.inAppTitleAr.trim()) errors.inAppTitleAr = labels("validation.inAppTitleArRequired");
    if (isHtmlEmpty(value.inAppMessageEn)) errors.inAppMessageEn = labels("validation.inAppMessageEnRequired");
    if (isHtmlEmpty(value.inAppMessageAr)) errors.inAppMessageAr = labels("validation.inAppMessageArRequired");
  }
  return errors;
};

const ChannelsContent = forwardRef<ChannelsContentRef, ChannelsContentProps>(
  ({ value, language, labels, onValidityChange }, ref) => {
    const [draft, setDraft] = useState(value);
    const [emailExpanded, setEmailExpanded] = useState(value.email);
    const [emailDisableConfirmVisible, setEmailDisableConfirmVisible] = useState(false);
    const [smsExpanded, setSmsExpanded] = useState(value.sms);
    const [inAppExpanded, setInAppExpanded] = useState(value.inApp);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [, setEditorVersion] = useState(0);
    const editorRefs = useRef<Partial<Record<EditorField, IDomEditor>>>({});
    const editorLocale = resolveWangEditorLocaleFromPortalLang(language);
    const validationResult = useMemo(() => getValidationErrors(draft, labels), [draft, labels]);
    const isValid = Object.keys(validationResult).length === 0;

    // The parent changes this value only when a template has finished loading.
    // Keeping keystrokes local prevents wangEditor events from overwriting another field.
    useEffect(() => {
      setDraft(value);
      setEmailExpanded(value.email);
      setEmailDisableConfirmVisible(false);
      setSmsExpanded(value.sms);
      setInAppExpanded(value.inApp);
      setValidationErrors({});
    }, [value]);

    useEffect(() => {
      onValidityChange?.(isValid);
    }, [isValid, onValidityChange]);

    useImperativeHandle(
      ref,
      () => ({
        validate: async () => {
          const errors = getValidationErrors(draft, labels);
          setValidationErrors(errors);
          if (Object.keys(errors).length > 0) {
            throw new Error(errors.channels ? "CHANNEL_REQUIRED" : "CHANNEL_VALIDATION_FAILED");
          }
          return draft;
        },
        getValue: () => draft,
      }),
      [draft, labels],
    );

    const update = (patch: Partial<BroadcastChannelValues>) => {
      setValidationErrors({});
      setDraft((current) => ({ ...current, ...patch }));
    };

    const setEditor = (field: EditorField, editor: IDomEditor) => {
      if (editorRefs.current[field] === editor) return;
      editorRefs.current[field] = editor;
      setEditorVersion((version) => version + 1);
    };

    const clearEditors = (fields: EditorField[]) => {
      fields.forEach((field) => {
        delete editorRefs.current[field];
      });
    };

    const disableEmail = () => {
      clearEditors(EMAIL_EDITOR_FIELDS);
      update({ email: false });
      setEmailExpanded(false);
      setEmailDisableConfirmVisible(false);
    };

    const handleEmailToggle = (checked: boolean) => {
      if (!checked && hasEmailContent(draft)) {
        setEmailDisableConfirmVisible(true);
        return;
      }
      if (!checked) clearEditors(EMAIL_EDITOR_FIELDS);
      update({ email: checked });
      setEmailExpanded(checked);
    };

    const handleSmsToggle = (checked: boolean) => {
      if (!checked) clearEditors(SMS_EDITOR_FIELDS);
      update({ sms: checked });
      setSmsExpanded(checked);
    };

    const handleInAppToggle = (checked: boolean) => {
      if (!checked) clearEditors(IN_APP_EDITOR_FIELDS);
      update({ inApp: checked });
      setInAppExpanded(checked);
    };

    const renderEditor = (
      field: EditorField,
      label: string,
      dir: "ltr" | "rtl",
      required = false,
      options: { placeholder?: string; className?: string; toolbarKeys?: string[] } = {},
    ) => (
      <Form.Item
        className="editor-block"
        label={label}
        required={required}
        validateStatus={validationErrors[field] ? "error" : undefined}
        help={validationErrors[field]}
      >
        <RichTextEditor
          value={draft[field]}
          editor={editorRefs.current[field] || null}
          onCreated={(editor) => setEditor(field, editor)}
          onChange={(html) => update({ [field]: html })}
          locale={editorLocale}
          dir={dir}
          showCharCount={true}
          maxLength={1000}
          placeholder={options.placeholder}
          className={options.className || ""}
          toolbarKeys={options.toolbarKeys}
        />
      </Form.Item>
    );

    const renderInput = (
      field: keyof BroadcastChannelValues,
      label: string,
      options: { dir?: "rtl"; placeholder?: string; required?: boolean } = {},
    ) => (
      <Form.Item
        label={label}
        required={options.required}
        validateStatus={validationErrors[field] ? "error" : undefined}
        help={validationErrors[field]}
      >
        <Input
          className="broadcast-edit-page__channel-input"
          value={String(draft[field] || "")}
          maxLength={200}
          dir={options.dir}
          placeholder={options.placeholder}
          onChange={(event) => update({ [field]: event.target.value })}
        />
      </Form.Item>
    );

    return (
      <>
        <div className="broadcast-channels-wrapper">
        <h3>{labels("sections.channelsContent")}</h3>
        <div className="channels-content">
          <div className={`channel-panel ${draft.email ? "enabled" : ""}`}>
            <div className="channel-header" onClick={() => {
              if (!draft.email) return;
              if (emailExpanded) clearEditors(EMAIL_EDITOR_FIELDS);
              setEmailExpanded(!emailExpanded);
            }}>
              <div className="channel-title"><img src={EnvelopeSimpleIcon} alt="" /><span>{labels("channels.email")}</span></div>
              <div className="channel-actions">
                <Switch checked={draft.email} onClick={(_, event) => event.stopPropagation()} onChange={handleEmailToggle} />
                <span className="arrow-wrapper">{draft.email && <DownOutlined className={`arrow ${emailExpanded ? "open" : ""}`} />}</span>
              </div>
            </div>
            {draft.email && emailExpanded && <div className="channel-body">
              {renderInput("emailSubjectEn", labels("labels.emailSubjectEn"), { placeholder: labels("placeholders.emailSubjectEn"), required: true })}
              {renderEditor("emailBodyEn", labels("labels.emailBodyEn"), "ltr", true, { placeholder: labels("placeholders.emailBodyEn") })}
              {renderInput("emailSubjectAr", labels("labels.emailSubjectAr"), { dir: "rtl", placeholder: labels("placeholders.emailSubjectAr"), required: true })}
              {renderEditor("emailBodyAr", labels("labels.emailBodyAr"), "rtl", true, { placeholder: labels("placeholders.emailBodyAr") })}
            </div>}
          </div>

          <div className={`channel-panel ${draft.sms ? "enabled" : ""}`}>
            <div className="channel-header" onClick={() => {
              if (!draft.sms) return;
              if (smsExpanded) clearEditors(SMS_EDITOR_FIELDS);
              setSmsExpanded(!smsExpanded);
            }}>
              <div className="channel-title"><img src={ChatDotsIcon} alt="" /><span>{labels("channels.sms")}</span></div>
              <div className="channel-actions">
                <Switch checked={draft.sms} onClick={(_, event) => event.stopPropagation()} onChange={handleSmsToggle} />
                <span className="arrow-wrapper">{draft.sms && <DownOutlined className={`arrow ${smsExpanded ? "open" : ""}`} />}</span>
              </div>
            </div>
            {draft.sms && smsExpanded && <div className="channel-body">
              {renderEditor("smsBodyEn", labels("labels.smsMessageEn"), "ltr", true, {
                placeholder: labels("placeholders.smsMessageEn"),
                className: "broadcast-edit-page__sms-editor",
                toolbarKeys: SMS_TOOLBAR_KEYS,
              })}
              {renderEditor("smsBodyAr", labels("labels.smsMessageAr"), "rtl", true, {
                placeholder: labels("placeholders.smsMessageAr"),
                className: "broadcast-edit-page__sms-editor",
                toolbarKeys: SMS_TOOLBAR_KEYS,
              })}
            </div>}
          </div>

          <div className={`channel-panel ${draft.inApp ? "enabled" : ""}`}>
            <div className="channel-header" onClick={() => {
              if (!draft.inApp) return;
              if (inAppExpanded) clearEditors(IN_APP_EDITOR_FIELDS);
              setInAppExpanded(!inAppExpanded);
            }}>
              <div className="channel-title"><img src={BellRingingIcon} alt="" /><span>{labels("channels.PopUp")}</span></div>
              <div className="channel-actions">
                <Switch checked={draft.inApp} onClick={(_, event) => event.stopPropagation()} onChange={handleInAppToggle} />
                <span className="arrow-wrapper">{draft.inApp && <DownOutlined className={`arrow ${inAppExpanded ? "open" : ""}`} />}</span>
              </div>
            </div>
            {draft.inApp && inAppExpanded && <div className="channel-body">
              {renderInput("inAppTitleEn", labels("labels.inAppTitleEn"), { placeholder: labels("placeholders.inAppTitleEn"), required: true })}
              {renderEditor("inAppMessageEn", labels("labels.inAppMessageEn"), "ltr", true, { placeholder: labels("placeholders.inAppMessageEn") })}
              {renderInput("inAppTitleAr", labels("labels.inAppTitleAr"), { dir: "rtl", placeholder: labels("placeholders.inAppTitleAr"), required: true })}
              {renderEditor("inAppMessageAr", labels("labels.inAppMessageAr"), "rtl", true, { placeholder: labels("placeholders.inAppMessageAr") })}
            </div>}
          </div>
          {validationErrors.channels && <div className="channel-error">{validationErrors.channels}</div>}
        </div>
        </div>
        <ConfirmModal
          visible={emailDisableConfirmVisible}
          type="danger"
          title={labels("confirm.disableChannel.title")}
          content={labels("confirm.disableChannel.content")}
          cancelText={labels("buttons.cancel")}
          confirmText={labels("buttons.disable")}
          onCancel={() => setEmailDisableConfirmVisible(false)}
          onConfirm={disableEmail}
        />
      </>
    );
  },
);

ChannelsContent.displayName = "ChannelsContent";

export default ChannelsContent;
