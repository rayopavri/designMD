const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function matchesImageSignature(input: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return input.length >= PNG_SIGNATURE.length && input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  }
  if (mimeType === 'image/jpeg') {
    return input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return input.length >= 12 && input.subarray(0, 4).toString('ascii') === 'RIFF' && input.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}
