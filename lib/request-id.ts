export const REQUEST_ID_HEADER = 'x-request-id';

const ULID_LENGTH = 26;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

function encodeTime(timeMs: number): string {
  let value = Math.floor(timeMs);
  const chars = new Array(10);

  for (let index = 9; index >= 0; index -= 1) {
    chars[index] = ULID_ALPHABET[value % 32];
    value = Math.floor(value / 32);
  }

  return chars.join('');
}

function getRandomBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable');
  }

  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

function encodeRandomness(): string {
  const bytes = getRandomBytes(16);
  let random = 0;
  let bits = 0;
  let output = '';

  for (const byte of bytes) {
    random = (random << 8) | byte;
    bits += 8;

    while (bits >= 5 && output.length < 16) {
      bits -= 5;
      output += ULID_ALPHABET[(random >> bits) & 31];
    }
  }

  return output.padEnd(16, '0');
}

export function generateRequestId(now = Date.now()): string {
  return `${encodeTime(now)}${encodeRandomness()}`;
}

export function normalizeRequestId(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toUpperCase();
  if (trimmed.length !== ULID_LENGTH || !ULID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function getOrCreateRequestId(headers: Headers): { requestId: string; wasGenerated: boolean } {
  const incomingRequestId = normalizeRequestId(headers.get(REQUEST_ID_HEADER));

  if (incomingRequestId) {
    return { requestId: incomingRequestId, wasGenerated: false };
  }

  return { requestId: generateRequestId(), wasGenerated: true };
}
