export function safeCreateRegExp(
  pattern: string,
  flags: string
): RegExp | undefined {
  try {
    return new RegExp(pattern, flags);
  } catch {
    // Don't throw errors when the regex is invalid
    return undefined;
  }
}
