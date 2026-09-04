export function toXmlString(arg: unknown): string | undefined {
  if (typeof arg === "string") {
    return arg;
  }

  if (Buffer.isBuffer(arg)) {
    return new TextDecoder().decode(arg);
  }

  return undefined;
}
