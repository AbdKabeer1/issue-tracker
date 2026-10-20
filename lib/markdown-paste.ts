/**
 * Paste handling for the Markdown editor (see "prevent pasting from GitHub").
 *
 * Pasting from GitHub, Google Docs or any rich-text source hands the browser an
 * HTML flavour plus a plain-text flavour. The plain text of a GitHub list is
 * tab-indented and full of alignment padding, so when the HTML carries real
 * formatting we convert it to Markdown instead of taking the text.
 */

import { safeHref } from "./rich-text";

type ElementNode = {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
};

type Node = { type: "text"; value: string } | ElementNode;

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

const FORMATTING_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "li",
  "ol",
  "pre",
  "s",
  "strike",
  "strong",
  "u",
  "ul",
  "img",
  "table",
  "tr",
  "td",
  "th",
]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

function isValidCodePoint(code: number): boolean {
  // Reject non-finite, out of range, and UTF-16 surrogate halves (0xD800 - 0xDFFF)
  return Number.isFinite(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g)) {
    attrs[match[1].toLowerCase()] = decodeEntities((match[2] ?? "").replace(/^["']|["']$/g, ""));
  }
  return attrs;
}

/** Tolerant HTML tokenizer -> tree. Unclosed tags are auto-closed. */
export function parseHtml(html: string): Node[] {
  // GitHub copies comments (`<!-- highlightSource: … -->`) that are pure noise.
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  const root: Node = { type: "element", tag: "#root", attrs: {}, children: [] };
  const stack: Node[] = [root];
  let cursor = 0;

  const push = (node: Node) => {
    const parent = stack[stack.length - 1];
    if (parent.type === "element") parent.children.push(node);
  };

  while (cursor < source.length) {
    const next = source.indexOf("<", cursor);
    if (next === -1) {
      const text = source.slice(cursor);
      if (text) push({ type: "text", value: decodeEntities(text) });
      break;
    }
    if (next > cursor) {
      push({ type: "text", value: decodeEntities(source.slice(cursor, next)) });
    }

    const close = source.indexOf(">", next);
    if (close === -1) {
      push({ type: "text", value: decodeEntities(source.slice(next)) });
      break;
    }

    const rawTag = source.slice(next + 1, close).trim();
    cursor = close + 1;

    if (rawTag.startsWith("!")) continue;
    if (rawTag.startsWith("?")) continue;

    if (rawTag.startsWith("/")) {
      const tag = rawTag.slice(1).trim().toLowerCase();
      const index = [...stack].reverse().findIndex((node) => node.type === "element" && node.tag === tag);
      if (index >= 0) stack.splice(stack.length - 1 - index, 1);
      continue;
    }

    const selfClosing = rawTag.endsWith("/");
    const name = rawTag.replace(/\/$/, "").split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) continue;

    // Implicit closes for the tags we care about.
    for (const [tag, closes] of [
      ["li", ["li"]],
      ["p", ["p"]],
      ["td", ["td", "th"]],
      ["th", ["td", "th"]],
      ["tr", ["tr"]],
      ["option", ["option"]],
    ] as const) {
      if (name !== tag) continue;
      const top = stack[stack.length - 1];
      if (top.type === "element" && closes.includes(top.tag as never)) stack.pop();
    }

    const node: Node = { type: "element", tag: name, attrs: parseAttrs(rawTag), children: [] };
    push(node);
    if (!selfClosing && !VOID_TAGS.has(name)) stack.push(node);
  }

  return root.type === "element" ? root.children : [];
}

type Block = { lines: string[] };

const LIST_INDENT = "  ";

function normalizeText(text: string, inPre: boolean): string {
  if (inPre) return text.replace(/\r\n/g, "\n");
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, " ");
}

function inlineText(nodes: Node[], inPre = false): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return normalizeText(node.value, inPre);
      if (node.tag === "br") return "\n";
      if (node.tag === "img") {
        const alt = node.attrs.alt ?? "";
        const src = safeHref(node.attrs.src ?? "");
        return src ? `![${alt}](${src})` : alt;
      }
      if (node.tag === "code" && inPre) return inlineText(node.children, true);

      const inner = inlineText(node.children, inPre);
      switch (node.tag) {
        case "b":
        case "strong":
          return inner.trim() ? `**${inner.trim()}**` : "";
        case "i":
        case "em":
          return inner.trim() ? `*${inner.trim()}*` : "";
        case "s":
        case "strike":
        case "del":
          return inner.trim() ? `~~${inner.trim()}~~` : "";
        case "code":
          return inner.trim() ? `\`${inner.trim()}\`` : "";
        case "a": {
          const href = safeHref(node.attrs.href ?? "");
          if (!href) return inner;
          return inner.trim() ? `[${inner.trim()}](${href})` : href;
        }
        default:
          return inner;
      }
    })
    .join("");
}

function isTaskItem(node: Node): { checked: boolean; children: Node[] } | null {
  if (node.type !== "element" || node.tag !== "li") return null;
  const checkbox = node.children.find(
    (child) =>
      child.type === "element" &&
      child.tag === "input" &&
      (child.attrs.type === "checkbox" || child.attrs.type === undefined),
  ) as Extract<Node, { type: "element" }> | undefined;
  if (!checkbox) return null;
  return {
    checked: "checked" in checkbox.attrs,
    children: node.children.filter((child) => child !== checkbox),
  };
}

function listMarker(node: Node, index: number, task: { checked: boolean } | null): string {
  if (task) return `- [${task.checked ? "x" : " "}] `;
  if (node.type === "element" && node.tag === "ol") {
    const start = Number.parseInt(node.attrs.start ?? "", 10);
    return `${Number.isFinite(start) ? start + index : index + 1}. `;
  }
  return "- ";
}

function renderBlocks(nodes: Node[], depth = 0, inPre = false): Block {
  const lines: string[] = [];
  let paragraph: Node[] = [];

  const flushParagraph = () => {
    const text = inlineText(paragraph).trim();
    if (text) lines.push(text);
    paragraph = [];
  };

  nodes.forEach((node) => {
    if (node.type === "text") {
      if (inPre) {
        lines.push(node.value.replace(/\n$/, ""));
        return;
      }
      const text = normalizeText(node.value, false);
      if (text.trim()) paragraph.push({ type: "text", value: text });
      else flushParagraph();
      return;
    }

    if (node.tag === "br" && inPre) {
      lines.push("");
      return;
    }

    switch (node.tag) {
      case "script":
      case "style":
      case "noscript":
      case "template":
        return;

      case "pre": {
        flushParagraph();
        const code = node.children.find(
          (child): child is ElementNode =>
            child.type === "element" && child.tag === "code",
        );
        const source: ElementNode = code ?? node;
        const content = inlineText(source.children, true).replace(/\s+$/, "");
        const fenced = content.includes("```") ? "~~~" : "```";
        lines.push(fenced, content, fenced);
        return;
      }

      case "hr": {
        flushParagraph();
        lines.push("---");
        return;
      }

      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        flushParagraph();
        const level = Number.parseInt(node.tag.slice(1), 10);
        const text = inlineText(node.children).trim();
        if (text) lines.push(`${"#".repeat(level)} ${text}`);
        return;
      }

      case "blockquote": {
        flushParagraph();
        const inner = renderBlocks(node.children, depth).lines.join("\n");
        if (inner.trim()) {
          lines.push(inner.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n"));
        }
        return;
      }

      case "ul":
      case "ol": {
        flushParagraph();
        const items = node.children.filter(
          (child) => child.type === "element" && child.tag === "li",
        );
        items.forEach((item, itemIndex) => {
          const task = isTaskItem(item as Extract<Node, { type: "element" }>);
          const children = task ? task.children : (item as Extract<Node, { type: "element" }>).children;
          const marker = listMarker(node, itemIndex, task);
          const nested = children.filter(
            (child) => child.type === "element" && (child.tag === "ul" || child.tag === "ol"),
          );
          const own = children.filter((child) => !nested.includes(child));
          const text = inlineText(own).trim();
          const itemLines = renderBlocks(nested, depth + 1).lines;
          lines.push(`${LIST_INDENT.repeat(depth)}${marker}${text}`.trimEnd());
          lines.push(...itemLines);
        });
        return;
      }

      default: {
        if (BLOCK_TAGS.has(node.tag)) {
          flushParagraph();
          lines.push(...renderBlocks(node.children, depth).lines);
          return;
        }
        paragraph.push(node);
      }
    }
  });

  flushParagraph();
  return { lines };
}

function cleanup(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();
}

/** True when the HTML carries formatting worth converting. */
export function hasRichFormatting(html: string): boolean {
  for (const match of html.matchAll(/<\s*([a-z0-9]+)/gi)) {
    if (FORMATTING_TAGS.has(match[1].toLowerCase())) return true;
  }
  return false;
}

/** Convert an HTML fragment to GitHub-flavoured Markdown. */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const nodes = parseHtml(html);
  return cleanup(renderBlocks(nodes).lines.join("\n"));
}

/**
 * Choose what to insert for a paste: Markdown derived from the HTML when the
 * source was rich text, otherwise the plain text exactly as copied.
 */
export function pasteToMarkdown({
  text,
  html,
}: {
  text: string;
  html: string;
}): string {
  if (html.trim() && hasRichFormatting(html)) {
    try {
      const markdown = htmlToMarkdown(html);
      if (markdown) return markdown;
    } catch {
      // Keep the plain clipboard flavor available if rich conversion fails.
    }
  }
  return text.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
}
