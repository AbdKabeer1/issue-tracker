/**
 * Copy text, falling back where the async clipboard API is missing (#279):
 * it needs a secure context, and older mobile browsers and some embedded
 * webviews do not have it at all. Resolves true only when the text really
 * went to the clipboard, so the caller never claims a copy that failed.
 */
export async function copyText(
  text: string,
  env: { navigator?: Navigator; document?: Document } = globalThis,
): Promise<boolean> {
  try {
    if (env.navigator?.clipboard?.writeText) {
      await env.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied, or not a secure context. Try the old way.
  }

  const doc = env.document;
  if (!doc?.body) return false;

  // A selected, off-screen textarea plus execCommand("copy") still works in
  // the browsers that lack the async API.
  const area = doc.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  doc.body.appendChild(area);
  const active = doc.activeElement as HTMLElement | null;
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    // Selecting the textarea moved focus; give it back.
    active?.focus?.();
  }
}
