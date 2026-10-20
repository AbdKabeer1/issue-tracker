/**
 * Password handling around bcrypt's 72-byte input limit (#735).
 *
 * bcrypt silently ignores everything past the first 72 bytes, so two
 * passwords that share a long prefix authenticate identically. New
 * passwords are capped at 72 bytes in the validation schemas; this module
 * also gives sign-in an explicit canonical form for accounts created
 * before the cap existed.
 */

export const BCRYPT_MAX_PASSWORD_BYTES = 72;

/**
 * The first 72 UTF-8 bytes of `password`, cut on a character boundary.
 * Windows-1252-style byte cuts would corrupt multibyte characters; the
 * byte-preserving cut keeps the result a clean, decodable string.
 */
export function truncatePasswordToBcryptLimit(password: string): string {
  const bytes = new TextEncoder().encode(password);
  if (bytes.length <= BCRYPT_MAX_PASSWORD_BYTES) return password;

  let end = BCRYPT_MAX_PASSWORD_BYTES;
  // Back up past any multibyte continuation bytes and their lead byte.
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end -= 1;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, end));
  } catch {
    // Unreachable for a well-formed prefix; fail closed rather than hand
    // bcrypt malformed bytes.
    return "";
  }
}

/**
 * The canonical bytes bcrypt should see for `password`. Under the cap this
 * is the identity; over the cap it is the truncation bcrypt applies anyway,
 * written out so the behavior lives in one visible place.
 */
export function normalizePasswordForBcrypt(password: string): string {
  return truncatePasswordToBcryptLimit(password);
}
