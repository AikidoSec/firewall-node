import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

// Copies all properties from the stream to the base object
export function replaceRequestBody<T extends IncomingMessage>(
  base: T,
  stream: Readable
): T {
  for (const key in stream) {
    let v = stream[key as keyof Readable] as any;
    if (typeof v === "function") {
      v = v.bind(base);
    }
    base[key as keyof T] = v;
  }

  return base;
}
