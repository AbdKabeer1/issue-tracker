/**
 * Unsent comment text, kept per issue (and per reply) so navigating away,
 * reloading or closing the tab does not throw away what someone had typed.
 *
 * Storage is per-browser and per-viewer: nothing here reaches the server or
 * another device, and every access is wrapped because private-mode and
 * blocked-site-data both make these throw rather than return nothing.
 */

const PREFIX = "comment-draft";

/** Drafts older than this are dropped on read rather than kept forever. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredDraft = { body: string; savedAt: number };

export function draftKey(bugId: string, parentId?: string): string {
  return `${PREFIX}:${bugId}:${parentId ?? "root"}`;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The saved draft, or "" when there is none, it is stale, or it is unreadable. */
export function readDraft(store: Store, key: string, now = Date.now()): string {
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return "";
  }
  if (!raw) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Someone else's key, or a half-written value.
    clearDraft(store, key);
    return "";
  }

  const draft = parsed as Partial<StoredDraft>;
  if (typeof draft?.body !== "string" || typeof draft?.savedAt !== "number") {
    clearDraft(store, key);
    return "";
  }
  if (now - draft.savedAt > DRAFT_TTL_MS) {
    clearDraft(store, key);
    return "";
  }
  return draft.body;
}

/** Saves a draft, or removes it when the field has been emptied. */
export function writeDraft(
  store: Store,
  key: string,
  body: string,
  now = Date.now(),
): void {
  if (!body.trim()) {
    clearDraft(store, key);
    return;
  }
  try {
    store.setItem(key, JSON.stringify({ body, savedAt: now } satisfies StoredDraft));
  } catch {
    // Storage full or unavailable. The comment still posts; only the draft
    // is lost, which is no worse than before drafts existed.
  }
}

export function clearDraft(store: Store, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // As above.
  }
}
