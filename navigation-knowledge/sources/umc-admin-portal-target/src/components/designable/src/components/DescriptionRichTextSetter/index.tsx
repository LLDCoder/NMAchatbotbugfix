import React, { useState, useCallback, useMemo } from "react";
import { useField } from "@formily/react";
import { Path } from "@formily/path";
import { useTranslation } from "react-i18next";
import { useCurrentNode } from "@designable/react";
import { RichTextEditor } from "@/components/common";
import { resolveWangEditorLocaleFromPortalLang } from "@/components/common/RichTextEditor/portalLocale";
import type { IDomEditor } from "@wangeditor/editor";
import "./index.less";

const MAX_LENGTH = 500;

const EMPTY_PATTERNS = [
  /^<p><br><\/p>$/,
  /^<p><br\/><\/p>$/,
  /^<p>\s*<\/p>$/,
  /^\s*$/,
];

function isEditorEmpty(html: string | undefined): boolean {
  if (!html) return true;
  const trimmed = html.trim();
  if (!trimmed) return true;
  return EMPTY_PATTERNS.some((p) => p.test(trimmed));
}

export interface DescriptionRichTextSetterProps {
  value?: string;
  onChange?: (value: string) => void;
  /** wangEditor UI language override; omit to follow app i18n (en / ar toolbar). */
  editorLocale?: string;
  /** Passed to wangEditor wrapper; omit to derive rtl/ltr from resolved editor locale. */
  editorDir?: "ltr" | "rtl";
  placeholder?: string;
  lang?: string;
}

interface SetterFieldLike {
  address?: { toString?: () => string };
  path?: { toString?: () => string };
  name?: string;
  setValue?: (value: string) => void;
}

interface CurrentNodeLike {
  props?: Record<string, unknown>;
  takeSnapshot?: (type?: string) => void;
}

const DescriptionRichTextSetter: React.FC<DescriptionRichTextSetterProps> = ({
  value,
  onChange,
  editorLocale,
  editorDir,
  placeholder,
  lang,
}) => {
  const { t, i18n } = useTranslation();
  const field = useField() as SetterFieldLike;
  const currentNode = useCurrentNode() as CurrentNodeLike | null;
  const fieldAddress =
    field?.address?.toString?.() ??
    field?.path?.toString?.() ??
    field?.name ??
    "unknown";

  const resolvedEditorLocale = useMemo(() => {
    if (editorLocale != null && editorLocale !== "") return editorLocale;
    return resolveWangEditorLocaleFromPortalLang(i18n.language);
  }, [editorLocale, i18n.language]);

  const resolvedEditorDir = useMemo(() => {
    if (editorDir != null) return editorDir;
    return resolvedEditorLocale === "ar" ? "rtl" : "ltr";
  }, [editorDir, resolvedEditorLocale]);

  const resolvedPlaceholder =
    placeholder ??
    (lang === "ar"
      ? t("DescriptionRichTextSetter.placeholderAr")
      : t("DescriptionRichTextSetter.placeholderEn"));
  const [editor, setEditor] = useState<IDomEditor | null>(null);

  const handleEditorChange = useCallback(
    (html: string) => {
      const nextValue = isEditorEmpty(html) ? "" : html;
      if (typeof field?.setValue === "function") {
        field.setValue(nextValue);
      }
      if (currentNode?.props && typeof fieldAddress === "string") {
        Path.setIn(currentNode.props, fieldAddress, nextValue);
        currentNode.takeSnapshot?.("update:node:props");
      }
      onChange?.(nextValue);
    },
    [currentNode, field, fieldAddress, onChange],
  );

  const handleCreated = useCallback((ed: IDomEditor) => {
    setEditor(ed);
  }, []);

  return (
    <div
      className="desc-richtext-setter"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="desc-richtext-setter__header">
        <span className="desc-richtext-setter__label">
          {lang === "ar" ? t("DescriptionRichTextSetter.labelAr") : t("DescriptionRichTextSetter.labelEn")}
        </span>
      </div>
      <div className="desc-richtext-setter__editor-wrap">
        <RichTextEditor
          value={value}
          editor={editor}
          onCreated={handleCreated}
          onChange={handleEditorChange}
          placeholder={resolvedPlaceholder}
          locale={resolvedEditorLocale}
          dir={resolvedEditorDir}
          showCharCount
          maxLength={MAX_LENGTH}
          height={120}
          className="desc-richtext-setter__editor"
          toolbarKeys={[
            "bold",
            "italic",
            "underline",
            "justifyLeft",
            "lineHeight",
            "textCase",
            "insertLink",
            "uploadImage",
            // "uploadVideo",
          ]}
        />
      </div>
    </div>
  );
};

export default DescriptionRichTextSetter;
