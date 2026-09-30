import dayjs from "dayjs";

import { fromApi, GST } from "@/utils/gstTime";
import i18n from "@/localization/config";

export type StructuredArtifactType =
  | "ff-ai.todo-list.v1"
  | "ff-ai.data-table.v1"
  | "ff-ai.key-value.v1"
  | "ff-ai.timeline.v1"
  | "ff-ai.record-list.v1";

export type ArtifactLocale = "en" | "ar";
export type ArtifactValue = string | number | boolean | null;
export type ArtifactValueFormat = "text" | "number" | "currency" | "date" | "status";
export type RecordFieldTone = "default" | "muted" | "success" | "warning" | "danger";

export interface TodoArtifactItem {
  id: string;
  label: string;
  status: "pending" | "completed" | "blocked";
  detail?: string;
}

export interface TodoListArtifact {
  type: "ff-ai.todo-list.v1";
  id: string;
  title: string;
  description?: string;
  items: TodoArtifactItem[];
}

export interface DataTableArtifactColumn {
  key: string;
  label: string;
  format: ArtifactValueFormat;
  currency?: string;
}

export interface DataTableArtifactRow {
  id: string;
  cells: Record<string, ArtifactValue>;
}

export interface DataTableArtifact {
  type: "ff-ai.data-table.v1";
  id: string;
  title: string;
  description?: string;
  columns: DataTableArtifactColumn[];
  rows: DataTableArtifactRow[];
}

export interface KeyValueArtifactItem {
  key: string;
  label: string;
  value: ArtifactValue;
  format: ArtifactValueFormat;
  currency?: string;
}

export interface KeyValueArtifact {
  type: "ff-ai.key-value.v1";
  id: string;
  title: string;
  description?: string;
  items: KeyValueArtifactItem[];
}

export interface TimelineArtifactItem {
  id: string;
  title: string;
  description?: string;
  status: "completed" | "current" | "upcoming" | "blocked";
  timestamp?: string;
}

export interface TimelineArtifact {
  type: "ff-ai.timeline.v1";
  id: string;
  title: string;
  description?: string;
  items: TimelineArtifactItem[];
}

export interface RecordArtifactField {
  key: string;
  label: string;
  value: ArtifactValue;
  format: ArtifactValueFormat;
  tone: RecordFieldTone;
  currency?: string;
}

export interface RecordArtifactItem {
  id: string;
  title: string;
  fields: RecordArtifactField[];
}

export interface RecordListArtifact {
  type: "ff-ai.record-list.v1";
  id: string;
  title: string;
  description?: string;
  items: RecordArtifactItem[];
}

export type StructuredArtifact =
  | TodoListArtifact
  | DataTableArtifact
  | KeyValueArtifact
  | TimelineArtifact
  | RecordListArtifact;

const STRUCTURED_TABLE_FALLBACK_TITLE = String(
  i18n.t("aiChatBot.chat.structuredTable", { lng: "en" }),
);

export function isDefaultStructuredTableTitle(title: string) {
  return title === STRUCTURED_TABLE_FALLBACK_TITLE;
}

export interface WorkflowArtifactsPayload {
  version: 1;
  artifacts: StructuredArtifact[];
}

const ARTIFACT_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const CHILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const COLUMN_KEY_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_ARTIFACTS = 4;
const MAX_ITEMS = 12;
const MAX_COLUMNS = 6;
const MAX_ROWS = 20;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 280;
const MAX_LABEL = 160;
const STRUCTURED_CONTENT_PATTERN = /<structured_content>\s*([\s\S]*?)\s*<\/structured_content>/gi;
const ARTIFACT_TYPE_ALIASES: Record<string, StructuredArtifactType> = {
  "ff-ai.todo-list.v1": "ff-ai.todo-list.v1",
  "ff-ai.data-table.v1": "ff-ai.data-table.v1",
  "ff-ai.key-value.v1": "ff-ai.key-value.v1",
  "ff-ai.timeline.v1": "ff-ai.timeline.v1",
  "ff-ai.record-list.v1": "ff-ai.record-list.v1",
  todo_list: "ff-ai.todo-list.v1",
  data_table: "ff-ai.data-table.v1",
  key_value: "ff-ai.key-value.v1",
  timeline: "ff-ai.timeline.v1",
  record_list: "ff-ai.record-list.v1",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function limitedText(value: unknown, maximum: number, required = false) {
  if (value === undefined || value === null) return required ? null : undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if ((!trimmed && required) || [...trimmed].length > maximum) return null;
  return trimmed || undefined;
}

function normalizePrimitiveValue(value: unknown): ArtifactValue | typeof invalidValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return invalidValue;
}

function isValidDateValue(value: ArtifactValue) {
  if (value === null) return true;
  if (typeof value !== "string" && typeof value !== "number") return false;
  return typeof value === "string" ? Boolean(fromApi(value)) : dayjs(value).tz(GST).isValid();
}

function validateFormattedValue(
  value: unknown,
  format: ArtifactValueFormat,
): ArtifactValue | typeof invalidValue {
  const normalized = normalizePrimitiveValue(value);
  if (normalized === invalidValue) return invalidValue;
  if (normalized === null) return null;
  if ((format === "number" || format === "currency") && typeof normalized !== "number") {
    return invalidValue;
  }
  if (format === "date" && !isValidDateValue(normalized)) return invalidValue;
  return normalized;
}

function normalizeCurrency(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" && CURRENCY_PATTERN.test(value) ? value : null;
}

function normalizeArtifactBase(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    typeof value.id !== "string" ||
    !ARTIFACT_ID_PATTERN.test(value.id)
  ) {
    return null;
  }
  const type = ARTIFACT_TYPE_ALIASES[value.type];
  if (!type) return null;
  const title = limitedText(value.title, MAX_TITLE, true);
  const description = limitedText(value.description, MAX_DESCRIPTION);
  if (!title || description === null) return null;
  return {
    type,
    id: value.id,
    title,
    ...(description ? { description } : {}),
    value,
  };
}

function normalizeTodoArtifact(value: unknown): TodoListArtifact | null {
  const base = normalizeArtifactBase(value);
  if (!base || base.type !== "ff-ai.todo-list.v1" || !Array.isArray(base.value.items)) return null;
  const items: TodoArtifactItem[] = [];
  const seen = new Set<string>();
  for (const candidate of base.value.items) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || seen.has(candidate.id)) continue;
    if (!CHILD_ID_PATTERN.test(candidate.id)) continue;
    const label = limitedText(candidate.label ?? candidate.title, MAX_LABEL, true);
    const detail = limitedText(candidate.detail, MAX_DESCRIPTION);
    if (
      !label ||
      detail === null ||
      (candidate.status !== "pending" &&
        candidate.status !== "completed" &&
        candidate.status !== "blocked")
    ) {
      continue;
    }
    seen.add(candidate.id);
    items.push({
      id: candidate.id,
      label,
      status: candidate.status,
      ...(detail ? { detail } : {}),
    });
    if (items.length === MAX_ITEMS) break;
  }
  if (!items.length) return null;
  return { type: base.type, id: base.id, title: base.title, ...("description" in base ? { description: base.description } : {}), items };
}

function normalizeDataTableArtifact(value: unknown): DataTableArtifact | null {
  const base = normalizeArtifactBase(value);
  if (
    !base ||
    base.type !== "ff-ai.data-table.v1" ||
    !Array.isArray(base.value.columns) ||
    !Array.isArray(base.value.rows)
  ) {
    return null;
  }

  const columns: DataTableArtifactColumn[] = [];
  const seenColumns = new Set<string>();
  for (const candidate of base.value.columns) {
    if (!isRecord(candidate) || typeof candidate.key !== "string" || seenColumns.has(candidate.key)) {
      continue;
    }
    const label = limitedText(candidate.label, MAX_LABEL, true);
    const currency = normalizeCurrency(candidate.currency);
    const format = candidate.format === undefined ? "text" : candidate.format;
    if (
      !COLUMN_KEY_PATTERN.test(candidate.key) ||
      !label ||
      currency === null ||
      (currency !== undefined && format !== "currency") ||
      (format !== "text" &&
        format !== "number" &&
        format !== "currency" &&
        format !== "date" &&
        format !== "status")
    ) {
      continue;
    }
    seenColumns.add(candidate.key);
    columns.push({
      key: candidate.key,
      label,
      format,
      ...(currency ? { currency } : {}),
    });
    if (columns.length === MAX_COLUMNS) break;
  }
  if (!columns.length) return null;

  const rows: DataTableArtifactRow[] = [];
  const seenRows = new Set<string>();
  for (const candidate of base.value.rows) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || seenRows.has(candidate.id)) continue;
    if (!CHILD_ID_PATTERN.test(candidate.id) || !isRecord(candidate.cells)) continue;
    const cells: Record<string, ArtifactValue> = {};
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(candidate.cells, column.key)) continue;
      const normalizedValue = validateFormattedValue(candidate.cells[column.key], column.format);
      if (normalizedValue === invalidValue) continue;
      cells[column.key] = normalizedValue;
    }
    seenRows.add(candidate.id);
    rows.push({ id: candidate.id, cells });
    if (rows.length === MAX_ROWS) break;
  }
  if (!rows.length) return null;
  return { type: base.type, id: base.id, title: base.title, ...("description" in base ? { description: base.description } : {}), columns, rows };
}

function normalizeKeyValueArtifact(value: unknown): KeyValueArtifact | null {
  const base = normalizeArtifactBase(value);
  if (!base || base.type !== "ff-ai.key-value.v1" || !Array.isArray(base.value.items)) return null;
  const items: KeyValueArtifactItem[] = [];
  const seen = new Set<string>();
  for (const candidate of base.value.items) {
    if (!isRecord(candidate) || typeof candidate.key !== "string" || seen.has(candidate.key)) continue;
    const label = limitedText(candidate.label, MAX_LABEL, true);
    const currency = normalizeCurrency(candidate.currency);
    const format = candidate.format === undefined ? "text" : candidate.format;
    if (
      !COLUMN_KEY_PATTERN.test(candidate.key) ||
      !label ||
      currency === null ||
      (currency !== undefined && format !== "currency") ||
      (format !== "text" &&
        format !== "number" &&
        format !== "currency" &&
        format !== "date" &&
        format !== "status")
    ) {
      continue;
    }
    const normalizedValue = validateFormattedValue(candidate.value, format);
    if (normalizedValue === invalidValue) continue;
    seen.add(candidate.key);
    items.push({
      key: candidate.key,
      label,
      value: normalizedValue,
      format,
      ...(currency ? { currency } : {}),
    });
    if (items.length === MAX_ITEMS) break;
  }
  if (!items.length) return null;
  return { type: base.type, id: base.id, title: base.title, ...("description" in base ? { description: base.description } : {}), items };
}

function normalizeTimelineArtifact(value: unknown): TimelineArtifact | null {
  const base = normalizeArtifactBase(value);
  if (!base || base.type !== "ff-ai.timeline.v1" || !Array.isArray(base.value.items)) return null;
  const items: TimelineArtifactItem[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of base.value.items.entries()) {
    if (!isRecord(candidate)) continue;
    const title = limitedText(candidate.title, MAX_LABEL, true);
    if (!title) continue;
    const id = makeChildId(candidate.id, title, `step-${index + 1}`);
    if (!id || seen.has(id)) continue;
    const description = limitedText(candidate.description, MAX_DESCRIPTION);
    const timestamp =
      candidate.timestamp === undefined || candidate.timestamp === null ||
      (typeof candidate.timestamp === "string" &&
        ["n/a", "na", "none", "-"].includes(candidate.timestamp.trim().toLowerCase()))
        ? undefined
        : typeof candidate.timestamp === "string" && !Number.isNaN(Date.parse(candidate.timestamp))
          ? candidate.timestamp
          : null;
    if (
      description === null ||
      timestamp === null ||
      (candidate.status !== "completed" &&
        candidate.status !== "current" &&
        candidate.status !== "upcoming" &&
        candidate.status !== "blocked")
    ) {
      continue;
    }
    seen.add(id);
    items.push({
      id,
      title,
      status: candidate.status,
      ...(description ? { description } : {}),
      ...(timestamp ? { timestamp } : {}),
    });
    if (items.length === MAX_ITEMS) break;
  }
  if (!items.length) return null;
  return { type: base.type, id: base.id, title: base.title, ...("description" in base ? { description: base.description } : {}), items };
}

function normalizeRecordListArtifact(value: unknown): RecordListArtifact | null {
  const base = normalizeArtifactBase(value);
  if (!base || base.type !== "ff-ai.record-list.v1" || !Array.isArray(base.value.items)) {
    return null;
  }
  const items: RecordArtifactItem[] = [];
  const seenItems = new Set<string>();
  for (const candidate of base.value.items) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || seenItems.has(candidate.id)) {
      continue;
    }
    const title = limitedText(candidate.title, MAX_LABEL, true);
    if (!CHILD_ID_PATTERN.test(candidate.id) || !title || !Array.isArray(candidate.fields)) continue;

    const fields: RecordArtifactField[] = [];
    const seenFields = new Set<string>();
    for (const field of candidate.fields) {
      if (!isRecord(field) || typeof field.key !== "string" || seenFields.has(field.key)) continue;
      const label = limitedText(field.label, MAX_LABEL, true);
      const format = field.format === undefined ? "text" : field.format;
      const tone = field.tone === undefined ? "default" : field.tone;
      const currency = normalizeCurrency(field.currency);
      if (
        !COLUMN_KEY_PATTERN.test(field.key) ||
        !label ||
        currency === null ||
        (currency !== undefined && format !== "currency") ||
        (format !== "text" &&
          format !== "number" &&
          format !== "currency" &&
          format !== "date" &&
          format !== "status") ||
        (tone !== "default" &&
          tone !== "muted" &&
          tone !== "success" &&
          tone !== "warning" &&
          tone !== "danger")
      ) {
        continue;
      }
      const normalizedValue = validateFormattedValue(field.value, format);
      if (normalizedValue === invalidValue) continue;
      fields.push({
        key: field.key,
        label,
        value: normalizedValue,
        format,
        tone,
        ...(currency ? { currency } : {}),
      });
      seenFields.add(field.key);
      if (fields.length === MAX_ITEMS) break;
    }
    if (!fields.length) continue;
    items.push({ id: candidate.id, title, fields });
    seenItems.add(candidate.id);
    if (items.length === MAX_ROWS) break;
  }
  if (!items.length) return null;
  return {
    type: base.type,
    id: base.id,
    title: base.title,
    ...("description" in base ? { description: base.description } : {}),
    items,
  };
}

function normalizeArtifact(value: unknown): StructuredArtifact | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  switch (ARTIFACT_TYPE_ALIASES[value.type]) {
    case "ff-ai.todo-list.v1":
      return normalizeTodoArtifact(value);
    case "ff-ai.data-table.v1":
      return normalizeDataTableArtifact(value);
    case "ff-ai.key-value.v1":
      return normalizeKeyValueArtifact(value);
    case "ff-ai.timeline.v1":
      return normalizeTimelineArtifact(value);
    case "ff-ai.record-list.v1":
      return normalizeRecordListArtifact(value);
    default:
      return null;
  }
}

const invalidValue = Symbol("invalid-artifact-value");

export function normalizeStructuredArtifacts(value: unknown): StructuredArtifact[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.artifacts)
      ? value.artifacts
      : [];

  const order: string[] = [];
  const byKey = new Map<string, StructuredArtifact>();

  for (const candidate of source) {
    const artifact = normalizeArtifact(candidate);
    if (!artifact) continue;
    const key = `${artifact.type}:${artifact.id}`;
    if (!byKey.has(key)) {
      if (order.length === MAX_ARTIFACTS) continue;
      order.push(key);
    }
    byKey.set(key, artifact);
  }

  return order
    .map((key) => byKey.get(key))
    .filter((artifact): artifact is StructuredArtifact => Boolean(artifact));
}

function slugifyId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized && CHILD_ID_PATTERN.test(normalized) ? normalized : "";
}

function makeChildId(value: unknown, label: string, fallback: string) {
  if (typeof value === "string" && CHILD_ID_PATTERN.test(value)) return value;
  return slugifyId(label) || fallback;
}

function parseStructuredContent(value: string) {
  try {
    return normalizeStructuredArtifacts(JSON.parse(value));
  } catch {
    return [];
  }
}

function compactMarkdownText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMarkdownTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string) {
  const cells = parseMarkdownTableCells(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function inferDataTableArtifact(content: string) {
  const lines = content.split("\n");
  const artifacts: StructuredArtifact[] = [];
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const header = lines[index];
    const separator = lines[index + 1];
    if (
      header?.includes("|") &&
      separator?.includes("|") &&
      isMarkdownTableSeparator(separator)
    ) {
      const headers = parseMarkdownTableCells(header).slice(0, MAX_COLUMNS);
      const rows: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes("|")) {
        const cells = parseMarkdownTableCells(lines[cursor]);
        if (cells.length < headers.length) break;
        rows.push(cells.slice(0, headers.length));
        cursor += 1;
      }
      if (headers.length > 1 && rows.length) {
        const columns = headers.map((label, columnIndex) => ({
          key: slugifyId(label) || `column-${columnIndex + 1}`,
          label,
          format: "text" as const,
        }));
        artifacts.push({
          type: "ff-ai.data-table.v1",
          id: "markdown-table",
          title: STRUCTURED_TABLE_FALLBACK_TITLE,
          columns,
          rows: rows.slice(0, MAX_ROWS).map((row, rowIndex) => ({
            id: `row-${rowIndex + 1}`,
            cells: Object.fromEntries(
              columns.map((column, columnIndex) => [column.key, row[columnIndex] ?? ""]),
            ),
          })),
        });
        index = cursor;
        continue;
      }
    }
    output.push(lines[index]);
    index += 1;
  }

  return {
    artifacts,
    text: compactMarkdownText(output.join("\n")),
  };
}

function inferTodoArtifacts(content: string) {
  if (!content.includes("✅")) return { artifacts: [] as StructuredArtifact[], text: content };
  const lines = content.split("\n");
  const output: string[] = [];
  const groups: Array<{ title: string; items: string[] }> = [];
  let currentTitle = "";
  let currentItems: string[] = [];

  const flush = () => {
    if (currentTitle && currentItems.length) {
      groups.push({ title: currentTitle, items: currentItems });
    }
    currentItems = [];
  };

  for (const line of lines) {
    const heading = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      currentTitle = heading[2].trim();
      output.push(line);
      continue;
    }

    const item = /^\s*(?:[-*]\s*)?✅\s*(.+?)\s*$/.exec(line);
    if (item && currentTitle) {
      currentItems.push(item[1].trim());
      continue;
    }

    output.push(line);
  }
  flush();

  const artifacts = groups.slice(0, MAX_ARTIFACTS).map<StructuredArtifact>((group, groupIndex) => ({
    type: "ff-ai.todo-list.v1",
    id: slugifyId(group.title) || `checklist-${groupIndex + 1}`,
    title: group.title,
    items: group.items.slice(0, MAX_ITEMS).map((item, itemIndex) => ({
      id: slugifyId(item) || `item-${itemIndex + 1}`,
      label: item,
      status: "completed",
    })),
  }));

  return {
    artifacts,
    text: artifacts.length ? compactMarkdownText(output.join("\n")) : content,
  };
}

function inferStructuredArtifactsFromMarkdown(content: string) {
  const tableResult = inferDataTableArtifact(content);
  if (tableResult.artifacts.length) return tableResult;
  return inferTodoArtifacts(content);
}

export function recoverHistoryStructuredArtifactsFromText(
  content: string,
  explicitArtifacts: unknown = [],
): { text: string; artifacts: StructuredArtifact[] } {
  const explicit = normalizeStructuredArtifacts(explicitArtifacts);
  const embedded: StructuredArtifact[] = [];
  const stripped = content.replace(STRUCTURED_CONTENT_PATTERN, (_match, payload: string) => {
    embedded.push(...parseStructuredContent(payload));
    return "";
  });

  const combined = normalizeStructuredArtifacts([...explicit, ...embedded]);
  const text = compactMarkdownText(stripped);
  if (combined.length) return { text, artifacts: combined };

  const inferred = inferStructuredArtifactsFromMarkdown(text);
  return {
    text: inferred.text,
    artifacts: normalizeStructuredArtifacts(inferred.artifacts),
  };
}

export const recoverStructuredArtifactsFromText = recoverHistoryStructuredArtifactsFromText;
