const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const ERROR_CODES = [NOT_FOUND, METHOD_NOT_ALLOWED];

export function routeExists(statusCode: number) {
  if (ERROR_CODES.includes(statusCode)) {
    return false;
  }

  return true;
}
