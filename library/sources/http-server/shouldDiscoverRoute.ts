import { extname } from "path";

const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const TEMPORARY_REDIRECT = 307;
const PERMANENT_REDIRECT = 308;
const ERROR_CODES = [NOT_FOUND, METHOD_NOT_ALLOWED];
const REDIRECT_CODES = [
  MOVED_PERMANENTLY,
  FOUND,
  SEE_OTHER,
  TEMPORARY_REDIRECT,
  PERMANENT_REDIRECT,
];
const EXCLUDED_METHODS = ["OPTIONS", "HEAD"];
const IGNORE_EXTENSIONS = ["properties", "php", "asp", "aspx", "jsp"];

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

  if (REDIRECT_CODES.includes(statusCode)) {
    return false;
  }

  const segments = route.split("/");

  // e.g. /path/to/.file or /.directory/file
  if (segments.some(isDotFile)) {
    return false;
  }

  return segments.every(isAllowedExtension);
}

function isAllowedExtension(segment: string) {
  let extension = extname(segment);

  if (extension && extension.startsWith(".")) {
    // Remove the dot from the extension
    extension = extension.slice(1);

    if (extension.length >= 2 && extension.length <= 4) {
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
