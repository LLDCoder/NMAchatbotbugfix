/* eslint-disable react-refresh/only-export-components */
import React, { useContext } from "react";

export type PortalFormLang = "en" | "ar";
export type FormLanguageHost = "designer" | "runtime";
const DESIGNER_CONTENT_LANG_STORAGE_KEY = "designer-content-lang";

interface FormLanguageContextValue {
  uiLang: PortalFormLang;
  contentLang: PortalFormLang;
  host: FormLanguageHost;
  setDesignerContentLang?: (lang: PortalFormLang) => void;
}

interface FormLanguageProviderProps extends FormLanguageContextValue {
  children: React.ReactNode;
}

const FormLanguageContext = React.createContext<FormLanguageContextValue>({
  uiLang: "en",
  contentLang: "en",
  host: "runtime",
});

export function FormLanguageProvider({
  children,
  ...value
}: FormLanguageProviderProps) {
  return (
    <FormLanguageContext.Provider value={value}>
      {children}
    </FormLanguageContext.Provider>
  );
}

export function mapDesignerLanguageToContentLang(
  language?: string,
): PortalFormLang {
  return typeof language === "string" && language.toLowerCase().startsWith("ar")
    ? "ar"
    : "en";
}

export function getStoredDesignerContentLang(): PortalFormLang {
  if (typeof window === "undefined") {
    return "en";
  }
  return mapDesignerLanguageToContentLang(
    window.localStorage.getItem(DESIGNER_CONTENT_LANG_STORAGE_KEY) ?? undefined,
  );
}

export function setStoredDesignerContentLang(lang: PortalFormLang) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DESIGNER_CONTENT_LANG_STORAGE_KEY, lang);
}

export function resetStoredDesignerContentLang() {
  setStoredDesignerContentLang("en");
}

export function useFormUiLang(): PortalFormLang {
  return useContext(FormLanguageContext).uiLang;
}

export function useFormContentLang(): PortalFormLang {
  return useContext(FormLanguageContext).contentLang;
}

export function useFormLanguageHost(): FormLanguageHost {
  return useContext(FormLanguageContext).host;
}

// Phase 1 compatibility alias for existing preview/content consumers.
export function useFormPreviewLang(): PortalFormLang {
  return useFormContentLang();
}
