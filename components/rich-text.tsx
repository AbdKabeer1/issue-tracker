import type { ReactNode } from "react";
import { looksLikeMarkdown, safeHref, stripLegacyMarkup } from "@/lib/rich-text";

type RichTextProps = {
  content: string;
  /** Extra classes appended to the default Markdown styles. */
  className?: string;
  /** Optional renderer for mention tags `@[Name](userId)` inside text segments. */
  renderMentions?: (text: string) => ReactNode;
};

// Inline-code styles are scoped to `:not(pre) > code`; fenced blocks keep the
// dark `pre` palette instead of light-on-light text (#113).
export const DEFAULT_CLASS_NAME =
  "rich-text mt-3 space-y-2 [overflow-wrap:anywhere] break-words text-slate-800 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:break-all [&_:not(pre)>code]:break-all [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-slate-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.9em] [&_del]:text-slate-500 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5";

/**
 * Safely render Markdown (or plain text) without raw HTML injection.
 *
 * Everything is emitted as React elements, so user content is escaped by
 * React itself; the only HTML-ish output is a link/image whose href has been
 * checked by `safeHref` (http/https/mailto only). Tag-like text such as
 * `<Button>` is displayed as typed; only legacy `<u>` underline tags are dropped.
 */
export function RichText({ content, className, renderMentions }: RichTextProps) {
  if (!content) return null;

  const safeContent = stripLegacyMarkup(content);
  const extra = className ? ` ${className}` : "";

  if (!looksLikeMarkdown(safeContent)) {
    const body = renderMentions ? renderMentions(safeContent) : safeContent;
    return (
      <div className={`mt-3 whitespace-pre-wrap [overflow-wrap:anywhere] break-words text-slate-800${extra}`}>{body}</div>
    );
  }

  return (
    <div className={`${DEFAULT_CLASS_NAME}${extra}`}>
      {renderBlocks(safeContent.replace(/\r\n/g, "\n").split("\n"), renderMentions)}
    </div>
  );
}

const LIST_ITEM_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TASK_MARKER_RE = /^\[([ xX])\]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const FENCE_RE = /^```/;
const RULE_RE = /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;

type ListItem = {
  ordered: boolean;
  task: boolean;
  checked: boolean;
  lines: string[];
  children: ListItem[];
};

function indentOf(line: string): number {
  return /^[\t ]*/.exec(line)?.[0].replace(/\t/g, "  ").length ?? 0;
}

/** Group consecutive list lines into a nested item tree. */
function parseList(
  lines: string[],
  start: number,
): { items: ListItem[]; next: number } {
  const items: ListItem[] = [];
  const stack: { indent: number; list: ListItem[] }[] = [];
  let last: ListItem | null = null;
  let i = start;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const match = LIST_ITEM_RE.exec(line);

    if (match) {
      const indent = indentOf(line);
      const marker = match[2] ?? "-";
      const rest = match[3] ?? "";
      const taskMatch = TASK_MARKER_RE.exec(rest);

      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1]?.list.slice(-1)[0];
      const target = parent ? parent.children : items;
      const item: ListItem = {
        ordered: /\d/.test(marker),
        task: Boolean(taskMatch),
        checked: (taskMatch?.[1] ?? " ").toLowerCase() === "x",
        lines: [taskMatch?.[2] ?? rest],
        children: [],
      };
      target.push(item);
      last = item;
      stack.push({ indent, list: target });
      i += 1;
      continue;
    }

    // Lazy continuation line for the previous item.
    if (last && line.trim() !== "" && !isBlockStart(line)) {
      last.lines.push(line.trim());
      i += 1;
      continue;
    }

    break;
  }

  return { items, next: i };
}

function isBlockStart(line: string): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_ITEM_RE.test(line)
  );
}

function renderListItems(items: ListItem[], renderMentions?: (text: string) => ReactNode) {
  if (items.length === 0) return null;
  const ordered = items[0]?.ordered ?? false;
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag>
      {items.map((item, index) => (
        <li key={index} className={item.task ? "list-none" : undefined}>
          {item.task ? (
            <span className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                readOnly
                disabled
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-teal-600"
              />
              <span className="min-w-0">
                {renderInline(item.lines.join(" "), renderMentions)}
              </span>
            </span>
          ) : (
            renderInline(item.lines.join(" "), renderMentions)
          )}
          {renderListItems(item.children, renderMentions)}
        </li>
      ))}
    </ListTag>
  );
}

function renderBlocks(
  lines: string[],
  renderMentions?: (text: string) => ReactNode,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i] ?? "")) {
        fence.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre key={`pre-${key++}`}>
          <code>{fence.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = Math.min(heading[1]?.length ?? 1, 3);
      const HeadingTag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      nodes.push(
        <HeadingTag key={`h-${key++}`}>
          {renderInline(heading[2] ?? "", renderMentions)}
        </HeadingTag>,
      );
      i += 1;
      continue;
    }

    if (RULE_RE.test(line)) {
      nodes.push(<hr key={`hr-${key++}`} className="border-slate-200" />);
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i] ?? "")) {
        quoted.push(QUOTE_RE.exec(lines[i] ?? "")?.[1] ?? "");
        i += 1;
      }
      nodes.push(
        <blockquote
          key={`quote-${key++}`}
          className="border-l-4 border-slate-200 pl-3 text-slate-700"
        >
          {renderBlocks(quoted, renderMentions)}
        </blockquote>,
      );
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const { items, next } = parseList(lines, i);
      const list = renderListItems(items, renderMentions);
      if (list) nodes.push(<div key={`list-${key++}`}>{list}</div>);
      i = next;
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !isBlockStart(lines[i] ?? "")
    ) {
      paragraph.push(lines[i] ?? "");
      i += 1;
    }
    nodes.push(
      <p key={`p-${key++}`} className="whitespace-pre-wrap">
        {renderInline(paragraph.join("\n"), renderMentions)}
      </p>,
    );
  }

  return nodes;
}

type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strikethrough"; value: string }
  | { type: "link"; label: string; href: string }
  | { type: "image"; alt: string; src: string }
  | { type: "autolink"; href: string };

/**
 * Links require an http(s) href so soft-mentions `@[Name](userId)` stay text,
 * and bare URLs are linked automatically.
 */
const INLINE_RE =
  /(!?\[[^\]]*\]\((?:https?:\/\/|mailto:)[^)\s]*\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\s][^*]*\*|(?<![\w])_[^_\s][^_]*_(?![\w])|(?<![\w/.-])(https?:\/\/[^\s<>()]+))/g;

const MARKDOWN_TARGET_RE = /^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/;
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({ type: "text", value: text.slice(last, index) });
    }
    const raw = match[0];

    const target = MARKDOWN_TARGET_RE.exec(raw);
    if (target) {
      if (target[1] === "!") {
        tokens.push({ type: "image", alt: target[2] ?? "", src: target[3] ?? "" });
      } else {
        tokens.push({ type: "link", label: target[2] ?? raw, href: target[3] ?? "" });
      }
    } else if (raw.startsWith("`")) {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      tokens.push({ type: "bold", value: raw.slice(2, -2) });
    } else if (raw.startsWith("~~")) {
      tokens.push({ type: "strikethrough", value: raw.slice(2, -2) });
    } else if (
      (raw.startsWith("*") && raw.endsWith("*")) ||
      (raw.startsWith("_") && raw.endsWith("_"))
    ) {
      tokens.push({ type: "italic", value: raw.slice(1, -1) });
    } else {
      const href = raw.replace(TRAILING_PUNCTUATION_RE, "");
      tokens.push({ type: "autolink", href });
      if (href !== raw) {
        tokens.push({ type: "text", value: raw.slice(href.length) });
      }
    }

    last = index + raw.length;
  }

  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: text }];
}

function renderInline(
  text: string,
  renderMentions?: (text: string) => ReactNode,
): ReactNode[] {
  return tokenizeInline(text).map((token, index) => {
    if (token.type === "text") {
      return (
        <span key={index}>
          {renderMentions ? renderMentions(token.value) : token.value}
        </span>
      );
    }
    if (token.type === "code") {
      return <code key={index}>{token.value}</code>;
    }
    if (token.type === "bold") {
      return <strong key={index}>{token.value}</strong>;
    }
    if (token.type === "italic") {
      return <em key={index}>{token.value}</em>;
    }
    if (token.type === "strikethrough") {
      return <del key={index}>{token.value}</del>;
    }
    if (token.type === "image") {
      const src = safeHref(token.src);
      if (!src) return <span key={index}>{token.alt}</span>;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={src}
          alt={token.alt}
          className="max-w-full rounded-lg border border-slate-200"
        />
      );
    }

    const href = safeHref(token.href);
    const label = token.type === "link" ? token.label : token.href;
    if (!href) return <span key={index}>{label}</span>;
    return (
      <a key={index} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  });
}