import {
  CheckSquareOutlined,
  ClockCircleOutlined,
  ProfileOutlined,
  TableOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type {
  ArtifactLocale,
  DataTableArtifact,
  KeyValueArtifact,
  RecordListArtifact,
  RecordFieldTone,
  StructuredArtifact,
  TimelineArtifact,
  TodoListArtifact,
} from "../model/artifacts";
import { isDefaultStructuredTableTitle } from "../model/artifacts";
import {
  formatArtifactStatus,
  formatArtifactValue,
  formatTimelineTimestamp,
  normalizeArtifactStatus,
} from "../model/artifactFormatting";
import "./StructuredArtifactList.less";

interface StructuredArtifactListProps {
  artifacts: StructuredArtifact[];
  language: ArtifactLocale;
}

function statusClassName(status: string) {
  const normalized = normalizeArtifactStatus(status);
  switch (normalized) {
    case "active":
    case "approved":
    case "completed":
    case "paid":
    case "success":
      return "ai-chatbot__artifact-status-completed";
    case "current":
    case "in progress":
    case "reviewing":
      return "ai-chatbot__artifact-status-current";
    case "blocked":
    case "failed":
    case "rejected":
      return "ai-chatbot__artifact-status-blocked";
    default:
      return "ai-chatbot__artifact-status-pending";
  }
}

function recordFieldToneClassName(tone: RecordFieldTone) {
  switch (tone) {
    case "muted":
      return "ai-chatbot__artifact-record-value-muted";
    case "success":
      return "ai-chatbot__artifact-record-value-success";
    case "warning":
      return "ai-chatbot__artifact-record-value-warning";
    case "danger":
      return "ai-chatbot__artifact-record-value-danger";
    default:
      return "";
  }
}

function ArtifactCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="ai-chatbot__structured-artifact">
      <header className="ai-chatbot__structured-artifact-header">
        <span aria-hidden="true" className="ai-chatbot__structured-artifact-icon">
          {icon}
        </span>
        <div className="ai-chatbot__structured-artifact-heading">
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function TodoListArtifactView({
  artifact,
  language,
}: {
  artifact: TodoListArtifact;
  language: ArtifactLocale;
}) {
  return (
    <ArtifactCard
      description={artifact.description}
      icon={<CheckSquareOutlined />}
      title={artifact.title}
    >
      <ul className="ai-chatbot__artifact-todo-list">
        {artifact.items.map((item) => (
          <li className="ai-chatbot__artifact-todo-item" key={item.id}>
            <div className="ai-chatbot__artifact-todo-main">
              <strong>{item.label}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
            </div>
            <span className={`ai-chatbot__artifact-status ${statusClassName(item.status)}`}>
              {formatArtifactStatus(item.status, language)}
            </span>
          </li>
        ))}
      </ul>
    </ArtifactCard>
  );
}

function DataTableArtifactView({
  artifact,
  language,
}: {
  artifact: DataTableArtifact;
  language: ArtifactLocale;
}) {
  const { t } = useTranslation();
  return (
    <ArtifactCard
      description={artifact.description}
      icon={<TableOutlined />}
      title={
        isDefaultStructuredTableTitle(artifact.title)
          ? t("aiChatBot.chat.structuredTable")
          : artifact.title
      }
    >
      <div className="ai-chatbot__artifact-table-wrap">
        <table className="ai-chatbot__artifact-table">
          <thead>
            <tr>
              {artifact.columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifact.rows.map((row) => (
              <tr key={row.id}>
                {artifact.columns.map((column) => (
                  <td key={`${row.id}:${column.key}`}>
                    {column.format === "status" &&
                    row.cells[column.key] !== undefined &&
                    row.cells[column.key] !== null ? (
                      <span
                        className={`ai-chatbot__artifact-status ${statusClassName(
                          String(row.cells[column.key] ?? ""),
                        )}`}
                      >
                        {formatArtifactValue(
                          row.cells[column.key] ?? null,
                          column.format,
                          language,
                          column.currency,
                        )}
                      </span>
                    ) : (
                      formatArtifactValue(
                        row.cells[column.key] ?? null,
                        column.format,
                        language,
                        column.currency,
                      )
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ArtifactCard>
  );
}

function KeyValueArtifactView({
  artifact,
  language,
}: {
  artifact: KeyValueArtifact;
  language: ArtifactLocale;
}) {
  return (
    <ArtifactCard
      description={artifact.description}
      icon={<ProfileOutlined />}
      title={artifact.title}
    >
      <dl className="ai-chatbot__artifact-key-value-list">
        {artifact.items.map((item) => (
          <div className="ai-chatbot__artifact-key-value-item" key={item.key}>
            <dt>{item.label}</dt>
            <dd>
              {item.format === "status" && item.value !== null ? (
                <span
                  className={`ai-chatbot__artifact-status ${statusClassName(String(item.value).toLowerCase())}`}
                >
                  {formatArtifactValue(item.value, item.format, language, item.currency)}
                </span>
              ) : (
                formatArtifactValue(item.value, item.format, language, item.currency)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </ArtifactCard>
  );
}

function TimelineArtifactView({
  artifact,
  language,
}: {
  artifact: TimelineArtifact;
  language: ArtifactLocale;
}) {
  return (
    <ArtifactCard
      description={artifact.description}
      icon={<ClockCircleOutlined />}
      title={artifact.title}
    >
      <ol className="ai-chatbot__artifact-timeline-list">
        {artifact.items.map((item) => (
          <li className="ai-chatbot__artifact-timeline-item" key={item.id}>
            <span
              aria-hidden="true"
              className={`ai-chatbot__artifact-timeline-marker ${statusClassName(item.status)}`}
            />
            <div className="ai-chatbot__artifact-timeline-body">
              <div className="ai-chatbot__artifact-timeline-top-row">
                <strong>{item.title}</strong>
                <span className={`ai-chatbot__artifact-status ${statusClassName(item.status)}`}>
                  {formatArtifactStatus(item.status, language)}
                </span>
              </div>
              {item.description ? <p>{item.description}</p> : null}
              {item.timestamp ? (
                <time dateTime={item.timestamp}>
                  {formatTimelineTimestamp(item.timestamp, language)}
                </time>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </ArtifactCard>
  );
}

function RecordListArtifactView({
  artifact,
  language,
}: {
  artifact: RecordListArtifact;
  language: ArtifactLocale;
}) {
  return (
    <section className="ai-chatbot__artifact-record-list">
      <header className="ai-chatbot__artifact-record-list-header">
        <h4>{artifact.title}</h4>
        {artifact.description ? <p>{artifact.description}</p> : null}
      </header>
      <div className="ai-chatbot__artifact-record-cards">
        {artifact.items.map((item) => (
          <section className="ai-chatbot__artifact-record-card" key={item.id}>
            <h5>{item.title}</h5>
            <dl>
              {item.fields.map((field) => (
                <div className="ai-chatbot__artifact-record-field" key={field.key}>
                  <dt>{field.label}</dt>
                  <dd className={recordFieldToneClassName(field.tone)}>
                    {formatArtifactValue(
                      field.value,
                      field.format,
                      language,
                      field.currency,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

function StructuredArtifactView({
  artifact,
  language,
}: {
  artifact: StructuredArtifact;
  language: ArtifactLocale;
}) {
  switch (artifact.type) {
    case "ff-ai.todo-list.v1":
      return <TodoListArtifactView artifact={artifact} language={language} />;
    case "ff-ai.data-table.v1":
      return <DataTableArtifactView artifact={artifact} language={language} />;
    case "ff-ai.key-value.v1":
      return <KeyValueArtifactView artifact={artifact} language={language} />;
    case "ff-ai.timeline.v1":
      return <TimelineArtifactView artifact={artifact} language={language} />;
    case "ff-ai.record-list.v1":
      return <RecordListArtifactView artifact={artifact} language={language} />;
    default:
      return null;
  }
}

export function StructuredArtifactList({
  artifacts,
  language,
}: StructuredArtifactListProps) {
  if (!artifacts.length) return null;

  return (
    <div className="ai-chatbot__structured-artifact-grid">
      {artifacts.map((artifact) => (
        <StructuredArtifactView
          artifact={artifact}
          key={`${artifact.type}:${artifact.id}`}
          language={language}
        />
      ))}
    </div>
  );
}
