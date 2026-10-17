/**
 * Minimal RFC 4180 CSV writing.
 *
 * Issue titles and descriptions are free text: they contain commas, quotes
 * and newlines, and a spreadsheet silently misreads any of them if the field
 * is not quoted. So this quotes conservatively rather than cleverly.
 */

/** Windows line ending, which is what RFC 4180 specifies and Excel expects. */
export const CSV_EOL = "\r\n";

/**
 * A leading =, +, - or @ makes a spreadsheet treat the value as a formula.
 * An issue titled "=cmd|..." is a real attack against whoever opens the
 * export, so those are prefixed with a tab, which spreadsheets strip for
 * display but will not evaluate.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "boolean") text = value ? "true" : "false";
  else text = String(value);

  if (FORMULA_START.test(text)) text = `\t${text}`;

  // Quote whenever the value could otherwise break the row, and double any
  // quote inside it, which is how RFC 4180 escapes them.
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",") + CSV_EOL;
}
