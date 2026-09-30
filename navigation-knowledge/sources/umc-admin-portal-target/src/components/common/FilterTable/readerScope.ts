import moment from "moment";

const PRIVATE_FIELD = /token|password|secret|cookie|authorization|email|phone|passport/i;

function publicValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "string") return value.length <= 120 ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (value.length > 12) return undefined;
    const items = value.map((item) => Array.isArray(item) ? undefined : publicValue(item));
    return items.includes(undefined) ? undefined : items;
  }
  // DatePicker uses Moment in AntD 4. Only its serialized date is a hint.
  if (moment.isMoment(value)) return value.isValid() ? value.format("YYYY-MM-DDTHH:mm:ssZ") : undefined;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? moment(value).format("YYYY-MM-DDTHH:mm:ssZ") : undefined;
  return undefined;
}

export function appliedFilterSignature(values: Record<string, unknown>): string {
  // This stays in component memory, including free text; it is never sent.
  return JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))));
}

export function readerFilterScope(
  id: string,
  revision: number,
  values: Record<string, unknown>,
  fields: Array<{ type: string; key: string }>,
): string {
  const filters: Record<string, unknown> = {};
  for (const field of fields) {
    // Free-text search still changes the opaque revision, but its content is
    // not forwarded as page context. Draft modal values never reach this API.
    if (!["select", "range"].includes(field.type) || PRIVATE_FIELD.test(field.key)) continue;
    const value = publicValue(values[field.key]);
    if (value == null || value === "" || value === undefined) continue;
    const candidate = { ...filters, [field.key]: value };
    if (JSON.stringify({ contextVersion: `${id}:${revision}`, filters: candidate }).length <= 480) filters[field.key] = value;
  }
  return JSON.stringify({ contextVersion: `${id}:${revision}`, filters });
}
