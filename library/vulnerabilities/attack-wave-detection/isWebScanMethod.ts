const methods = new Set<string>([
  "BADMETHOD",
  "BADHTTPMETHOD",
  "BADDATA",
  "BADMTHD",
  "BDMTHD",
]);

export function isWebScanMethod(method: string): boolean {
  return methods.has(method.toUpperCase());
}
