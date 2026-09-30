import type {
  DataTableArtifact,
  StructuredArtifact,
} from "./artifacts";
import {
  formatArtifactStatus,
  formatArtifactValue,
  formatTimelineTimestamp,
} from "./artifactFormatting";
import type { ChatCard } from "./cards";
import type { ChatLanguage, ScenarioMessage } from "./types";
import i18n from "@/localization/config";
import { isDefaultStructuredTableTitle } from "./artifacts";

function joinVisibleLines(lines: Array<string | undefined>) {
  return lines
    .flatMap((line) => line?.split("\n") ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function formatMarkdownInlineForCopy(value: string) {
  let result = value.replace(/\\\\([\\\\`*_[\]()~|])/g, "$1");
  result = result.replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1");
  result = result.replace(/(`+)([^`]*?)\1/g, "$2");
  result = result.replace(/(\*\*|__|~~)([\s\S]*?)\1/g, "$2");
  return result.replace(/(^|[^\\w])([*_])([^\n]+?)\2/g, "$1$3");
}

function formatMarkdownForCopy(value: string) {
  let fenceMarker: string | undefined;
  const lines: string[] = [];

  for (const sourceLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const fence = sourceLine.match(/^\s*(`{3,}|~{3,})\s*[\w#+.-]*\s*$/);
    if (fence) {
      fenceMarker = fenceMarker ? undefined : fence[1];
      continue;
    }
    if (fenceMarker) {
      lines.push(sourceLine);
      continue;
    }

    const heading = sourceLine.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      lines.push(formatMarkdownInlineForCopy(heading[1]));
      continue;
    }
    if (/^\s{0,3}(?:(?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/.test(sourceLine)) {
      continue;
    }

    const table = sourceLine.trim();
    if (table.includes("|")) {
      const cells = table.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      if (cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      if (cells.length > 1) {
        lines.push(cells.map(formatMarkdownInlineForCopy).join("\t"));
        continue;
      }
    }

    const quote = sourceLine.match(/^\s{0,3}>\s?(.*)$/);
    lines.push(formatMarkdownInlineForCopy(quote?.[1] ?? sourceLine));
  }

  return joinVisibleLines(lines);
}

function formatDataTable(artifact: DataTableArtifact, language: ChatLanguage) {
  const title = isDefaultStructuredTableTitle(artifact.title)
    ? String(i18n.t("aiChatBot.chat.structuredTable", { lng: language }))
    : artifact.title;
  const rows = artifact.rows.map((row) => artifact.columns
    .map((column) => formatArtifactValue(
      row.cells[column.key] ?? null,
      column.format,
      language,
      column.currency,
    ))
    .join("\t"));

  return joinVisibleLines([
    title,
    artifact.description,
    artifact.columns.map((column) => column.label).join("\t"),
    ...rows,
  ]);
}

function formatArtifactForCopy(artifact: StructuredArtifact, language: ChatLanguage) {
  switch (artifact.type) {
    case "ff-ai.todo-list.v1":
      return joinVisibleLines([
        artifact.title,
        artifact.description,
        ...artifact.items.map((item) => joinVisibleLines([
          `- ${item.label} (${formatArtifactStatus(item.status, language)})`,
          item.detail ? `  ${item.detail}` : undefined,
        ])),
      ]);
    case "ff-ai.data-table.v1":
      return formatDataTable(artifact, language);
    case "ff-ai.key-value.v1":
      return joinVisibleLines([
        artifact.title,
        artifact.description,
        ...artifact.items.map((item) => `${item.label}: ${formatArtifactValue(
          item.value,
          item.format,
          language,
          item.currency,
        )}`),
      ]);
    case "ff-ai.timeline.v1":
      return joinVisibleLines([
        artifact.title,
        artifact.description,
        ...artifact.items.map((item) => joinVisibleLines([
          `- ${item.title} (${formatArtifactStatus(item.status, language)})`,
          item.description ? `  ${item.description}` : undefined,
          item.timestamp ? `  ${formatTimelineTimestamp(item.timestamp, language)}` : undefined,
        ])),
      ]);
    case "ff-ai.record-list.v1":
      return joinVisibleLines([
        artifact.title,
        artifact.description,
        ...artifact.items.map((item) => joinVisibleLines([
          item.title,
          ...item.fields.map((field) => `${field.label}: ${formatArtifactValue(
            field.value,
            field.format,
            language,
            field.currency,
          )}`),
        ])),
      ]);
    default:
      return "";
  }
}

function formatCardForCopy(card: ChatCard, language: ChatLanguage) {
  const fallbackCta = card.kind === "external_link"
    ? String(i18n.t("aiChatBot.chat.openLink", { lng: language }))
    : String(i18n.t("aiChatBot.chat.openPage", { lng: language }));
  return joinVisibleLines([
    card.badge,
    card.title,
    card.description,
    card.cta_label || fallbackCta,
  ]);
}

export function formatMessageForCopy(
  message: ScenarioMessage,
  language: ChatLanguage,
  visibleCards: ChatCard[] = message.cards ?? [],
) {
  const blocks = [
    formatMarkdownForCopy(message.text),
    message.quote,
    ...(message.sections ?? []).map((section) => joinVisibleLines([
      section.title,
      ...section.items.map((item) => `- ${item}`),
    ])),
    ...(message.choices ?? []).map((choice) => choice.label),
    message.dataRows?.length
      ? joinVisibleLines([
        message.dataTitle,
        ...message.dataRows.map((row) => `${row.label}: ${row.value}`),
      ])
      : undefined,
    ...visibleCards.map((card) => formatCardForCopy(card, language)),
    ...(message.artifacts ?? []).map((artifact) => formatArtifactForCopy(artifact, language)),
    ...(message.sources ?? []),
    ...(message.citations ?? []).map((citation) => citation.title),
    ...(message.actions ?? []).map((action) => typeof action === "string" ? action : action.label),
    ...(message.interactions ?? []).map((interaction) => {
      const summary = typeof interaction.summary === "string"
        ? interaction.summary
        : interaction.summary && typeof interaction.summary === "object"
          ? joinVisibleLines(Object.entries(interaction.summary).map(([label, value]) =>
            `${label}: ${typeof value === "string" || typeof value === "number" ? String(value) : "-"}`,
          ))
          : undefined;
      return joinVisibleLines([summary, interaction.uploaded_file_name]);
    }),
  ];

  return blocks
    .map((block) => block?.trim())
    .filter(Boolean)
    .join("\n\n");
}
