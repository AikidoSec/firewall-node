import { extname } from "path";

const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const ERROR_CODES = [NOT_FOUND, METHOD_NOT_ALLOWED];
const EXCLUDED_METHODS = ["OPTIONS", "HEAD"];
const IGNORE_EXTENSIONS = ["properties", "php", "asp", "aspx", "jsp", "config"];
const IGNORE_STRINGS = ["cgi-bin", "wp-config"];

export function shouldDiscoverRoute({
  statusCode,
  route,
  method,
}: {
  statusCode: number;
  route: string;
  method: string;
}) {
  if (EXCLUDED_METHODS.includes(method)) {
    return false;
  }

  if (ERROR_CODES.includes(statusCode)) {
    return false;
  }

  const segments = route.split("/");

  // e.g. /path/to/.file or /.directory/file
  if (segments.some(isDotFile)) {
    return false;
  }

  if (segments.some(containsIgnoredString)) {
    return false;
  }

  return segments.every(isAllowedExtension);
}

function isAllowedExtension(segment: string) {
  let extension = extname(segment);

  if (extension && extension.startsWith(".")) {
    // Remove the dot from the extension
    extension = extension.slice(1);

    if (extension.length >= 2 && extension.length <= 5) {
      return false;
    }

    if (IGNORE_EXTENSIONS.includes(extension)) {
      return false;
    }
  }

  return true;
}

function isDotFile(segment: string) {
  // See https://www.rfc-editor.org/rfc/rfc8615
  if (segment === ".well-known") {
    return false;
  }

  return segment.startsWith(".") && segment.length > 1;
}

function containsIgnoredString(segment: string) {
  return IGNORE_STRINGS.some((str) => segment.includes(str));
}
