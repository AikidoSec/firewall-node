import { getFileExtension } from "../../helpers/getFileExtension";
import { isWellKnownURI } from "../../helpers/isWellKnownURI";

const EXCLUDED_METHODS = ["OPTIONS", "HEAD"];
const IGNORE_EXTENSIONS = ["properties", "config", "webmanifest"];
const IGNORE_STRINGS = ["cgi-bin"];

export function shouldDiscoverRoute({
  statusCode,
  route,
  method,
}: {
  statusCode: number;
  route: string;
  method: string;
}) {
  const validStatusCode = statusCode >= 200 && statusCode <= 399;

  if (!validStatusCode) {
    return false;
  }

  if (EXCLUDED_METHODS.includes(method)) {
    return false;
  }

  const segments = route.split("/");

  // e.g. /path/to/.file or /.directory/file
  if (!isWellKnownURI(route) && segments.some(isDotFile)) {
    return false;
  }

  if (segments.some(containsIgnoredString)) {
    return false;
  }

  // Check for every file segment if it contains a file extension and if it should be discovered or ignored
  return segments.every(shouldDiscoverExtension);
}

// Ignore routes which contain file extensions
function shouldDiscoverExtension(segment: string) {
  const extension = getFileExtension(segment);

  // No file extension, allow discovery
  if (!extension) {
    return true;
  }

  // Do not discover files with extensions of 1 to 5 characters, e.g. file.css, file.js, file.woff2
  if (extension.length > 1 && extension.length < 6) {
    return false;
  }

  // Ignore some file extensions that are longer than 5 characters or shorter than 2 chars
  if (IGNORE_EXTENSIONS.includes(extension)) {
    return false;
  }

  return true;
}

function isDotFile(segment: string) {
  return segment.startsWith(".") && segment.length > 1;
}

function containsIgnoredString(segment: string) {
  return IGNORE_STRINGS.some((str) => segment.includes(str));
}
