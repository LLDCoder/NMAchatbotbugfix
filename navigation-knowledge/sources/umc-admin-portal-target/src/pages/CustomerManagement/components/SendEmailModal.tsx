import { Form, Input, Modal } from "antd";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { IDomEditor } from "@wangeditor/editor";
import { CustomButton, RichTextEditor } from "@/components/common";
import { resolveWangEditorLocaleFromPortalLang } from "@/components/common/RichTextEditor/portalLocale";
import { useTranslation } from "react-i18next";
import "./SendEmailModal.less";

const EMPTY_EDITOR_HTML = new Set(["<p><br></p>", "<p></p>"]);
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 1000;
const MAX_BODY_BYTES = 100 * 1024;

function normalizeEditorHtml(html: string): string {
  return EMPTY_EDITOR_HTML.has(html.trim()) ? "" : html;
}

function isEditorContentEmpty(html: string | undefined): boolean {
  if (!html) return true;

  const document = new DOMParser().parseFromString(html, "text/html");
  const text = document.body.textContent
    ?.replace(/[\u00a0\ufeff]/g, " ")
    .trim();
  return !text;
}

function getHtmlByteLength(html: string): number {
  return new TextEncoder().encode(html).byteLength;
}

function applyBodyDirection(
  html: string,
  direction: "ltr" | "rtl",
): string {
  if (direction !== "rtl") return html;

  const document = new DOMParser().parseFromString(html, "text/html");
  const blockElements = document.body.querySelectorAll(
    "p, div, h1, h2, h3, h4, h5, h6, blockquote, li, td, th",
  );

  blockElements.forEach((element) => {
    if (!element.hasAttribute("dir")) {
      element.setAttribute("dir", "rtl");
    }
    if (element instanceof HTMLElement && !element.style.textAlign) {
      element.style.textAlign = "right";
    }
  });

  return document.body.innerHTML;
}

interface EmailBodyEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  locale: string;
  dir: "ltr" | "rtl";
}

function EmailBodyEditor({
  value,
  onChange,
  placeholder,
  locale,
  dir,
}: EmailBodyEditorProps) {
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const editorRef = useRef<IDomEditor | null>(null);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    return () => {
      if (editorRef.current == null) return;
      editorRef.current.destroy();
      editorRef.current = null;
    };
  }, []);

  return (
    <RichTextEditor
      value={value}
      editor={editor}
      onCreated={setEditor}
      onChange={(html) => onChange?.(normalizeEditorHtml(html))}
      editorConfig={{
        placeholder,
      }}
      showCharCount={true}
      maxLength={MAX_BODY_LENGTH}
      locale={locale}
      dir={dir}
    />
  );
}

export interface SendEmailFormValues {
  subject: string;
  body: string;
}

export interface SendEmailPayload extends SendEmailFormValues {
  userId: string;
}

export interface SendEmailModalOpenOptions
  extends Partial<SendEmailFormValues> {
  userId: string;
}

export interface SendEmailModalRef {
  open: (options: SendEmailModalOpenOptions) => void;
  close: () => void;
}

export interface SendEmailModalProps {
  onSend: (values: SendEmailPayload) => void | Promise<void>;
  onClose?: () => void;
  title?: string;
  cancelText?: string;
  sendText?: string;
}

const DEFAULT_FORM_VALUES: SendEmailFormValues = {
  subject: "",
  body: "",
};

const SendEmailModal = forwardRef<SendEmailModalRef, SendEmailModalProps>(
  (
    {
      onSend,
      onClose,
      title,
      cancelText,
      sendText,
    },
    ref,
  ) => {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm<SendEmailFormValues>();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formValues, setFormValues] =
      useState<SendEmailFormValues>(DEFAULT_FORM_VALUES);
    const userIdRef = useRef("");
    const editorLocale = resolveWangEditorLocaleFromPortalLang(i18n.language);
    const editorDirection = editorLocale === "ar" ? "rtl" : "ltr";
    const resolvedTitle = title ?? t("Customer.accounts.emailModal.title");
    const resolvedCancelText = cancelText ?? t("common.cancel");
    const resolvedSendText = sendText ?? t("common.send");

    const close = useCallback(() => {
      setVisible(false);
    }, []);

    const open = useCallback((options: SendEmailModalOpenOptions) => {
      const nextFormValues = {
        subject: options.subject ?? "",
        body: options.body ?? "",
      };

      form.resetFields();
      form.setFieldsValue(nextFormValues);
      form.setFields([
        { name: "subject", errors: [] },
        { name: "body", errors: [] },
      ]);
      userIdRef.current = options.userId;
      setFormValues(nextFormValues);
      setVisible(true);
    }, [form]);

    useImperativeHandle(
      ref,
      () => ({
        open,
        close,
      }),
      [close, open],
    );

    const handleCancel = useCallback(() => {
      if (loading) return;
      close();
      onClose?.();
    }, [close, loading, onClose]);

    const handleSend = useCallback(
      async (values: SendEmailFormValues) => {
        if (loading) return;

        setLoading(true);
        try {
          await onSend({
            userId: userIdRef.current,
            subject: values.subject.trim(),
            body: applyBodyDirection(values.body, editorDirection),
          });
          close();
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      },
      [close, editorDirection, loading, onSend],
    );

    return (
      <Modal
        visible={visible}
        title={resolvedTitle}
        width={960}
        centered
        destroyOnClose
        maskClosable={!loading}
        keyboard={!loading}
        onCancel={handleCancel}
        afterClose={() => {
          form.resetFields();
          userIdRef.current = "";
        }}
        className={`send-email-modal${
          editorDirection === "rtl" ? " send-email-modal--rtl" : ""
        }`}
        footer={
          <div className="send-email-modal__footer">
            <CustomButton
              text={resolvedCancelText}
              variant="outline"
              size="large"
              disabled={loading}
              onClick={handleCancel}
              customClassName="send-email-modal__button"
            />
            <CustomButton
              text={resolvedSendText}
              variant="primary"
              size="large"
              loading={loading}
              onClick={() => form.submit()}
              customClassName="send-email-modal__button"
            />
          </div>
        }
      >
        <Form<SendEmailFormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={formValues}
          onFinish={handleSend}
          className="send-email-modal__form"
        >
          <Form.Item
            label={t("Customer.accounts.emailModal.subject")}
            name="subject"
            required={false}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("Customer.accounts.emailModal.subjectRequired"),
              },
              {
                max: MAX_SUBJECT_LENGTH,
                message: t("Customer.accounts.emailModal.subjectTooLong"),
              },
            ]}
            className="send-email-modal__subject-field"
          >
            <Input
              maxLength={MAX_SUBJECT_LENGTH}
              placeholder={t("Customer.accounts.emailModal.subjectPlaceholder")}
            />
          </Form.Item>

          <Form.Item
            name="body"
            rules={[
              {
                required: true,
                message: t("Customer.accounts.emailModal.bodyRequired"),
              },
              {
                validator: (_, value: string | undefined) => {
                  if (value && isEditorContentEmpty(value)) {
                    return Promise.reject(
                      new Error(
                        t("Customer.accounts.emailModal.bodyRequired"),
                      ),
                    );
                  }
                  if (value && getHtmlByteLength(value) > MAX_BODY_BYTES) {
                    return Promise.reject(
                      new Error(t("Customer.accounts.emailModal.bodyTooLarge")),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
            className="send-email-modal__body-field"
          >
            <EmailBodyEditor
              placeholder={t("Customer.accounts.emailModal.bodyPlaceholder")}
              locale={editorLocale}
              dir={editorDirection}
            />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

SendEmailModal.displayName = "SendEmailModal";

export default SendEmailModal;
