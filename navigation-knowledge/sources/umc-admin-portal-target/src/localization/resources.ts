import ar from "./locales/ar.json";
import en from "./locales/en.json";
import licensingAr from "./licensing/ar.json";
import licensingEn from "./licensing/en.json";
import formilyAr from "./formily/ar.json";
import formilyEn from "./formily/en.json";
import contentAr from "./content/ar.json";
import contentEn from "./content/en.json";
import customerAr from "./customer/ar.json";
import customerEn from "./customer/en.json";
import financeAr from "./finance/ar.json";
import financeEn from "./finance/en.json";
import cmsAr from "./cms/ar.json";
import cmsEn from "./cms/en.json";
import personalCenterAr from "./personalCenter/ar.json";
import personalCenterEn from "./personalCenter/en.json";
import settingsAr from "./settings/ar.json";
import settingsEn from "./settings/en.json";
import teamManagementAr from "./teamManagement/ar.json";
import teamManagementEn from "./teamManagement/en.json";
import dashboardAr from "./dashboard/ar.json";
import dashboardEn from "./dashboard/en.json";
import communicationsAr from "./communications/ar.json";
import communicationsEn from "./communications/en.json";
import aiChatBotAr from "./aiChatBot/ar.json";
import aiChatBotEn from "./aiChatBot/en.json";
import {
  buildTranslationResources,
  type TranslationResourceEntry,
} from "./resourceBuilder";

export const translationResourceRegistry: readonly TranslationResourceEntry[] =
  [
    {
      owner: "locales",
      en,
      ar,
    },
    { owner: "licensing", en: licensingEn, ar: licensingAr },
    { owner: "formily", en: formilyEn, ar: formilyAr },
    { owner: "content", en: contentEn, ar: contentAr },
    { owner: "customer", en: customerEn, ar: customerAr },
    { owner: "finance", en: financeEn, ar: financeAr },
    { owner: "cms", en: cmsEn, ar: cmsAr },
    {
      owner: "personalCenter",
      en: personalCenterEn,
      ar: personalCenterAr,
    },
    { owner: "settings", en: settingsEn, ar: settingsAr },
    {
      owner: "teamManagement",
      en: teamManagementEn,
      ar: teamManagementAr,
    },
    { owner: "dashboard", en: dashboardEn, ar: dashboardAr },
    {
      owner: "communications",
      en: communicationsEn,
      ar: communicationsAr,
    },
    { owner: "aiChatBot", en: aiChatBotEn, ar: aiChatBotAr },
  ];

export const resources = buildTranslationResources(
  translationResourceRegistry,
);
