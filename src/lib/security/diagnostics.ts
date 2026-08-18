/**
 * Dependency-neutral diagnostic boundary for server logs and persisted
 * operational failures. Upstream exceptions can contain prompts, request
 * bodies, credentials, and URLs, so retain only a small allowlisted type.
 */
const DIAGNOSTIC_ERROR_TYPES = new Set([
  'AbortError',
  'Error',
  'FetchError',
  'PostgresError',
  'TimeoutError',
  'TypeError',
  'ZodError',
]);

const SAFE_DETAIL_PATTERN = /^(?:diagnostic|generation)_error type=(?:AbortError|Error|FetchError|PostgresError|TimeoutError|TypeError|ZodError|non_error_throw)$/;

function errorType(error: unknown): string {
  if (!(error instanceof Error)) return 'non_error_throw';
  return DIAGNOSTIC_ERROR_TYPES.has(error.name) ? error.name : 'Error';
}

/** Returns an allowlisted error type without retaining provider exception text. */
export function safeDiagnosticErrorDetail(error: unknown): string {
  return `diagnostic_error type=${errorType(error)}`;
}

/** Backwards-compatible generation-specific form for persisted job diagnostics. */
export function safeGenerationErrorDetail(error: unknown): string {
  return `generation_error type=${errorType(error)}`;
}

/**
 * Reduces an HTTP(S) URL to a log-safe origin. Credentials, paths, queries,
 * fragments, control characters, and malformed values are never retained.
 */
export function safeDiagnosticUrl(value: unknown): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return 'invalid-url';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : 'invalid-url';
  } catch {
    return 'invalid-url';
  }
}

/**
 * Formats a single perf field without allowing error text, raw URLs, or a
 * newline/control sequence to create a forged log field or line.
 */
export function safePerfDiagnosticValue(key: string, value: unknown): string {
  if (key === 'error') {
    return typeof value === 'string' && SAFE_DETAIL_PATTERN.test(value)
      ? value
      : safeDiagnosticErrorDetail(value);
  }
  if (/url/i.test(key)) return safeDiagnosticUrl(value);
  return String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 160);
}

/** Normalizes field names so dynamic inputs cannot add whitespace or delimiters. */
export function safePerfDiagnosticKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'field';
}
