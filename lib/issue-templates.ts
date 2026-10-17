/**
 * Issue templates (#307): an admin-written starting point for the
 * description, one per issue type.
 *
 * The rules that matter live here so the form and the tests agree:
 * - an empty template means the field stays empty, as before;
 * - text the reporter typed is never replaced without asking;
 * - an untouched template is not the reporter's text, so switching type
 *   swaps it for the new type's template (or clears it) silently.
 */

/** Same ceiling as the description itself, so any template is submittable. */
export const TEMPLATE_MAX = 5000;

export const DEFAULT_BUG_TEMPLATE = `### Steps to reproduce
1.
2.
3.

### Expected

### Actual

### Environment
- Browser / app version:
- Device and OS:
`;

/** The type that gets {@link DEFAULT_BUG_TEMPLATE} on a fresh install. */
export const DEFAULT_TEMPLATE_TYPE = "Fix";

/** Comparison form: line endings and trailing space don't make text "typed". */
function canonical(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Stored form of a template: null when there is nothing in it. */
export function normalizeTemplate(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (!text.trim()) return null;
  return `${text}\n`;
}

/** True when `description` is just `template` with nothing filled in. */
export function isUntouchedTemplate(
  description: string | null | undefined,
  template: string | null | undefined,
): boolean {
  const t = canonical(template);
  return t.length > 0 && canonical(description) === t;
}

export type TemplateSwitch =
  /** Set the description to `text` without asking. */
  | { kind: "replace"; text: string }
  /** The reporter has written something; ask before putting `text` in. */
  | { kind: "confirm"; text: string }
  /** Leave the description alone. */
  | { kind: "keep" };

/**
 * What to do with the description when the type changes from one with
 * `fromTemplate` to one with `toTemplate`.
 */
export function templateSwitch(
  description: string,
  fromTemplate: string | null | undefined,
  toTemplate: string | null | undefined,
): TemplateSwitch {
  const next = normalizeTemplate(toTemplate);
  const blank = canonical(description).length === 0;
  const untouched = blank || isUntouchedTemplate(description, fromTemplate);

  if (untouched) {
    const text = next ?? "";
    return text === description ? { kind: "keep" } : { kind: "replace", text };
  }
  if (!next || canonical(next) === canonical(description)) return { kind: "keep" };
  return { kind: "confirm", text: next };
}

/**
 * The description to start the form with: the default type's template,
 * when it has one.
 */
export function initialDescription(template: string | null | undefined): string {
  return normalizeTemplate(template) ?? "";
}

export const UNFILLED_TEMPLATE_MESSAGE =
  "Fill in the template before submitting: it still has only the headings.";
