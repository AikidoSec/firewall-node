export function tryParseURL(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
