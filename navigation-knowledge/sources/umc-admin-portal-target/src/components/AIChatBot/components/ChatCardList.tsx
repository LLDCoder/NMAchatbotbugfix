import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DollarCircleOutlined,
  ExportOutlined,
  FileTextOutlined,
  FormOutlined,
  HomeOutlined,
  IdcardOutlined,
  LinkOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { getAppConfig } from "@/config/appConfig";
import { authService } from "@/services/auth";
import { history } from "@/utils/history";
import {
  createPortalLoginUrl,
  getPortalCardRoute,
  normalizeChatCards,
  storePortalReturnUrl,
  type ChatCard,
} from "../model/cards";
import type { ChatLanguage } from "../model/types";
import "./ChatCardList.less";

interface ChatCardListProps {
  cards: ChatCard[];
  language: ChatLanguage;
}

function CardIcon({ iconKey }: { iconKey?: string }) {
  switch (iconKey) {
    case "home": return <HomeOutlined />;
    case "service": return <AppstoreOutlined />;
    case "request": return <FormOutlined />;
    case "payment": return <DollarCircleOutlined />;
    case "permit": return <SafetyCertificateOutlined />;
    case "fine": return <WarningOutlined />;
    case "refund": return <UndoOutlined />;
    case "complaint": return <MessageOutlined />;
    case "profile": return <IdcardOutlined />;
    case "document": return <FileTextOutlined />;
    case "external": return <ExportOutlined />;
    default: return <LinkOutlined />;
  }
}

function CardContent({ card, language }: { card: ChatCard; language: ChatLanguage }) {
  const { t } = useTranslation();
  const defaultCta = card.kind === "external_link"
    ? t("aiChatBot.chat.openLink")
    : t("aiChatBot.chat.openPage");
  return (
    <>
      <span className="ai-chatbot__chat-card-header">
        <span aria-hidden="true" className="ai-chatbot__chat-card-icon">
          <CardIcon iconKey={card.icon_key} />
        </span>
        {card.badge ? <span className="ai-chatbot__chat-card-badge">{card.badge}</span> : null}
      </span>
      <span className="ai-chatbot__chat-card-body">
        <strong>{card.title}</strong>
        {card.description ? <span>{card.description}</span> : null}
      </span>
      <span className="ai-chatbot__chat-card-cta">
        {card.cta_label || defaultCta}
        {card.kind === "external_link"
          ? <ExportOutlined />
          : language.startsWith("ar") ? <ArrowLeftOutlined /> : <ArrowRightOutlined />}
      </span>
    </>
  );
}

export function ChatCardList({ cards, language }: ChatCardListProps) {
  const safeCards = normalizeChatCards(
    cards,
    getAppConfig().ffAi.cardAllowedExternalHosts,
  );
  if (!safeCards.length) return null;

  return (
    <div className="ai-chatbot__chat-card-grid">
      {safeCards.map((card) => {
        const accessibleLabel = [card.title, card.cta_label].filter(Boolean).join(". ");
        if (card.kind === "external_link") {
          return (
            <a
              aria-label={accessibleLabel}
              className="ai-chatbot__chat-card"
              href={card.destination.url}
              key={card.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <CardContent card={card} language={language} />
            </a>
          );
        }

        const route = getPortalCardRoute(card.destination.route_key);
        if (!route) return null;
        return (
          <button
            aria-label={accessibleLabel}
            className="ai-chatbot__chat-card"
            key={card.id}
            type="button"
            onClick={() => {
              if (authService.isAuthenticated()) {
                history.push(route);
                return;
              }
              storePortalReturnUrl(route);
              history.push(createPortalLoginUrl(route));
            }}
          >
            <CardContent card={card} language={language} />
          </button>
        );
      })}
    </div>
  );
}
