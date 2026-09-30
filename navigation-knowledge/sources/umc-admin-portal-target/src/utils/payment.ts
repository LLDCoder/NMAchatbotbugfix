function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  "master card": "Mastercard",
  amex: "American Express",
  "american express": "American Express",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  "union pay": "UnionPay",
};

function maskCardNumber(cardNumber: string) {
  const digits = cardNumber.replace(/\D/g, "");
  // Keep the format consistent with the backend-masked value: show the leading
  // 6 and trailing 4 digits, mask everything in between. Fall back gracefully
  // when the number is too short to keep both segments visible.
  if (digits.length <= 4) return digits;
  if (digits.length <= 10) return `${digits.slice(0, -4).replace(/\d/g, "*")}${digits.slice(-4)}`;
  const head = digits.slice(0, 6);
  const tail = digits.slice(-4);
  const masked = "*".repeat(digits.length - 10);
  return `${head}${masked}${tail}`;
}

export function formatPaymentCardInformation(value?: string | null) {
  const text = normalizeText(value);
  if (!text || text === "-") return text;

  const brandMatch = text.match(
    /\b(visa|mastercard|master card|amex|american express|discover|jcb|unionpay|union pay)\b/i,
  );
  // Keep the backend-provided masked card number as-is (e.g. 550000******5559).
  const cardNumberMatch = text.match(/[\d*]*\*[\d*]*|\d{4,}/);

  if (!cardNumberMatch) return "****";

  const cardNumber = cardNumberMatch[0];
  // Backend already masks the number; only fall back to masking when a raw
  // unmasked number is received. Keep the leading and trailing digits visible
  // and mask the middle part to stay consistent (e.g. 550000******5559).
  const displayNumber = cardNumber.includes("*")
    ? cardNumber
    : maskCardNumber(cardNumber);

  const prefixParts = text
    .slice(0, cardNumberMatch.index)
    .split(/[-_/|]+/)
    .map((part) => part.trim())
    .filter((part) => /[a-z]/i.test(part));

  const brand = brandMatch
    ? CARD_BRAND_LABELS[brandMatch[1].toLowerCase()]
    : prefixParts[0] || "Visa";

  return [brand, displayNumber].filter(Boolean).join(" ");
}
