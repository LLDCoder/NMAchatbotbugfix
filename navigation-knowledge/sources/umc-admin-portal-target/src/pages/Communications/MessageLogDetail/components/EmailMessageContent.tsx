import { useTranslation } from "react-i18next";
import type { MessageLogRecord } from "@/services/messageLog";
import ContentField from "./ContentField";
import hasText from "./hasText";
import {
  AuthenticatedDocumentHtml,
} from "@/components/common/AuthenticatedDocumentHtml";
function EmailBodyField({
  label,
  value,
  direction = "ltr",
}: {
  label: string;
  value: string;
  direction?: "ltr" | "rtl";
}) {
  return (
    <div className="message-content-field is-multiline">
      <div className="message-content-field__heading">{label}</div>
      <AuthenticatedDocumentHtml
        className="message-content-value message-content-value--html"
        dir={direction}
        html={value}
      />
    </div>
  );
}
export default function EmailMessageContent({
  record,
}: {
  record: MessageLogRecord;
}) {
  const { t } = useTranslation();
  const hasEnglish =
    hasText(record.emailSubjectEn) || hasText(record.emailBodyEn);
  const hasArabic =
    hasText(record.emailSubjectAr) || hasText(record.emailBodyAr);
  const isBilingual = hasEnglish && hasArabic;
  return (
    <>
      {hasText(record.emailSubjectEn) && (
        <ContentField
          label={t(isBilingual
            ? "Communications.messageLogDetail.emailSubjectInEnglish"
            : "Communications.messageLogDetail.emailSubject")}
          value={record.emailSubjectEn}
        />
      )}
      {hasText(record.emailBodyEn) && (
        <EmailBodyField
          label={t(isBilingual
            ? "Communications.messageLogDetail.emailBodyInEnglish"
            : "Communications.messageLogDetail.emailBody")}
          value={record.emailBodyEn}
        />
      )}
      {hasText(record.emailSubjectAr) && (
        <ContentField
          label={t(isBilingual
            ? "Communications.messageLogDetail.emailSubjectInArabic"
            : "Communications.messageLogDetail.emailSubject")}
          value={record.emailSubjectAr}
          direction={isBilingual ? "rtl" : "ltr"}
        />
      )}
      {hasText(record.emailBodyAr) && (
        <EmailBodyField
          label={t(isBilingual
            ? "Communications.messageLogDetail.emailBodyInArabic"
            : "Communications.messageLogDetail.emailBody")}
          value={record.emailBodyAr}
          direction={isBilingual ? "rtl" : "ltr"}
        />
      )}
    </>
  );
}
