const dangerousPathParts = [".."];

export function containsUnsafePathParts(filePath: string) {
  console.log("containsUnsafePathParts called");

  const containsDangerousParts = dangerousPathParts.map(dangerousPart => filePath.includes(dangerousPart));

  return containsDangerousParts.reduce((a, b) => (a || b));
}
