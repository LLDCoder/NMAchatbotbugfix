import { CustomMessage } from "@/components/common";
import i18n from "@/localization/config";

interface CopyToClipboardOptions {
  successMessage?: string;
}

export const copyToClipboard = async (
  text: string,
  options: CopyToClipboardOptions = {},
): Promise<boolean> => {
  const translatedSuccessMessage = i18n.t("serviceEntryGate.messages.copied");
  const defaultSuccessMessage =
    typeof translatedSuccessMessage === "string" &&
    translatedSuccessMessage !== "serviceEntryGate.messages.copied"
      ? translatedSuccessMessage
      : "Copied to clipboard";
  const successMessage = options.successMessage ?? defaultSuccessMessage;

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      CustomMessage.success(successMessage);

      return true;
    } catch (err) {
      console.error(err);
    }
  }

  try {
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);

    input.select();
    input.setSelectionRange(0, text.length);

    const success = document.execCommand("copy");
    document.body.removeChild(input);
    if (success) {
      CustomMessage.success(successMessage);
    }

    return success;
  } catch (err) {
    console.error(err);
    return false;
  }
};
