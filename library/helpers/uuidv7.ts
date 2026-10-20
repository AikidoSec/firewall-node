import * as crypto from "node:crypto";

export function uuidv7(): string {
  // @ts-expect-error We are using outdated Node.js types
  if (typeof crypto.randomUUIDv7 === "function") {
    // @ts-expect-error We are using outdated Node.js types
    return crypto.randomUUIDv7();
  }

  return uuidv7Polyfill();
}

function uuidv7Polyfill(): string {
  const bytes = crypto.randomBytes(16);

  // 48-bit millisecond timestamp, big-endian
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & BigInt(0xff));
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 9562 variant

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
