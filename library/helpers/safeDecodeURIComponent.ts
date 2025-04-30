export function safeDecodeURIComponent(uri: string): string | undefined {
  try {
    return decodeURIComponent(uri);
  } catch {
    return undefined;
  }
}
