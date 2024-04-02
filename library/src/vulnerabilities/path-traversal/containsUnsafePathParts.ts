const dangerousPathParts = [".."];

export function containsUnsafePathParts(filePath: string) {
  const containsDangerousParts = dangerousPathParts.map(dangerousPart => filePath.includes(dangerousPart));
  return containsDangerousParts.reduce((a, b) => (a || b));
}
