import { extname } from "path";

const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const ERROR_CODES = [NOT_FOUND, METHOD_NOT_ALLOWED];

export function shouldDiscoverRoute({
  statusCode,
  route,
  method,
}: {
  statusCode: number;
  route: string;
  method: string;
}) {
  const excludedMethods = ["OPTIONS", "HEAD"];

  if (excludedMethods.includes(method)) {
    return false;
  }

  if (ERROR_CODES.includes(statusCode)) {
    return false;
  }

  let extension = extname(route);

  if (extension && extension.startsWith(".")) {
    // Remove the dot from the extension
    extension = extension.slice(1);

    if (extension.length >= 2 && extension.length <= 4) {
      return false;
    }
  }

  return true;
}
