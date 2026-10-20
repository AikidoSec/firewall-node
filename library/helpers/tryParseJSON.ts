export function tryParseJSON(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}
