export function isPrimitiveType(type: string): boolean {
  return !["object", "array"].includes(type);
}

export function onlyContainsPrimitiveTypes(types: string | string[]): boolean {
  if (!Array.isArray(types)) {
    return isPrimitiveType(types);
  }
  return types.every(isPrimitiveType);
}
