import "@wangeditor/editor/dist/css/style.css";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connect, mapReadPretty } from "@formily/react";
import type {
  IDomEditor,
  IEditorConfig,
  IToolbarConfig,
} from "@wangeditor/editor";
import { Editor, Toolbar } from "@wangeditor/editor-for-react";
import { i18nChangeLanguage } from "@wangeditor/editor";
import { useTranslation } from "react-i18next";
import { ensureWangEditorArabicLocale } from "@/components/common/RichTextEditor/registerWangEditorArabicLocale";
import { resolveWangEditorLocaleFromPortalLang } from "@/components/common/RichTextEditor/portalLocale";
import {
  maskAuthenticatedDocumentHtmlSources,
} from "@/utils/loadAuthenticatedDocumentSource";
import { restoreProtectedDocumentHtmlSources } from "@/utils/protectedDocumentTarget";
import { useAuthenticatedDocumentMedia } from "@/hooks/useAuthenticatedDocumentMedia";
import { AuthenticatedDocumentHtml } from "@/components/common/AuthenticatedDocumentHtml";
import "./index.less";
export interface RichTextProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
  defaultValue?: string;
}

const normalizeRichTextHtml = (html: string) => {
  const normalizedHtml = html.trim().replace(/&nbsp;/g, "").trim();
  return normalizedHtml === "<p><br></p>" ? "" : html;
};

const RichTextComponent: React.FC<RichTextProps> = (props) => {
  const {
    value,
    onChange,
    placeholder,
    height = 200,
    maxLength,
    disabled = false,
    readOnly = false,
    defaultValue,
  } = props;

  const { i18n } = useTranslation();
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const portalLocale = resolveWangEditorLocaleFromPortalLang(i18n.language);

  useLayoutEffect(() => {
    if (portalLocale === "ar") {
      ensureWangEditorArabicLocale();
    }
    i18nChangeLanguage(portalLocale);
  }, [portalLocale]);

  useEffect(() => {
    return () => {
      if (editor == null) return;
      editor.destroy();
    };
  }, [editor]);

  const toolbarConfig: Partial<IToolbarConfig> = {
    toolbarKeys: [
      "bold",
      "underline",
      "italic",
      "bulletedList",
      "numberedList",
      "color",
      "bgColor",
      "insertLink",
      "clearStyle",
    ],
  };

  const editorConfig: Partial<IEditorConfig> = {
    placeholder: placeholder || "",
    maxLength,
    readOnly: disabled || readOnly,
    hoverbarKeys: {},
  };

  const editorValue = useMemo(
    () => maskAuthenticatedDocumentHtmlSources(value ?? defaultValue ?? ""),
    [defaultValue, value],
  );
  useAuthenticatedDocumentMedia(editorWrapperRef, Boolean(editor));

  return (
    <div
      ref={editorWrapperRef}
      className="richtext-editor"
      dir={portalLocale === "ar" ? "rtl" : "ltr"}
    >
      {editor && (
        <Toolbar
          key={portalLocale}
          editor={editor}
          defaultConfig={toolbarConfig}
          mode="default"
          style={{ borderBottom: "1px solid #f0f0f0" }}
        />
      )}
      <Editor
        defaultConfig={editorConfig}
        value={editorValue}
        onCreated={setEditor}
        onChange={(ed) => {
          onChange?.(
            normalizeRichTextHtml(
              restoreProtectedDocumentHtmlSources(ed.getHtml()),
            ),
          );
        }}
        mode="default"
        style={{
          minHeight: 120,
          height,
          border: "1px solid #d9d9d9",
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export const RichText = connect(
  RichTextComponent,
  mapReadPretty((props: RichTextProps) => {
    const html = props.value || "";
    return (
      <AuthenticatedDocumentHtml
        className="richtext-preview"
        style={{ minHeight: 24 }}
        html={html}
      />
    );
  })
);

export default RichText;
