import DOMPurify, { type Config } from "dompurify";

const htmlSanitizeConfig: Config = {
  ADD_ATTR: ["target"],
};

export function sanitizeHtml(value?: string | null): string {
  return DOMPurify.sanitize(value || "", htmlSanitizeConfig);
}
