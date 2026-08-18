const INTERNAL_ORIGIN = 'https://uiuxskills.com';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value || CONTROL_CHARACTERS.test(value) || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  try {
    const resolved = new URL(value, INTERNAL_ORIGIN);

    if (resolved.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
