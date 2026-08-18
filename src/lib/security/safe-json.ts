/** Serialize JSON for an HTML script element without allowing markup breaks. */
export function serializeJsonForHtml(value: unknown): string {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    return serialized as unknown as string;
  }

  return serialized
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
