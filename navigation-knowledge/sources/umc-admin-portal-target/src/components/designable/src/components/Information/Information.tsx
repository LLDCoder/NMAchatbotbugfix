import { connect, mapProps, mapReadPretty } from "@formily/react";
import { LoadingOutlined } from "@ant-design/icons";
import { PreviewText } from "@formily/antd";
import { useTranslation } from "react-i18next";
import "./index.less";
import ToastWarningIcon from "@/assets/icons/toast-warning.svg";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

const normalizeStyleType = (style: unknown) => {
  const normalizedStyle = String(style || "warning").trim().toLowerCase();
  return normalizedStyle === "reminder" ? "reminder" : "warning";
};

const stripInlineStyles = (html: string) =>
  html.replace(/\sstyle=(["'])[\s\S]*?\1/gi, "");

type FormilyFieldStatus = {
  loading?: boolean;
  validating?: boolean;
};

function pickByLang(
  src: {
    text?: unknown;
    textEn?: unknown;
    textAr?: unknown;
    contentEn?: unknown;
    contentAr?: unknown;
  },
  lang: string | undefined,
): string {
  const isAr = (lang ?? "en").toLowerCase().startsWith("ar");
  const candidates = isAr
    ? [src.textAr, src.contentAr, src.text, src.textEn, src.contentEn]
    : [src.textEn, src.contentEn, src.text, src.textAr, src.contentAr];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "";
}

const InformationDom = ({
  text,
  textEn,
  textAr,
  contentEn,
  contentAr,
  Style = "warning",
}: {
  text?: string;
  textEn?: string;
  textAr?: string;
  contentEn?: string;
  contentAr?: string;
  Style?: string;
}) => {
  const { t, i18n } = useTranslation();
  const resolved = pickByLang(
    { text, textEn, textAr, contentEn, contentAr },
    i18n.language,
  );
  const fallback = t("Information.defaultFallbackText");
  const informationValue = resolved.trim().length > 0 ? resolved : fallback;
  const isHtmlContent = /<[a-z][\s\S]*>/i.test(informationValue);
  const styleType = normalizeStyleType(Style);
  const displayValue =
    styleType === "warning" && isHtmlContent
      ? stripInlineStyles(informationValue)
      : informationValue;
  const containerClass = `information-container information-${styleType}`;
  return (
    <div className={containerClass}>
      <span className="information-icon information-warning-icon">
        <img src={ToastWarningIcon} alt="" />
      </span>
      {isHtmlContent ? (
        <span
          className="information-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayValue) }}
        />
      ) : (
        <span className="information-content">{displayValue}</span>
      )}
    </div>
  );
};

export const Information = connect(
  InformationDom,
  mapProps(
    { loading: true },
    (props, field) => {
      const restProps = { ...props };
      delete restProps.options;
      delete restProps.dataSource;
      const fieldStatus = field as FormilyFieldStatus | undefined;
      return {
        ...restProps,
        suffixIcon:
          fieldStatus?.loading || fieldStatus?.validating ? (
            <LoadingOutlined />
          ) : (
            props.suffixIcon
          ),
      };
    },
  ),
  mapReadPretty((props) => <PreviewText.Select {...props} />),
);

export default Information;
