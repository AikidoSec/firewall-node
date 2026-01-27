const jsonContentTypes = [
  "application/json",
  "application/csp-report",
  "application/x-json",
];

export function isJsonContentType(contentType: string) {
  const normalized = contentType.toLowerCase().trim();

  if (jsonContentTypes.some((type) => normalized.startsWith(type))) {
    return true;
  }

  return normalized.includes("+json");
}
