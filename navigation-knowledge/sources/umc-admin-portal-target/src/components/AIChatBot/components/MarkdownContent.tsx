import { Fragment, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { createPermissionPathSet, normalizeRoutePath } from "@/routes/access";
import { useUserStore } from "@/store/user";
import { history } from "@/utils/history";

import { getAppConfig } from "@/config/appConfig";
import "./MarkdownContent.less";
import { normalizeMarkdownHref } from "../model/urlPolicy";
import { renderBidiText } from "./BidiText";

interface MarkdownContentProps {
  content: string;
  trailing?: ReactNode;
}

type TextAlignment = "start" | "center" | "end";

interface MarkdownListItem {
  checked?: boolean;
  text: string;
}

type MarkdownBlock =
  | { kind: "code"; code: string; language: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: MarkdownListItem[]; ordered: boolean; start?: number }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "rule" }
  | { kind: "table"; alignments: TextAlignment[]; header: string[]; rows: string[][] };

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})\s*([\w#+.-]*)\s*$/;
const HEADING_PATTERN = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const LIST_PATTERN = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/;
const QUOTE_PATTERN = /^\s{0,3}>\s?(.*)$/;
const RULE_PATTERN = /^\s{0,3}(?:(?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/;

function SafeMarkdownLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const permissions = useUserStore((state) => state.userInfo.listSysPermission);
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const internal = Boolean(href?.startsWith("/"));
  const allowed = !internal || createPermissionPathSet(permissions || []).has(normalizeRoutePath(href));
  if (!allowed) return <span>{children}</span>;
  return <>
    <a {...props} href={href} onClick={internal ? (event) => {
      event.preventDefault();
      const current = useUserStore.getState().userInfo.listSysPermission || [];
      if (!createPermissionPathSet(current).has(normalizeRoutePath(href))) {
        setFailed(true);
        return;
      }
      try {
        history.push(href as string);
      } catch {
        setFailed(true);
      }
    } : undefined}>{children}</a>
    {failed ? <span role="alert">{t("response.error.403")}</span> : null}
  </>;
}

function portalLinkLabel(href: string) {
  const pathname = href.split(/[?#]/, 1)[0];
  const segments = pathname.split("/").filter(Boolean);
  const label = segments
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase());
      } catch {
        return segment;
      }
    })
    .join(" / ");
  return label || "Portal page";
}

function splitTableRow(row: string) {
  let value = row.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (escaped) current += "\\";
  cells.push(current.trim());
  return cells;
}

function hasEnclosingTablePipes(line: string) {
  const value = line.trim();
  if (!value.startsWith("|") || !value.endsWith("|") || value.length < 2) return false;
  let escapes = 0;
  for (let index = value.length - 2; index >= 0 && value[index] === "\\"; index -= 1) escapes += 1;
  return escapes % 2 === 0;
}

function getTableAlignments(line: string): TextAlignment[] | null {
  if (!line.includes("|")) return null;
  const cells = splitTableRow(line);
  if (cells.length < 1 || cells.some((cell) => !/^:?-{3,}:?$/.test(cell))) return null;
  // A single column needs explicit enclosing pipes, not an ordinary rule.
  if (cells.length === 1 && !hasEnclosingTablePipes(line)) return null;

  return cells.map((cell) => {
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    if (cell.endsWith(":")) return "end";
    return "start";
  });
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index] ?? "";
  const alignments = getTableAlignments(lines[index + 1] ?? "");
  const headerWidth = splitTableRow(header).length;
  return header.includes("|") && alignments !== null &&
    ((alignments.length > 1 && headerWidth > 1) ||
      (alignments.length === 1 && headerWidth === 1 && hasEnclosingTablePipes(header)));
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? "";
  return (
    !line.trim() ||
    FENCE_PATTERN.test(line) ||
    HEADING_PATTERN.test(line) ||
    LIST_PATTERN.test(line) ||
    QUOTE_PATTERN.test(line) ||
    RULE_PATTERN.test(line) ||
    isTableStart(lines, index)
  );
}

function parseBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE_PATTERN);
    if (fence) {
      const marker = fence[1];
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", code: codeLines.join("\n"), language: fence[2] ?? "" });
      continue;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (RULE_PATTERN.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitTableRow(line);
      const alignments = getTableAlignments(lines[index + 1]) ?? header.map(() => "start" as const);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        const cells = splitTableRow(lines[index]);
        // Keep a malformed wider row as prose instead of silently losing cells.
        if (header.length === 1 && cells.length !== 1) break;
        rows.push(header.map((_, cellIndex) => cells[cellIndex] ?? ""));
        index += 1;
      }

      blocks.push({ kind: "table", alignments, header, rows });
      continue;
    }

    const quote = line.match(QUOTE_PATTERN);
    if (quote) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const currentQuote = lines[index].match(QUOTE_PATTERN);
        if (!currentQuote) break;
        quoteLines.push(currentQuote[1]);
        index += 1;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    const firstListItem = line.match(LIST_PATTERN);
    if (firstListItem) {
      const ordered = /^\d/.test(firstListItem[2]);
      const start = ordered ? Number.parseInt(firstListItem[2], 10) : undefined;
      const items: MarkdownListItem[] = [];

      while (index < lines.length) {
        const listItem = lines[index].match(LIST_PATTERN);
        if (!listItem || /^\d/.test(listItem[2]) !== ordered) break;

        const task = listItem[3].match(/^\[([ xX])\]\s+(.+)$/);
        items.push({
          checked: task ? task[1].toLowerCase() === "x" : undefined,
          text: task ? task[2] : listItem[3],
        });
        index += 1;
      }

      blocks.push({ kind: "list", items, ordered, start });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function findBareLinkEnd(value: string, start: number) {
  let end = start;
  while (end < value.length && !/[\s<>"']/.test(value[end])) end += 1;

  while (end > start && /[.,!?;:]$/.test(value.slice(start, end))) end -= 1;
  if (value[end - 1] === ")") {
    const candidate = value.slice(start, end);
    const openingCount = (candidate.match(/\(/g) ?? []).length;
    const closingCount = (candidate.match(/\)/g) ?? []).length;
    if (closingCount > openingCount) end -= 1;
  }
  return end;
}

function renderInline(
  value: string,
  keyPrefix: string,
  allowedHosts: readonly string[],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let index = 0;

  const flushBuffer = () => {
    if (!buffer) return;
    nodes.push(...renderBidiText(buffer, `${keyPrefix}-${nodes.length}`));
    buffer = "";
  };

  const pushElement = (node: ReactNode) => {
    flushBuffer();
    nodes.push(node);
  };

  while (index < value.length) {
    const character = value[index];

    if (character === "\\" && index + 1 < value.length && /[\\`*_[\]()~|]/.test(value[index + 1])) {
      buffer += value[index + 1];
      index += 2;
      continue;
    }

    if (character === "`") {
      let markerLength = 1;
      while (value[index + markerLength] === "`") markerLength += 1;
      const marker = "`".repeat(markerLength);
      const closingIndex = value.indexOf(marker, index + markerLength);
      if (closingIndex !== -1) {
        const code = value.slice(index + markerLength, closingIndex).replace(/\s+/g, " ").trim();
        pushElement(
          <code dir="ltr" key={`${keyPrefix}-code-${index}`}>
            {renderBidiText(code, `${keyPrefix}-code-${index}`)}
          </code>,
        );
        index = closingIndex + markerLength;
        continue;
      }
    }

    const validLinkBoundary = index === 0 || /[\s([<{]/.test(value[index - 1]);
    const startsPortalPath = character === "/" && !value.startsWith("//", index);
    if (startsPortalPath && validLinkBoundary) {
      const end = findBareLinkEnd(value, index);
      const href = normalizeMarkdownHref(value.slice(index, end), allowedHosts);
      if (href?.startsWith("/") && href !== "/") {
        pushElement(
          <SafeMarkdownLink href={href} key={`${keyPrefix}-portal-link-${index}`}>
            {portalLinkLabel(href)}
          </SafeMarkdownLink>,
        );
        index = end;
        continue;
      }
    }

    if (character === "[") {
      const labelEnd = value.indexOf("](", index + 1);
      const hrefEnd = labelEnd === -1 ? -1 : value.indexOf(")", labelEnd + 2);
      if (labelEnd !== -1 && hrefEnd !== -1) {
        const label = value.slice(index + 1, labelEnd);
        const href = normalizeMarkdownHref(value.slice(labelEnd + 2, hrefEnd), allowedHosts);
        if (href) {
          const external = /^https?:\/\//i.test(href);
          pushElement(
            <SafeMarkdownLink
              href={href}
              key={`${keyPrefix}-link-${index}`}
              rel={external ? "nofollow noopener noreferrer" : undefined}
              target={external ? "_blank" : undefined}
            >
              {renderInline(label, `${keyPrefix}-link-label-${index}`, allowedHosts)}
            </SafeMarkdownLink>,
          );
          index = hrefEnd + 1;
          continue;
        }
        buffer += label;
        index = hrefEnd + 1;
        continue;
      }
    }

    const pairedMarker = value.startsWith("**", index)
      ? "**"
      : value.startsWith("__", index)
        ? "__"
        : value.startsWith("~~", index)
          ? "~~"
          : null;
    if (pairedMarker) {
      const closingIndex = value.indexOf(pairedMarker, index + 2);
      if (closingIndex > index + 2) {
        const inner = renderInline(
          value.slice(index + 2, closingIndex),
          `${keyPrefix}-paired-${index}`,
          allowedHosts,
        );
        pushElement(
          pairedMarker === "~~" ? (
            <del key={`${keyPrefix}-del-${index}`}>{inner}</del>
          ) : (
            <strong key={`${keyPrefix}-strong-${index}`}>{inner}</strong>
          ),
        );
        index = closingIndex + 2;
        continue;
      }
    }

    if ((character === "*" || character === "_") && value[index + 1] !== character) {
      const previous = value[index - 1] ?? "";
      const next = value[index + 1] ?? "";
      const insideWord = character === "_" && /\w/.test(previous) && /\w/.test(next);
      const closingIndex = insideWord ? -1 : value.indexOf(character, index + 1);
      if (closingIndex > index + 1) {
        pushElement(
          <em key={`${keyPrefix}-em-${index}`}>
            {renderInline(
              value.slice(index + 1, closingIndex),
              `${keyPrefix}-em-text-${index}`,
              allowedHosts,
            )}
          </em>,
        );
        index = closingIndex + 1;
        continue;
      }
    }

    if (character === "<") {
      const closingIndex = value.indexOf(">", index + 1);
      const href =
        closingIndex === -1
          ? null
          : normalizeMarkdownHref(value.slice(index + 1, closingIndex), allowedHosts);
      if (href && closingIndex !== -1) {
        const external = /^https?:\/\//i.test(href);
        pushElement(
          <SafeMarkdownLink
            href={href}
            key={`${keyPrefix}-autolink-${index}`}
            rel={external ? "nofollow noopener noreferrer" : undefined}
            target={external ? "_blank" : undefined}
          >
            {href}
          </SafeMarkdownLink>,
        );
        index = closingIndex + 1;
        continue;
      }
      if (closingIndex !== -1) {
        buffer += value.slice(index + 1, closingIndex);
        index = closingIndex + 1;
        continue;
      }
    }

    const startsBareUrl = value.startsWith("http://", index) || value.startsWith("https://", index);
    if (startsBareUrl && validLinkBoundary) {
      const end = findBareLinkEnd(value, index);
      const rawHref = value.slice(index, end);
      const href = normalizeMarkdownHref(rawHref, allowedHosts);
      if (href) {
        const external = /^https?:\/\//i.test(href);
        pushElement(
          <SafeMarkdownLink
            href={href}
            key={`${keyPrefix}-bare-link-${index}`}
            rel={external ? "nofollow noopener noreferrer" : undefined}
            target={external ? "_blank" : undefined}
          >
            {external ? rawHref : portalLinkLabel(href)}
          </SafeMarkdownLink>,
        );
      } else {
        buffer += rawHref;
      }
      index = end;
      continue;
    }

    buffer += character;
    index += 1;
  }

  flushBuffer();
  return nodes;
}

function renderLines(
  lines: string[],
  keyPrefix: string,
  allowedHosts: readonly string[],
  trailing?: ReactNode,
  preserveSoftBreaks = false,
) {
  const nodes: ReactNode[] = [];
  lines.forEach((line, index) => {
    const hardBreak = /\s{2}$/.test(line);
    nodes.push(
      ...renderInline(
        hardBreak ? line.trimEnd() : line.trim(),
        `${keyPrefix}-${index}`,
        allowedHosts,
      ),
    );
    if (index < lines.length - 1) {
      nodes.push(hardBreak || preserveSoftBreaks ? <br key={`${keyPrefix}-br-${index}`} /> : " ");
    }
  });
  if (trailing) nodes.push(trailing);
  return nodes;
}

function alignmentClass(alignment: TextAlignment) {
  if (alignment === "center") return "ai-chatbot__markdown-align-center";
  if (alignment === "end") return "ai-chatbot__markdown-align-end";
  return "ai-chatbot__markdown-align-start";
}

function renderHeading(level: number, children: ReactNode, key: string) {
  if (level === 1) return <h1 key={key}>{children}</h1>;
  if (level === 2) return <h2 key={key}>{children}</h2>;
  if (level === 3) return <h3 key={key}>{children}</h3>;
  if (level === 4) return <h4 key={key}>{children}</h4>;
  if (level === 5) return <h5 key={key}>{children}</h5>;
  return <h6 key={key}>{children}</h6>;
}

function renderBlock(
  block: MarkdownBlock,
  index: number,
  isLast: boolean,
  allowedHosts: readonly string[],
  trailing?: ReactNode,
) {
  const key = `markdown-block-${index}`;
  const blockTrailing = isLast ? trailing : undefined;

  if (block.kind === "paragraph") {
    return <p key={key}>{renderLines(block.lines, key, allowedHosts, blockTrailing, true)}</p>;
  }

  if (block.kind === "heading") {
    return renderHeading(
      block.level,
      <>
        {renderInline(block.text, key, allowedHosts)}
        {blockTrailing}
      </>,
      key,
    );
  }

  if (block.kind === "quote") {
    return (
      <blockquote key={key}>
        <p>{renderLines(block.lines, key, allowedHosts, blockTrailing)}</p>
      </blockquote>
    );
  }

  if (block.kind === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List key={key} start={block.ordered ? block.start : undefined}>
        {block.items.map((item, itemIndex) => (
          <li className={item.checked !== undefined ? "ai-chatbot__markdown-task-item" : undefined} key={`${key}-${itemIndex}`}>
            {item.checked !== undefined ? (
              <input aria-hidden="true" checked={item.checked} readOnly tabIndex={-1} type="checkbox" />
            ) : null}
            <span>
              {renderInline(item.text, `${key}-item-${itemIndex}`, allowedHosts)}
              {isLast && itemIndex === block.items.length - 1 ? blockTrailing : null}
            </span>
          </li>
        ))}
      </List>
    );
  }

  if (block.kind === "code") {
    return (
      <div className="ai-chatbot__markdown-code-block" key={key}>
        {block.language ? <div className="ai-chatbot__markdown-code-language">{block.language}</div> : null}
        <pre dir="ltr"><code>{block.code}</code></pre>
        {blockTrailing}
      </div>
    );
  }

  if (block.kind === "table") {
    return (
      <Fragment key={key}>
        <div className="ai-chatbot__markdown-table-wrap">
          <table>
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th className={alignmentClass(block.alignments[cellIndex] ?? "start")} key={`${key}-header-${cellIndex}`}>
                    {renderInline(cell, `${key}-header-text-${cellIndex}`, allowedHosts)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td className={alignmentClass(block.alignments[cellIndex] ?? "start")} key={`${key}-cell-${rowIndex}-${cellIndex}`}>
                      {renderInline(cell, `${key}-cell-text-${rowIndex}-${cellIndex}`, allowedHosts)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blockTrailing}
      </Fragment>
    );
  }

  return (
    <Fragment key={key}>
      <hr />
      {blockTrailing}
    </Fragment>
  );
}

function isInformationSectionStart(blocks: MarkdownBlock[], index: number) {
  const heading = blocks[index];
  const list = blocks[index + 1];
  return (
    heading?.kind === "heading" &&
    heading.level >= 2 &&
    heading.level <= 3 &&
    list?.kind === "list" &&
    !list.ordered
  );
}

function renderBlocks(
  blocks: MarkdownBlock[],
  allowedHosts: readonly string[],
  trailing?: ReactNode,
) {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    if (isInformationSectionStart(blocks, index)) {
      const listIndex = index + 1;
      nodes.push(
        <section className="ai-chatbot__markdown-information-section" key={`markdown-information-section-${index}`}>
          {renderBlock(blocks[index], index, false, allowedHosts)}
          {renderBlock(
            blocks[listIndex],
            listIndex,
            listIndex === blocks.length - 1,
            allowedHosts,
            trailing,
          )}
        </section>,
      );
      index += 2;
      continue;
    }

    nodes.push(renderBlock(blocks[index], index, index === blocks.length - 1, allowedHosts, trailing));
    index += 1;
  }

  return nodes;
}

export function MarkdownContent({ content, trailing }: MarkdownContentProps) {
  const blocks = parseBlocks(content);
  const allowedHosts = getAppConfig().ffAi.cardAllowedExternalHosts;
  return (
    <div className="ai-chatbot__markdown-content">
      {renderBlocks(blocks, allowedHosts, trailing)}
    </div>
  );
}
