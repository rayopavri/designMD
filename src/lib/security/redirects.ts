const INTERNAL_ORIGIN = 'https://uiuxskills.com';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function resolveInternalPath(value: string | null | undefined): string | null {
  if (!value || CONTROL_CHARACTERS.test(value) || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (
      CONTROL_CHARACTERS.test(decoded) ||
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.startsWith('/\\')
    ) {
      return null;
    }

    const resolved = new URL(value, INTERNAL_ORIGIN);

    if (resolved.origin !== INTERNAL_ORIGIN) {
      return null;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  return resolveInternalPath(value) ?? resolveInternalPath(fallback) ?? '/';
}
