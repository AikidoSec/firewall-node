const jsonContentTypes = [
  "application/json",
  "application/vnd.api+json",
  "application/csp-report",
  "application/x-json",
];

export function isJsonContentType(contentType: string) {
  return jsonContentTypes.some((type) => contentType.includes(type));
}
