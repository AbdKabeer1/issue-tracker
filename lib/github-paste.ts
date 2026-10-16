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

/**
 * Strips HTML comments, GitHub-specific tracking wrappers, and normalizes excess whitespace.
 */
export function stripGitHubMarkup(content: string): string {
  if (!content) return "";

  // 1. Strip HTML comments (commonly present in GitHub issue/PR templates)
  let cleaned = content.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Strip residual GitHub clipboard markup/tags if HTML leaked into plain text
  cleaned = cleaned.replace(/<(?:\/)?(?:div|span|p|g-emoji|table|tbody|tr|td)[^>]*>/gi, "");

  // 3. Normalize excess consecutive blank lines (from stripped template comment blocks)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 4. Trim leading/trailing blank space around lines while preserving deliberate indentation
  const lines = cleaned.split("\n").map((line) => line.replace(/\s+$/, ""));
  cleaned = lines.join("\n").trim();

  return cleaned;
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
