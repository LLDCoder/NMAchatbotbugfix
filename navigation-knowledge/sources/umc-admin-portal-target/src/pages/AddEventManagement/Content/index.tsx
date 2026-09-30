import { RichTextEditor } from "@/components/common";
import type { IDomEditor } from "@wangeditor/editor";
import { Col, Form, Input, Row } from "antd";
import { useState, type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { IContentFieldType, IProps } from "./type";
import "./index.less";

const CONTENT_RICH_TEXT_MAX_CHARS = 50000;

export const Content: FC<IProps> = ({ contentForm }) => {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const [contentEn, setContentEn] = useState<string>("");
  const [contentEnEditor, setContentEnEditor] = useState<any | null>(null);
  const [contentAr, setContentAr] = useState<string>("");
  const [contentArEditor, setContentArEditor] = useState<any | null>(null);
  const [isInitialized, setIsInitialized] = useState<{
    [key: string]: boolean;
  }>({
    contentEn: false,
    contentAr: false,
  });
  const [hasUserInput, setHasUserInput] = useState<{
    [key: string]: boolean;
  }>({
    contentEn: false,
    contentAr: false,
  });

  useEffect(() => {
    return () => {
      if (editor == null) return;
      editor.destroy();
      setEditor(null);
    };
  }, [editor]);

  return (
    <Form<IContentFieldType>
      form={contentForm}
      className="custom-form content-form"
      layout="vertical"
    >
      {/* first row */}
      <Row gutter={16}>
        {/* first column */}
        <Col span={12}>
          <Form.Item
            name="titleEn"
            label={t("CMS.addEventManagement.content.labels.englishTitle")}
            rules={[
              { required: true, message: t("CMS.common.requiredField") },
            ]}
          >
            <Input.TextArea
              showCount
              rows={4}
              maxLength={200}
              placeholder={t(
                "CMS.addEventManagement.content.placeholders.englishTitle",
              )}
            />
          </Form.Item>
        </Col>

        {/* second column */}
        <Col span={12}>
          <Form.Item
            name="titleAr"
            label={t("CMS.addEventManagement.content.labels.arabicTitle")}
            rules={[
              { required: true, message: t("CMS.common.requiredField") },
            ]}
          >
            <Input.TextArea
              showCount
              rows={4}
              placeholder={t(
                "CMS.addEventManagement.content.placeholders.arabicTitle",
              )}
              maxLength={200}
              className="ar"
            />
          </Form.Item>
        </Col>
      </Row>

      {/* second row */}
      <Row gutter={16}>
        {/* first column */}
        <Col span={12}>
          <Form.Item
            name="contentEn"
            label={t(
              "CMS.addEventManagement.content.labels.englishContent",
            )}
            validateTrigger={[]}
            rules={[
              {
                required: true,
                message: t("CMS.common.requiredField"),
                validator: (_, value) => {
                  const plainLen = value
                    ? value.replace(/<[^>]*>/g, "").length
                    : 0;
                  if (plainLen > CONTENT_RICH_TEXT_MAX_CHARS) {
                    return Promise.reject(
                      new Error(
                        t("CMS.common.contentMaxLength", {
                          max: CONTENT_RICH_TEXT_MAX_CHARS,
                        }),
                      ),
                    );
                  }
                  if (
                    hasUserInput.contentEn &&
                    (!value ||
                      value.replace(/<[^>]*>/g, "").trim() === "" ||
                      value === "<p><br></p>")
                  ) {
                    return Promise.reject(
                      new Error(t("CMS.common.requiredField")),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <RichTextEditor
              key="contentEn"
              showCharCount={true}
              maxLength={CONTENT_RICH_TEXT_MAX_CHARS}
              value={contentEn}
              placeholder={t(
                "CMS.addEventManagement.content.placeholders.englishContent",
              )}
              editor={contentEnEditor}
              toolbarKeys={[
                "bold",
                "italic",
                "underline",
                "justifyLeft",
                "lineHeight",
                "textCase",
                // "fontSize",
                "insertLink",
                "uploadImage",
                "uploadVideo",
              ]}
              onCreated={(editor) => {
                setContentEnEditor(editor);
                setTimeout(() => {
                  setIsInitialized((prev) => ({ ...prev, contentEn: true }));
                }, 0);
              }}
              onChange={(html) => {
                if (isInitialized.contentEn || html !== contentEn) {
                  const hasContent =
                    html &&
                    html.replace(/<[^>]*>/g, "").trim() !== "" &&
                    html !== "<p><br></p>";

                  if (hasContent) {
                    setHasUserInput((prev) => ({ ...prev, contentEn: true }));
                  }

                  setContentEn(html);
                  contentForm.setFieldsValue({ contentEn: html });

                  if (hasUserInput.contentEn) {
                    contentForm.validateFields(["contentEn"]).catch(() => {});
                  }
                }
              }}
            />
          </Form.Item>
        </Col>

        {/* second column */}
        <Col span={12}>
          <Form.Item
            name="contentAr"
            label={t("CMS.addEventManagement.content.labels.arabicContent")}
            validateTrigger={[]}
            rules={[
              {
                required: true,
                message: t("CMS.common.requiredField"),
                validator: (_, value) => {
                  const plainLen = value
                    ? value.replace(/<[^>]*>/g, "").length
                    : 0;
                  if (plainLen > CONTENT_RICH_TEXT_MAX_CHARS) {
                    return Promise.reject(
                      new Error(
                        t("CMS.common.contentMaxLength", {
                          max: CONTENT_RICH_TEXT_MAX_CHARS,
                        }),
                      ),
                    );
                  }
                  if (
                    hasUserInput.contentAr &&
                    (!value ||
                      value.replace(/<[^>]*>/g, "").trim() === "" ||
                      value === "<p><br></p>")
                  ) {
                    return Promise.reject(
                      new Error(t("CMS.common.requiredField")),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <RichTextEditor
              className="ar"
              key="contentAr"
              placeholder={t(
                "CMS.addEventManagement.content.placeholders.arabicContent",
              )}
              value={contentAr}
              editor={contentArEditor}
              showCharCount={true}
              maxLength={CONTENT_RICH_TEXT_MAX_CHARS}
              toolbarKeys={[
                "bold",
                "italic",
                "underline",
                "justifyLeft",
                "lineHeight",
                "textCase",
                // "fontSize",
                "insertLink",
                "uploadImage",
                "uploadVideo",
              ]}
              onCreated={(editor) => {
                setContentArEditor(editor);
                setTimeout(() => {
                  setIsInitialized((prev) => ({ ...prev, contentAr: true }));
                }, 0);
              }}
              onChange={(html) => {
                if (isInitialized.contentAr || html !== contentAr) {
                  const hasContent =
                    html &&
                    html.replace(/<[^>]*>/g, "").trim() !== "" &&
                    html !== "<p><br></p>";

                  if (hasContent) {
                    setHasUserInput((prev) => ({ ...prev, contentAr: true }));
                  }

                  setContentAr(html);
                  contentForm.setFieldsValue({ contentAr: html });

                  if (hasUserInput.contentAr) {
                    contentForm.validateFields(["contentAr"]).catch(() => {});
                  }
                }
              }}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
