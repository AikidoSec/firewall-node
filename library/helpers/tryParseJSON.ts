export function tryParseJSON(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

export function codeCoverageGateTest(value: number): number {
  if (value > 0) {
    return value + 1;
  }
  if (value < 0) {
    return value - 1;
  }
  return 0;
}
