import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Editor, Toolbar } from "@wangeditor/editor-for-react";
import type {
  IDomEditor,
  IEditorConfig,
  IOption,
  ISelectMenu,
  IToolbarConfig,
} from "@wangeditor/editor";
import {
  Boot,
  DomEditor,
  SlateEditor,
  SlateElement,
  SlateTransforms,
} from "@wangeditor/editor";
import type { IButtonMenu } from "@wangeditor/editor";
import "@wangeditor/editor/dist/css/style.css";
import "./index.less";
import { i18nChangeLanguage, t } from "@wangeditor/editor";
import { ensureWangEditorArabicLocale } from "./registerWangEditorArabicLocale";
import { fileUpload } from "@/services/media";
import { ImageBaseUrl } from "@/utils/url";
import {
  maskAuthenticatedDocumentHtmlSources,
} from "@/utils/loadAuthenticatedDocumentSource";
import {
  restoreProtectedDocumentHtmlSources,
} from "@/utils/protectedDocumentTarget";
import { useAuthenticatedDocumentMedia } from "@/hooks/useAuthenticatedDocumentMedia";
// import TextCase from "@/assets/images/text-case.svg";
class TextCaseMenu implements IButtonMenu {
  title: string;
  iconSvg?: string;
  tag: string;

  constructor() {
    this.title = t("customMenu.textCase", { defaultValue: "Text Case" });
    this.tag = "button";
    this.iconSvg = `<svg width="19" height="14" viewBox="0 0 19 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.19068 0.359118C6.14021 0.251745 6.06022 0.160956 5.96006 0.097363C5.85989 0.03377 5.7437 0 5.62506 0C5.50641 0 5.39022 0.03377 5.29006 0.097363C5.1899 0.160956 5.1099 0.251745 5.05943 0.359118L0.0594318 10.9841C0.0244982 11.0584 0.00453684 11.1388 0.000687656 11.2208C-0.00316153 11.3028 0.00917676 11.3848 0.0369981 11.462C0.0931857 11.618 0.209028 11.7452 0.359041 11.8158C0.509054 11.8863 0.68095 11.8944 0.836913 11.8382C0.992876 11.782 1.12013 11.6662 1.19068 11.5161L2.49224 8.75052H8.75787L10.0594 11.5161C10.0944 11.5904 10.1436 11.6571 10.2043 11.7124C10.265 11.7676 10.336 11.8104 10.4132 11.8382C10.4904 11.866 10.5724 11.8784 10.6544 11.8745C10.7364 11.8707 10.8168 11.8507 10.8911 11.8158C10.9654 11.7808 11.032 11.7316 11.0873 11.6709C11.1425 11.6102 11.1853 11.5392 11.2131 11.462C11.2409 11.3848 11.2533 11.3028 11.2494 11.2208C11.2456 11.1388 11.2256 11.0584 11.1907 10.9841L6.19068 0.359118ZM3.08053 7.50052L5.62506 2.09349L8.16959 7.50052H3.08053ZM15.0001 3.75052C14.0032 3.75052 13.2243 4.02162 12.6852 4.55677C12.5724 4.67443 12.5099 4.83152 12.5113 4.99455C12.5126 5.15757 12.5776 5.31362 12.6924 5.42941C12.8071 5.5452 12.9626 5.61156 13.1256 5.61434C13.2886 5.61711 13.4463 5.55609 13.5649 5.44427C13.8618 5.14974 14.3462 5.00052 15.0001 5.00052C16.0337 5.00052 16.8751 5.70365 16.8751 6.56302V6.81459C16.3204 6.44351 15.6674 6.24705 15.0001 6.25052C13.2766 6.25052 11.8751 7.51224 11.8751 9.06302C11.8751 10.6138 13.2766 11.8755 15.0001 11.8755C15.6676 11.8784 16.3208 11.6812 16.8751 11.3091C16.8828 11.4749 16.9561 11.6308 17.0788 11.7425C17.2015 11.8542 17.3636 11.9126 17.5294 11.9048C17.6951 11.8971 17.851 11.8238 17.9627 11.701C18.0744 11.5783 18.1328 11.4163 18.1251 11.2505V6.56302C18.1251 5.01224 16.7235 3.75052 15.0001 3.75052ZM15.0001 10.6255C13.9665 10.6255 13.1251 9.9224 13.1251 9.06302C13.1251 8.20365 13.9665 7.50052 15.0001 7.50052C16.0337 7.50052 16.8751 8.20365 16.8751 9.06302C16.8751 9.9224 16.0337 10.6255 15.0001 10.6255Z" fill="#361E12"/>
</svg>
`;
  }

  getValue(): string | boolean {
    return "";
  }

  isActive(editor: IDomEditor): boolean {
    const selectedText = editor.getSelectionText();
    if (!selectedText) return false;
    return (
      selectedText === selectedText.toUpperCase() &&
      selectedText !== selectedText.toLowerCase()
    );
  }

  isDisabled(editor: IDomEditor): boolean {
    const selectedText = editor.getSelectionText();
    return !selectedText.trim();
  }

  exec(editor: IDomEditor) {
    const selectedText = editor.getSelectionText();
    if (!selectedText) return;

    const isUpperCase =
      selectedText === selectedText.toUpperCase() &&
      selectedText !== selectedText.toLowerCase();
    const transformedText = isUpperCase
      ? selectedText.toLowerCase()
      : selectedText.toUpperCase();

    editor.deleteFragment();
    editor.insertText(transformedText);
  }
}

const menuKey = "textCase";
const lineHeightMenuKey = "lineHeightCustom";
const TOOLTIP_ONLY_ICON = "<svg></svg>";
const DEFAULT_LINE_HEIGHT = "1";
const LINE_HEIGHT_LIST = [
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "4.5",
  "5",
];

class LineHeightMenu implements ISelectMenu {
  title: string;
  iconSvg?: string;
  tag: string;
  width: number;

  constructor() {
    this.title = t("lineHeight.title");
    this.tag = "select";
    this.width = 68;
    // wangEditor only wires up `data-tooltip` for menus that declare an icon, and
    // never renders that icon for `select` menus (the button shows the current
    // value). So this is purely the switch that turns the tooltip on.
    this.iconSvg = TOOLTIP_ONLY_ICON;
  }

  getOptions(editor: IDomEditor): IOption[] {
    const lineHeightList =
      (
        editor.getMenuConfig(lineHeightMenuKey) as
          | { lineHeightList?: string[] }
          | undefined
      )?.lineHeightList ?? LINE_HEIGHT_LIST;
    const currentValue = this.getValue(editor).toString();

    return lineHeightList.map((value) => ({
      value,
      text: value,
      selected: value === currentValue,
    }));
  }

  private getMatchNode(editor: IDomEditor) {
    const match = Array.from(
      SlateEditor.nodes(editor, {
        match: (node) => {
          const type = DomEditor.getNodeType(node);
          return (
            type.startsWith("header") ||
            ["paragraph", "blockquote", "list-item"].includes(type)
          );
        },
        universal: true,
        mode: "highest",
      }),
    )[0];

    return match?.[0] ?? null;
  }

  isActive(): boolean {
    return false;
  }

  getValue(editor: IDomEditor): string | boolean {
    const matchNode = this.getMatchNode(editor);
    if (!matchNode) return DEFAULT_LINE_HEIGHT;
    if (SlateElement.isElement(matchNode)) {
      const lineHeight = (matchNode as { lineHeight?: string }).lineHeight;
      if (lineHeight) {
        return lineHeight;
      }
    }
    return DEFAULT_LINE_HEIGHT;
  }

  isDisabled(editor: IDomEditor): boolean {
    return editor.selection == null || this.getMatchNode(editor) == null;
  }

  exec(editor: IDomEditor, value: string | boolean): void {
    SlateTransforms.setNodes(
      editor,
      { lineHeight: value.toString() },
      { mode: "highest" },
    );
  }
}

try {
  Boot.registerMenu({
    key: menuKey,
    factory() {
      return new TextCaseMenu();
    },
  });
} catch (error) {
  console.debug(`Menu with key "${menuKey}" is already registered`, error);
}

try {
  Boot.registerMenu({
    key: lineHeightMenuKey,
    factory() {
      return new LineHeightMenu();
    },
  });
} catch (error) {
  console.debug(
    `Menu with key "${lineHeightMenuKey}" is already registered`,
    error,
  );
}

export interface RichTextEditorProps {
  value?: string;
  editor: IDomEditor | null;
  onCreated: (editor: IDomEditor) => void;
  onChange?: (html: string, editor: IDomEditor) => void;
  height?: number;
  editorConfig?: Partial<IEditorConfig>;
  toolbarConfig?: Partial<IToolbarConfig>;
  className?: string;
  placeholder?: string;
  toolbarKeys?: string[];
  showCharCount?: boolean;
  maxLength?: number;
  /** wangEditor toolbar/modal language: `en`, `zh-CN`, or `ar` (merged from English + Arabic overrides). */
  locale?: string;
  /** Content chrome direction; when omitted and `locale` is `ar`, defaults to `rtl`. */
  dir?: "ltr" | "rtl";
}

function plainTextLengthFromHtml(html: string): number {
  return html.replace(/<[^>]*>/g, "").length;
}

function getSelectedFontSize(editor: IDomEditor | null): string {
  if (!editor) return "";

  try {
    const marks = SlateEditor.marks(editor) as Record<string, unknown> | null;
    const fontSize = marks?.fontSize;
    return typeof fontSize === "string" ? fontSize : "";
  } catch {
    return "";
  }
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  editor,
  onCreated,
  onChange,
  editorConfig,
  toolbarConfig,
  className,
  placeholder,
  toolbarKeys,
  showCharCount = false,
  maxLength,
  locale = "en",
  dir,
}) => {
  const resolvedDir = dir ?? (locale === "ar" ? "rtl" : "ltr");
  const editorMenuConfig = (editorConfig?.MENU_CONF ?? {}) as Record<
    string,
    unknown
  >;
  const {
    lineHeight: externalLineHeightConfig,
    [lineHeightMenuKey]: externalCustomLineHeightConfig,
    ...restEditorMenuConfig
  } = editorMenuConfig;
  const toolbarConfigToolbarKeys = toolbarConfig?.toolbarKeys as
    | string[]
    | undefined;
  const sourceToolbarKeys = toolbarConfigToolbarKeys ?? toolbarKeys;
  const resolvedToolbarKeys =
    sourceToolbarKeys?.map((key) =>
      key === "lineHeight" ? lineHeightMenuKey : key,
    ) ?? [];
  const editorValue = useMemo(
    () => maskAuthenticatedDocumentHtmlSources(value ?? ""),
    [value],
  );
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  useAuthenticatedDocumentMedia(editorWrapperRef, Boolean(editor));
  const lastValidHtmlRef = useRef<string>(value ?? "");
  const [selectedFontSize, setSelectedFontSize] = useState("");

  useEffect(() => {
    lastValidHtmlRef.current = value ?? "";
  }, [value]);

  useLayoutEffect(() => {
    if (locale === "ar") {
      ensureWangEditorArabicLocale();
    }
    i18nChangeLanguage(locale);
  }, [locale]);

  useLayoutEffect(() => {
    const editorWrapper = editorWrapperRef.current;
    const toolbar = editorWrapper?.querySelector<HTMLElement>(".w-e-toolbar");
    if (!editor || !toolbar) {
      setSelectedFontSize("");
      return;
    }

    const syncSelectedFontSize = () => {
      const fontSizeButton = toolbar.querySelector<HTMLButtonElement>(
        'button[data-menu-key="fontSize"]',
      );
      const fontSize = getSelectedFontSize(editor);
      const buttonText = fontSizeButton?.textContent?.trim() ?? "";

      setSelectedFontSize(
        fontSize && buttonText.toLowerCase() === fontSize.toLowerCase()
          ? buttonText
          : "",
      );
    };

    syncSelectedFontSize();

    if (typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver(syncSelectedFontSize);
    observer.observe(toolbar, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [editor, locale]);

  const [charCount, setCharCount] = useState(0);
  const calculateCounts = (html: string) => {
    if (!html) {
      setCharCount(0);
      return;
    }

    const text = html.replace(/<[^>]*>/g, "");

    setCharCount(text.length);
  };
  const handleImageUpload = async (
    file: File,
    insertFn: (url: string, alt?: string, href?: string) => void,
  ) => {
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      if (res?.data && res.data.length > 0) {
        const fileUrl = res.data[0];
        const fullUrl = `${ImageBaseUrl}${fileUrl}`;
        insertFn(fullUrl, file.name);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Image upload error:", error);
    }
  };

  const handleVideoUpload = async (
    file: File,
    insertFn: (url: string, poster?: string) => void,
  ) => {
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      if (res?.data && res.data.length > 0) {
        const fileUrl = res.data[0];
        const fullUrl = `${ImageBaseUrl}${fileUrl}`;
        insertFn(fullUrl);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Video upload error:", error);
    }
  };

  // Limit is enforced in onChange via lastValidHtmlRef (same plain-text metric as showCharCount).
  // Do not set wangEditor editorConfig.maxLength here: it draws a duplicate in-editor counter
  // that overlaps with content and clashes with `.char-count-bar` below.
  const baseEditorConfig: Partial<IEditorConfig> = {
    placeholder: placeholder,
    autoFocus: false,
    readOnly: false,
    MENU_CONF: {
      [lineHeightMenuKey]: {
        lineHeightList: LINE_HEIGHT_LIST,
      },
      uploadImage: {
        server: "",
        allowedFileTypes: ["image/*"],
        async customUpload(
          file: File,
          insertFn: (url: string, alt?: string, href?: string) => void,
        ) {
          await handleImageUpload(file, insertFn);
        },
      },
      uploadVideo: {
        server: "",
        allowedFileTypes: ["video/*"],
        async customUpload(
          file: File,
          insertFn: (url: string, poster?: string) => void,
        ) {
          await handleVideoUpload(file, insertFn);
        },
      },
    },
  };

  const finalEditorConfig: Partial<IEditorConfig> = {
    ...baseEditorConfig,
    ...editorConfig,
    MENU_CONF: {
      ...baseEditorConfig.MENU_CONF,
      ...restEditorMenuConfig,
      [lineHeightMenuKey]:
        externalCustomLineHeightConfig ??
        externalLineHeightConfig ??
        baseEditorConfig.MENU_CONF?.[lineHeightMenuKey],
    },
  };

  if (showCharCount) {
    delete finalEditorConfig.maxLength;
  }

  const defaultToolbarKeys = [
    "bold",
    "italic",
    "underline",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    menuKey,
    "fontSize",
    lineHeightMenuKey,
    "insertLink",
  ];

  const finalToolbarConfig: Partial<IToolbarConfig> = {
    ...toolbarConfig,
    toolbarKeys:
      resolvedToolbarKeys.length > 0
        ? resolvedToolbarKeys
        : defaultToolbarKeys,
  };
  const editorWrapperClassName = `editor-wrapper${
    selectedFontSize ? " editor-wrapper--font-size-selected" : ""
  }${className ? ` ${className}` : ""}`;
  const rootClassName = `rich-text-editor rich-text-editor--${resolvedDir}`;
  const charCountBarClassName = `char-count-bar char-count-bar--${resolvedDir}`;

  return (
    <div className={rootClassName}>
      <div
        ref={editorWrapperRef}
        className={editorWrapperClassName}
        dir={resolvedDir}
      >
        {editor && (
          <Toolbar
            key={locale}
            editor={editor}
            defaultConfig={finalToolbarConfig}
            mode="default"
          />
        )}
        <Editor
          defaultConfig={finalEditorConfig}
          value={editorValue}
          onCreated={(editor) => {
            if (editor) {
              editor.blur();
              const html = restoreProtectedDocumentHtmlSources(editor.getHtml());
              calculateCounts(html || "");
              lastValidHtmlRef.current = html || "";
            }
            onCreated(editor);
          }}
          onChange={(ed) => {
            const html = restoreProtectedDocumentHtmlSources(ed.getHtml() || "");
            const limit = maxLength;
            if (
              limit != null &&
              limit > 0 &&
              plainTextLengthFromHtml(html) > limit
            ) {
              const revert = lastValidHtmlRef.current;
              setTimeout(() => {
                ed.setHtml(maskAuthenticatedDocumentHtmlSources(revert));
                calculateCounts(revert || "");
              }, 0);
              return;
            }
            lastValidHtmlRef.current = html;
            calculateCounts(html);
            if (onChange) {
              onChange(html, ed as IDomEditor);
            }
          }}
          mode="default"
        />
      </div>
      {showCharCount && (
        <div className={charCountBarClassName}>
          <span className="char-count">
            {charCount}
            {maxLength != null && maxLength > 0 && ` / ${maxLength}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
