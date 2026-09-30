import type { MessageLogRecord } from "@/services/messageLog";
import { useTranslation } from "react-i18next";
import ContentField from "./ContentField";
import hasText from "./hasText";
export default function SmsMessageContent({
  record,
}: {
  record: MessageLogRecord;
}) {
  const { t } = useTranslation();
  const hasEnglish = hasText(record.smsMessageEn);
  const hasArabic = hasText(record.smsMessageAr);
  const isBilingual = hasEnglish && hasArabic;
  return (
    <>
      {hasEnglish && (
        <ContentField
          label={t(isBilingual
            ? "Communications.messageLogDetail.messageInEnglish"
            : "Communications.messageLogDetail.message")}
          value={record.smsMessageEn!}
          multiline
        />
      )}
      {hasArabic && (
        <ContentField
          label={t(isBilingual
            ? "Communications.messageLogDetail.messageInArabic"
            : "Communications.messageLogDetail.message")}
          value={record.smsMessageAr!}
          multiline
          direction={isBilingual ? "rtl" : "ltr"}
        />
      )}
    </>
  );
}
