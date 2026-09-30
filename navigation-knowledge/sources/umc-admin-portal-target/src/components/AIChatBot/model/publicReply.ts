import type {
  ScenarioAction,
  ScenarioChoice,
  ScenarioCitation,
  ScenarioSection,
  WorkflowInteraction,
} from "./types";

export type PublicReplyKind =
  | "answer"
  | "blocked"
  | "clarification"
  | "error"
  | "insufficient_evidence"
  | "out_of_scope";

export interface PublicReplyV1 {
  version: "public-reply/v1";
  kind: PublicReplyKind;
  skill: {
    id: string;
    version: string;
    step: string;
  };
  message: {
    text: string;
    quote?: string;
    sections: ScenarioSection[];
  };
  choices: ScenarioChoice[];
  citations: ScenarioCitation[];
  actions: ScenarioAction[];
  interactions: WorkflowInteraction[];
}

const publicReplyKinds = new Set<PublicReplyKind>([
  "answer",
  "blocked",
  "clarification",
  "error",
  "insufficient_evidence",
  "out_of_scope",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseQuote(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isString(value)) return null;
  const quote = value.trim();
  if (!quote) return undefined;
  return quote.length <= 20_000 ? quote : null;
}

function parseSections(value: unknown): ScenarioSection[] | null {
  if (!Array.isArray(value)) return null;
  const sections: ScenarioSection[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isString(item.title) || !Array.isArray(item.items)) return null;
    if (!item.items.every(isString)) return null;
    sections.push({ title: item.title, items: item.items });
  }
  return sections;
}

function parseChoices(value: unknown): ScenarioChoice[] | null {
  if (!Array.isArray(value)) return null;
  const choices: ScenarioChoice[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isString(item.key) || !isString(item.label)) return null;
    choices.push({ key: item.key, label: item.label });
  }
  return choices;
}

function parseCitations(value: unknown): ScenarioCitation[] | null {
  if (!Array.isArray(value)) return null;
  const citations: ScenarioCitation[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isString(item.id) ||
      !isString(item.evidence_id) ||
      !isString(item.title) ||
      !isString(item.locator)
    ) {
      return null;
    }
    citations.push({
      id: item.id,
      evidenceId: item.evidence_id,
      title: item.title,
      locator: item.locator,
    });
  }
  return citations;
}

function parseActions(
  value: unknown,
  skillId: string,
): { actions: ScenarioAction[]; interactions: WorkflowInteraction[] } | null {
  if (!Array.isArray(value)) return null;
  const actions: ScenarioAction[] = [];
  const interactions: WorkflowInteraction[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) continue;
    if (item.type === "upload") {
      const purpose = typeof item.purpose === "string" ? item.purpose.trim() : "";
      const accept = Array.isArray(item.accept)
        ? item.accept.filter(isString).join(",")
        : isString(item.accept)
          ? item.accept
          : undefined;
      const maxSize = item.maxSizeBytes;
      if (
        purpose &&
        (maxSize === undefined || (typeof maxSize === "number" && Number.isFinite(maxSize)))
      ) {
        interactions.push({
          schema_version: "ff-ai.interaction.v1",
          id: `direct-upload:${skillId}:${purpose}:${index}`,
          kind: "file_upload",
          status: "pending",
          purpose,
          constraints: {
            accept,
            max_files: 1,
            max_size_bytes: maxSize,
          },
        });
      }
      continue;
    }
    // Portal navigation actions are the only actions this reply renders.
    // Runtime-only actions (e.g. `managed_interaction`) are delivered through
    // the separate `interaction` SSE frame, so skip anything that is not a
    // well-formed navigation action instead of discarding the whole envelope —
    // otherwise the entire public-reply payload leaks into the bubble as text.
    if (
      !isRecord(item) ||
      !isString(item.key) ||
      !isString(item.label) ||
      typeof item.requires_login !== "boolean"
    ) {
      continue;
    }
    actions.push({
      key: item.key,
      label: item.label,
      requiresLogin: item.requires_login,
    });
  }
  return { actions, interactions };
}

export function parsePublicReply(value: string): PublicReplyV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== "public-reply/v1") return null;
  if (!isString(parsed.kind) || !publicReplyKinds.has(parsed.kind as PublicReplyKind)) return null;
  if (!isRecord(parsed.skill) || !isRecord(parsed.message)) return null;
  if (
    !isString(parsed.skill.id) ||
    !isString(parsed.skill.version) ||
    !isString(parsed.skill.step) ||
    !isString(parsed.message.text)
  ) {
    return null;
  }

  const sections = parseSections(parsed.message.sections);
  const quote = parseQuote(parsed.message.quote);
  const choices = parseChoices(parsed.choices);
  const citations = parseCitations(parsed.citations);
  const parsedActions = parseActions(parsed.actions, parsed.skill.id);
  if (!sections || quote === null || !choices || !citations || !parsedActions) return null;

  return {
    version: "public-reply/v1",
    kind: parsed.kind as PublicReplyKind,
    skill: {
      id: parsed.skill.id,
      version: parsed.skill.version,
      step: parsed.skill.step,
    },
    message: {
      text: parsed.message.text,
      ...(quote ? { quote } : {}),
      sections,
    },
    choices,
    citations,
    actions: parsedActions.actions,
    interactions: parsedActions.interactions,
  };
}

const choiceSelectionPattern = /^\[choice_key=([^\]]{1,300})\]\s+([\s\S]+)$/;

export function parseChoiceSelection(value: string): ScenarioChoice | null {
  const match = choiceSelectionPattern.exec(value);
  if (!match) return null;
  try {
    return { key: decodeURIComponent(match[1]), label: match[2] };
  } catch {
    return null;
  }
}

export function encodeChoiceSelection(choice: ScenarioChoice) {
  return `[choice_key=${encodeURIComponent(choice.key)}] ${choice.label}`;
}

export function visibleChoiceSelection(value: string) {
  return parseChoiceSelection(value)?.label ?? value;
}

const runtimeControlBlockPattern = /\[authoritative runtime [a-z ]{1,40}\][\s\S]*$/i;
const runtimeControlPlaceholderPattern = /^\[(?:structured interaction response|structured interaction)\]$/i;

/**
 * Runtime transports wrap interaction responses in control markers such as
 * `[structured interaction response]` and `[authoritative runtime interaction]`
 * followed by the serialized protocol payload. Those markers are addressed to
 * the workflow engine, never to the customer, so they must not survive into a
 * rendered history bubble.
 */
export function visibleUserPrompt(value: string) {
  const withoutControlBlock = value.replace(runtimeControlBlockPattern, "").trim();
  if (!withoutControlBlock) return "";
  if (runtimeControlPlaceholderPattern.test(withoutControlBlock)) return "";
  return visibleChoiceSelection(withoutControlBlock);
}
