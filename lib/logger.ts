/**
 * Structured, sanitized logging utility that scrubs sensitive data and PII
 * before writing to console/logs.
 */

const SENSITIVE_KEY_NAMES = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "pass",
  "pwd",
  "secret",
  "clientsecret",
  "client_secret",
  "authsecret",
  "auth_secret",
  "jwtsecret",
  "jwt_secret",
  "secretkey",
  "secret_key",
  "token",
  "rawtoken",
  "raw_token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "sessiontoken",
  "session_token",
  "csrftoken",
  "csrf_token",
  "idtoken",
  "id_token",
  "authtoken",
  "auth_token",
  "verificationtoken",
  "verification_token",
  "apikey",
  "api_key",
  "agentkey",
  "agent_key",
  "privatekey",
  "private_key",
  "key",
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "creditcard",
  "credit_card",
  "cvv",
  "ssn",
  "usercode",
  "user_code",
  "pairingcode",
  "pairing_code",
]);

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  const normalized = lower.replace(/[-_]/g, "");
  if (SENSITIVE_KEY_NAMES.has(lower) || SENSITIVE_KEY_NAMES.has(normalized)) {
    return true;
  }
  return (
    /password/i.test(normalized) ||
    /secret/i.test(normalized) ||
    /token$/i.test(normalized) ||
    /apikey$/i.test(normalized) ||
    /privatekey$/i.test(normalized)
  );
}

export function sanitizeString(str: string): string {
  return str
    // Authorization Bearer token
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
    // Authorization Basic auth
    .replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, "$1[REDACTED]")
    // Database and protocol URLs with credentials
    .replace(/((?:https?|postgres(?:ql)?|mysql|mongodb|redis|smtp):\/\/[^:]+:)[^@]+(@)/gi, "$1[REDACTED]$2")
    // URL search parameters with sensitive keys
    .replace(/([?&](?:token|access_token|key|api_key|secret|password|auth|code)=)[^&]+/gi, "$1[REDACTED]")
    // JWT tokens (three base64 segments)
    .replace(/\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[JWT_REDACTED]")
    // Ziki agent keys
    .replace(/\b(zek_[a-zA-Z0-9_-]{10,})\b/g, "zek_[REDACTED]")
    // JSON property string values for sensitive keys
    .replace(/("(?:password|secret|token|apiKey|rawToken|privateKey)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"');
}

export function sanitize<T>(data: T, seen = new WeakSet()): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return sanitizeString(data) as unknown as T;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (seen.has(data as object)) {
    return "[Circular]" as unknown as T;
  }
  seen.add(data as object);

  if (data instanceof Error) {
    const sanitizedError = new Error(sanitizeString(data.message));
    sanitizedError.name = data.name;
    if (data.stack) {
      sanitizedError.stack = sanitizeString(data.stack);
    }
    if ((data as { cause?: unknown }).cause) {
      sanitizedError.cause = sanitize((data as { cause: unknown }).cause, seen);
    }
    const errRecord = sanitizedError as unknown as Record<string, unknown>;
    const dataRecord = data as unknown as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(data)) {
      if (key !== "name" && key !== "message" && key !== "stack" && key !== "cause") {
        if (isSensitiveKey(key)) {
          errRecord[key] = "[REDACTED]";
        } else {
          errRecord[key] = sanitize(dataRecord[key], seen);
        }
      }
    }
    return sanitizedError as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = sanitize(value, seen);
    }
  }
  return result as unknown as T;
}

export function safeJsonStringify(data: unknown, space?: number): string {
  const sanitized = sanitize(data);
  return JSON.stringify(sanitized, null, space);
}

export const logger = {
  error: (...args: unknown[]) => {
    console.error(...args.map((arg) => sanitize(arg)));
  },
  warn: (...args: unknown[]) => {
    console.warn(...args.map((arg) => sanitize(arg)));
  },
  info: (...args: unknown[]) => {
    console.info(...args.map((arg) => sanitize(arg)));
  },
  log: (...args: unknown[]) => {
    console.log(...args.map((arg) => sanitize(arg)));
  },
  debug: (...args: unknown[]) => {
    console.debug(...args.map((arg) => sanitize(arg)));
  },
};
