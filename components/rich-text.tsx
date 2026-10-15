import type { ReactNode } from "react";
import { looksLikeMarkdown, safeHref } from "@/lib/rich-text";

type RichTextProps = {
  content: string;
  className?: string;
  /** Optional renderer for mention tags `@[Name](userId)` inside text segments. */
  renderMentions?: (text: string) => ReactNode;
};

/**
 * Safely render Markdown (or plain text) without raw HTML injection.
 * Supports bold, italic, underline, inline/fenced code, lists, and links.
 */
export function RichText({ content, className, renderMentions }: RichTextProps) {
  if (!content) return null;

  if (!looksLikeMarkdown(content)) {
    const body = renderMentions ? renderMentions(content) : content;
    return (
      <div className={className ?? "mt-3 whitespace-pre-wrap text-slate-800"}>
        {body}
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "rich-text mt-3 space-y-2 text-slate-800 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      }
    >
      {renderBlocks(content, renderMentions)}
    </div>
  );
}

function renderBlocks(
  source: string,
  renderMentions?: (text: string) => ReactNode,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.startsWith("```")) {
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
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

    if (/^\s*[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*+] /, ""));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${key++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, renderMentions)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\. /, ""));
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${key++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, renderMentions)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^\s*[-*+] /.test(lines[i] ?? "") &&
      !/^\s*\d+\. /.test(lines[i] ?? "") &&
      !(lines[i] ?? "").startsWith("```")
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    nodes.push(
      <p key={`p-${key++}`} className="whitespace-pre-wrap">
        {renderInline(para.join("\n"), renderMentions)}
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
  | { type: "underline"; value: string }
  | { type: "link"; label: string; href: string };

/** Links require http(s) so soft-mentions `@[Name](userId)` stay as text. */
const INLINE_RE =
  /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|<u>[\s\S]*?<\/u>|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*[^*]+\*|_[^_]+_)/g;

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({ type: "text", value: text.slice(last, index) });
    }
    const raw = match[0];
    if (raw.startsWith("`")) {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      tokens.push({ type: "bold", value: raw.slice(2, -2) });
    } else if (raw.startsWith("<u>")) {
      tokens.push({ type: "underline", value: raw.slice(3, -4) });
    } else if (raw.startsWith("[")) {
      const label = match[1] ?? raw;
      const href = match[2] ?? "";
      tokens.push({ type: "link", label, href });
    } else if (
      (raw.startsWith("*") && raw.endsWith("*") && !raw.startsWith("**")) ||
      (raw.startsWith("_") && raw.endsWith("_") && !raw.startsWith("__"))
    ) {
      tokens.push({ type: "italic", value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: "text", value: raw });
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
    if (token.type === "underline") {
      return <u key={index}>{token.value}</u>;
    }
    const href = safeHref(token.href);
    if (!href) {
      return <span key={index}>{token.label}</span>;
    }
    return (
      <a key={index} href={href} target="_blank" rel="noopener noreferrer">
        {token.label}
      </a>
    );
  });
}
