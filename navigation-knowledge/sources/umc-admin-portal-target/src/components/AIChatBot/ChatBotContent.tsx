import { useTranslation } from "react-i18next";

import { ChatPanel } from "./components/ChatPanel";
import { useDshChat } from "./model/dshWorkflow";
import type { ChatLanguage } from "./model/types";
import "./ChatBotContent.less";

interface ChatBotContentProps {
  expanded: boolean;
  onClose: () => void;
  onExpandedChange: (expanded: boolean) => void;
}

export function ChatBotContent({
  expanded,
  onClose,
  onExpandedChange,
}: ChatBotContentProps) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;
  const language: ChatLanguage = activeLanguage.toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
  const customerChat = useDshChat(language);

  const close = () => {
    customerChat.cancelPending();
    onClose();
  };

  return (
    <div
      className="ai-chatbot__chat-surface"
      dir={language.startsWith("ar") ? "rtl" : "ltr"}
      lang={language}
    >
      <ChatPanel
        customerChat={customerChat}
        fullscreen={expanded}
        language={language}
        onClose={close}
        onFullscreenChange={onExpandedChange}
      />
    </div>
  );
}
