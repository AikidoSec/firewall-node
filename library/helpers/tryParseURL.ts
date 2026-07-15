export function tryParseURL(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
