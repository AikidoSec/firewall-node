export function tryDecodeBuffer(
  data: Buffer | ArrayBuffer,
  encoding = "utf-8",
  fatal = true
): string | undefined {
  try {
    const decoder = new TextDecoder(encoding, {
      fatal: fatal, // Throw error if buffer is not matching the encoding
    });

    return decoder.decode(data);
  } catch {
    return undefined;
  }
}
