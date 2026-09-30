import type { ChatCard } from "./cards";
import type { StructuredArtifact } from "./artifacts";

export type PortalId = "public" | "customer" | "admin";
export type ChatLanguage = "en" | "ar";
export type ChatFeedbackRating = "up" | "down";

export interface LocalizedText {
  en: string;
  ar: string;
}

export interface ScenarioNotes {
  title: LocalizedText;
  points: LocalizedText[];
}

export interface ScenarioSection {
  title: string;
  items: string[];
}

export interface ScenarioDataRow {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}

export interface ScenarioChoice {
  key: string;
  label: string;
}

export interface ScenarioCitation {
  id: string;
  evidenceId: string;
  title: string;
  locator: string;
}

export interface ScenarioAction {
  key: string;
  label: string;
  requiresLogin: boolean;
}

export interface ChatAttachment {
  fileRef: string;
  fileName: string;
  fileUrl: string;
  fileType: 0 | 1;
  kind: "image" | "pdf";
  mimeType: string;
  previewUrl?: string;
}

export interface ScenarioMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  eventSeq?: number;
  statusMessage?: string;
  attachment?: ChatAttachment;
  quote?: string;
  status?: "streaming" | "failed";
  sections?: ScenarioSection[];
  sources?: string[];
  citations?: ScenarioCitation[];
  choices?: ScenarioChoice[];
  selectedChoiceKey?: string;
  cards?: ChatCard[];
  artifacts?: StructuredArtifact[];
  interactions?: WorkflowInteraction[];
  progress?: WorkflowProgress;
  actions?: Array<string | ScenarioAction>;
  dataTitle?: string;
  dataRows?: ScenarioDataRow[];
  tone?: "default" | "warning" | "danger";
  feedback?: ChatFeedbackRating;
}

export type WorkflowInteractionKind = "file_upload" | "submit_confirmation";
export type WorkflowInteractionStatus =
  | "pending"
  | "completed"
  | "modified"
  | "cancelled"
  | "expired";

export interface WorkflowFileConstraints {
  accept?: string;
  max_files?: number;
  accepted_media_types?: string[];
  max_size_bytes?: number;
}

export interface WorkflowInteraction {
  schema_version: "ff-ai.interaction.v1";
  id: string;
  kind: WorkflowInteractionKind;
  status: WorkflowInteractionStatus;
  purpose?: string;
  constraints?: WorkflowFileConstraints;
  summary?: Record<string, unknown> | string;
  client_status?: "uploading" | "failed";
  client_error?: string;
  uploaded_file_name?: string;
}

export interface WorkflowProgress {
  schema_version: "ff-ai.progress.v1";
  phase: "processing";
  elapsed_seconds: number;
  message_key: string;
}

export interface ScenarioDefinition {
  id: string;
  portal: PortalId;
  label: LocalizedText;
  tag: string;
  category: string;
  notes: ScenarioNotes;
  renderKey: string;
  mode: "fixture" | "customer-live";
  messages?: ScenarioMessage[];
}

export interface ScenarioGroup {
  name: LocalizedText;
  ids: string[];
}

export interface PortalDefinition {
  id: PortalId;
  label: LocalizedText;
  hintTag: LocalizedText;
  hintTitle: LocalizedText;
  hintSub: LocalizedText;
  persona: LocalizedText;
  status: LocalizedText;
}
