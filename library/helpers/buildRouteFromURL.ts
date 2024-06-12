import { tryParseURL } from "./tryParseURL";

const UUID =
  /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const NUMBER = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}$/;

export function buildRouteFromURL(url: string) {
  const parsed = tryParseURL(
    url.startsWith("/") ? `http://localhost${url}` : url
  );

  if (!parsed || !parsed.pathname) {
    return undefined;
  }

  const route = parsed.pathname
    .split("/")
    .map(replaceURLSegmentWithParam)
    .join("/");

  if (route === "/") {
    return "/";
  }

  if (route.endsWith("/")) {
    return route.slice(0, -1);
  }

  return route;
}

function replaceURLSegmentWithParam(segment: string) {
  if (NUMBER.test(segment)) {
    return ":number";
  }

  if (UUID.test(segment)) {
    return ":uuid";
  }

  if (DATE.test(segment)) {
    return ":date";
  }

  return segment;
}
