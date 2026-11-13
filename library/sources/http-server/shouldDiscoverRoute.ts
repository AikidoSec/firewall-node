import { getFileExtension } from "../../helpers/getFileExtension";
import { isWellKnownURI } from "../../helpers/isWellKnownURI";
import { tryParseURL } from "../../helpers/tryParseURL";

const EXCLUDED_METHODS = ["OPTIONS", "HEAD"];
const IGNORE_EXTENSIONS = ["properties", "config", "webmanifest"];
const IGNORE_STRINGS = ["cgi-bin"];

export function shouldDiscoverRoute({
  statusCode,
  route,
  method,
  forceProtectionOff,
  redirectLocation,
  host,
  isBehindTrustedProxy,
}: {
  statusCode: number;
  route: string;
  method: string;
  forceProtectionOff: boolean;
  redirectLocation?: string;
  host?: string;
  isBehindTrustedProxy?: boolean;
}) {
  if (forceProtectionOff) {
    return false;
  }

  const validStatusCode = statusCode >= 200 && statusCode <= 399;

  if (!validStatusCode) {
    return false;
  }

  // Do not discover GET routes that redirect within the app
  // e.g. trailing slash redirects of unknown routes or redirects of all routes to a login page
  // Redirects for other methods (e.g. POST /login) and redirects to other hosts (e.g. OAuth) are still discovered
  if (
    statusCode >= 300 &&
    method === "GET" &&
    isInternalRedirect(redirectLocation, host, isBehindTrustedProxy)
  ) {
    return false;
  }

  if (EXCLUDED_METHODS.includes(method)) {
    return false;
  }

  const segments = route.split("/");

  // Do not discover routes with dot files like `/path/to/.file` or `/.directory/file`
  // We want to allow discovery of well-known URIs like `/.well-known/acme-challenge`
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

function isInternalRedirect(
  location: string | undefined,
  host: string | undefined,
  isBehindTrustedProxy: boolean | undefined
) {
  if (!location) {
    return false;
  }

  const isProtocolRelative = location.startsWith("//");

  if (location.startsWith("/") && !isProtocolRelative) {
    return true;
  }

  // The host header can be manipulated by the client if there is no trusted proxy
  if (!isBehindTrustedProxy || !host) {
    return false;
  }

  const url = tryParseURL(isProtocolRelative ? `http:${location}` : location);

  return url?.host === host;
}
