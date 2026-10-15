import type { Status } from "@prisma/client";
import { statusLabels } from "@/lib/labels";

const SNIPPET_MAX = 160;

export function snippetText(text: string, max = SNIPPET_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

/** Safe, non-sensitive preview copy for OG/Twitter cards. */
export function bugLinkPreviewDescription(input: {
  status: Status;
  authorName: string;
  description: string;
}): string {
  const status = statusLabels[input.status];
  const snippet = snippetText(input.description, 120);
  return `${status} · reported by ${input.authorName} — ${snippet}`;
}

/**
 * Social / chat unfurl bots that may fetch OG tags without a session.
 * Intentionally excludes search crawlers (Googlebot, bingbot, Applebot, …)
 * so private tickets are not indexed via the preview bypass.
 */
const PREVIEW_BOT_PATTERN =
  /Slackbot|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Slack-ImgProxy|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|redditbot|vkShare|Iframely/i;

export function isLinkPreviewBot(
  userAgent: string | null | undefined,
): boolean {
  if (!userAgent) return false;
  return PREVIEW_BOT_PATTERN.test(userAgent);
}
