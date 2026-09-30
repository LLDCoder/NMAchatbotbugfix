export default function isPureArabic(str: string) {
  if (!str || typeof str !== 'string') return false;
  const pureArabicRegex = /^[\p{Script_Extensions=Arabic}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s.,!?-]+$/u;
  const trimmedStr = str.trim();
  if (trimmedStr === '') return false;
  return pureArabicRegex.test(trimmedStr);
}