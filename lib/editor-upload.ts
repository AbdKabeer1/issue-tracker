/**
 * Paste and drop into the Markdown editor (#305): the text side of it.
 * The editor uploads each file to /api/uploads, and these helpers decide
 * what Markdown goes where.
 *
 * While a file uploads, a placeholder sits at the caret:
 *   ![Uploading screenshot.png…](#upload-k3x9)
 * On success it becomes `![screenshot.png](/api/attachments/<id>)` (or a
 * plain link for a non-image). On failure it is removed, so a failed
 * upload never leaves broken Markdown behind.
 */

export const MAX_FILES_PER_DROP = 5;

/** The path an uploaded attachment is served from. */
export function attachmentPath(id: string): string {
  return `/api/attachments/${id}`;
}

/** Brackets and backslashes would end the alt text or link label early. */
export function escapeLabel(name: string): string {
  const clean = name.replace(/[\r\n]+/g, " ").trim() || "file";
  return clean.replace(/[\\[\]]/g, (c) => `\\${c}`);
}

export function placeholderFor(token: string, name: string): string {
  return `![Uploading ${escapeLabel(name)}…](#upload-${token})`;
}

export function markdownFor(file: { filename: string; contentType: string }, id: string): string {
  const label = escapeLabel(file.filename);
  return file.contentType.startsWith("image/")
    ? `![${label}](${attachmentPath(id)})`
    : `[${label}](${attachmentPath(id)})`;
}

/**
 * Replaces the placeholder for `token` (wherever the text around it has
 * moved to), or returns null when the person deleted it meanwhile.
 */
export function replacePlaceholder(text: string, token: string, replacement: string): string | null {
  const marker = `](#upload-${token})`;
  const end = text.indexOf(marker);
  if (end === -1) return null;
  const start = text.lastIndexOf("![Uploading ", end);
  if (start === -1) return null;
  return text.slice(0, start) + replacement + text.slice(end + marker.length);
}

/** Files carried by a paste or drop, ignoring plain text and HTML. */
export function filesFrom(data: { files?: FileList | File[] | null } | null | undefined): File[] {
  if (!data?.files) return [];
  return Array.from(data.files as ArrayLike<File>).slice(0, MAX_FILES_PER_DROP);
}

/** True while something with files is dragged over the editor. */
export function isFileDrag(types: readonly string[] | DOMStringList | null | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

/** Pasted screenshots arrive as "image.png"; give them a findable name. */
export function nameForPasted(file: { name: string; type: string }, now = new Date()): string {
  if (file.name && file.name !== "image.png") return file.name;
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `screenshot-${stamp}.${ext}`;
}
