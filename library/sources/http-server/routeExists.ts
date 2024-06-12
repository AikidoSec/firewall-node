const NOT_FOUND = 404;
const METHOD_NOT_ALLOWED = 405;
const CODES = [NOT_FOUND, METHOD_NOT_ALLOWED];

export function routeExists(statusCode: number) {
  return !CODES.includes(statusCode);
}
