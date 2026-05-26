const foreignExtensions = new Set<string>([
  "php",
  "php3",
  "php4",
  "php5",
  "phtml",
  "java",
  "jsp",
  "jspx",
]);

export function hasForeignExtension(path: string): boolean {
  const lastSegment = path.split("/").pop();

  if (!lastSegment || !lastSegment.includes(".")) {
    return false;
  }

  const ext = lastSegment.split(".").pop();

  if (ext) {
    return foreignExtensions.has(ext.toLowerCase());
  }

  return false;
}
