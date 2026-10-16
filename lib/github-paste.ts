/**
 * Utilities to detect and sanitize content pasted directly from GitHub.
 *
 * Pasting directly from GitHub issues, pull requests, or comments introduces
 * unwanted formatting, hidden HTML comments, tracking metadata, and template artifacts.
 */

const GITHUB_DOM_ATTRIBUTES = [
  "data-hovercard-type",
  "data-hovercard-url",
  "data-octo-click",
  "data-octo-dimensions",
  "data-hydro-click",
  "data-ga-click",
  "data-test-selector",
];

const GITHUB_DOM_CLASSES = [
  "js-comment-body",
  "markdown-body",
  "timeline-comment",
  "comment-body",
  "gh-header",
  "user-mention",
  "snippet-clipboard-content",
  "zeroclipboard-container",
  "contains-task-list",
];

const GITHUB_DOMAINS = [
  "githubassets.com",
  "avatars.githubusercontent.com",
  "github.githubassets.com",
];

/**
 * Returns true if the clipboard payload contains signatures indicating it originated
 * from a GitHub webpage or a GitHub issue/PR template.
 */
export function isGitHubPaste(
  html: string | null | undefined,
  text: string | null | undefined,
): boolean {
  const safeHtml = html ?? "";
  const safeText = text ?? "";

  if (!safeHtml && !safeText) return false;

  // 1. Check for GitHub DOM attributes in HTML
  for (const attr of GITHUB_DOM_ATTRIBUTES) {
    if (safeHtml.includes(attr)) return true;
  }

  // 2. Check for GitHub specific CSS class names in HTML
  for (const cls of GITHUB_DOM_CLASSES) {
    if (safeHtml.includes(cls)) return true;
  }

  // 3. Check for GitHub asset domains in HTML tags
  for (const domain of GITHUB_DOMAINS) {
    if (safeHtml.includes(domain)) return true;
  }

  // 4. Check for GitHub user-attachment tracking URLs
  if (
    safeHtml.includes("user-attachments/assets") ||
    safeText.includes("user-attachments/assets")
  ) {
    return true;
  }

  // 5. Check for GitHub issue / PR template HTML comments in text or HTML
  // E.g. <!-- Please describe the bug -->, <!-- DO NOT EDIT -->
  const htmlCommentRegex = /<!--[\s\S]*?-->/;
  if (htmlCommentRegex.test(safeText) || htmlCommentRegex.test(safeHtml)) {
    // If text contains HTML comments, check if they resemble template comments or if HTML was present
    if (safeHtml.length > 0) return true;
    if (htmlCommentRegex.test(safeText)) return true;
  }

  return false;
}

/** Wrapper tags that leak from GitHub's rendered HTML into copied text. */
const LEAKED_TAG_RE =
  /<\/?(?:div|span|p|g-emoji|table|thead|tbody|tr|td|th)(?=[\s>/])[^>]*>/g;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE_RE = /(`+)[\s\S]*?\1/g;

/** Cleans one stretch of prose (never code): comments, leaked tags, blank lines. */
function cleanProse(text: string): string {
  // Protect inline code spans such as `Promise<P>` or `<div>` while cleaning.
  const spans: string[] = [];
  let cleaned = text.replace(INLINE_CODE_RE, (span) => {
    spans.push(span);
    return `\u0000${spans.length - 1}\u0000`;
  });

  // 1. HTML comments (GitHub issue/PR templates).
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // 2. Exact lowercase wrapper tags GitHub leaks. Case-sensitive, with a tag
  //    boundary, so JSX like <Provider>, <Page> or generics like <P> survive.
  cleaned = cleaned.replace(LEAKED_TAG_RE, "");
  // 3. Collapse runs of blank lines left behind by removed template blocks.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  // 4. Trim trailing spaces on each line.
  cleaned = cleaned
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n");

  return cleaned.replace(/\u0000(\d+)\u0000/g, (_m, i) => spans[Number(i)] ?? "");
}

/**
 * Strips HTML comments and GitHub's leaked wrapper tags, and normalises blank
 * lines, in prose only. Fenced code blocks and inline code are left exactly as
 * written (#114): earlier versions deleted JSX, HTML and generics such as
 * `Promise<P>` from code samples when an issue or comment was saved.
 */
export function stripGitHubMarkup(content: string): string {
  if (!content) return "";

  const lines = content.split("\n");
  const out: string[] = [];
  let prose: string[] = [];
  let i = 0;

  const flushProse = () => {
    if (prose.length > 0) out.push(cleanProse(prose.join("\n")));
    prose = [];
  };

  while (i < lines.length) {
    const open = FENCE_RE.exec(lines[i] ?? "");
    if (!open) {
      prose.push(lines[i] ?? "");
      i += 1;
      continue;
    }
    flushProse();
    const marker = open[1] ?? "```";
    const fence: string[] = [lines[i] ?? ""];
    i += 1;
    while (i < lines.length) {
      const line = lines[i] ?? "";
      fence.push(line);
      i += 1;
      const close = FENCE_RE.exec(line);
      if (close && close[1]?.[0] === marker[0] && (close[1]?.length ?? 0) >= marker.length && line.trim() === close[1]) {
        break;
      }
    }
    out.push(fence.join("\n"));
  }
  flushProse();

  return out.join("\n").trim();
}

export type GitHubPasteResult = {
  sanitizedText: string;
  wasSanitized: boolean;
  message?: string;
};

/**
 * Detects whether pasted content originates from GitHub and sanitizes it into clean text.
 * Returns the sanitized text along with a descriptive notification message when altered.
 */
export function sanitizeGitHubPaste(
  html: string | null | undefined,
  text: string | null | undefined,
): GitHubPasteResult {
  const safeHtml = html ?? "";
  const safeText = text ?? "";

  const fromGitHub = isGitHubPaste(safeHtml, safeText);

  if (!fromGitHub) {
    return {
      sanitizedText: safeText,
      wasSanitized: false,
    };
  }

  // Strip GitHub markup, template comments, and hidden tags
  const rawBase = safeText.length > 0 ? safeText : stripGitHubMarkup(safeHtml);
  const cleaned = stripGitHubMarkup(rawBase);

  if (cleaned.length === 0) {
    return {
      sanitizedText: "",
      wasSanitized: true,
      message:
        "Content pasted from GitHub contained only template comments or tracking markup and was stripped.",
    };
  }

  return {
    sanitizedText: cleaned,
    wasSanitized: true,
    message:
      "GitHub-specific formatting, template comments, and tracking markup were sanitized.",
  };
}
