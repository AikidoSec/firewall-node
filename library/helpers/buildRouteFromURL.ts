import { tryParseURLPath } from "./tryParseURLPath";
import { isIP } from "net";

const UUID =
  /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const NUMBER = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}$/;
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const HASH = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{128})$/i;

export function buildRouteFromURL(url: string) {
  const path = tryParseURLPath(url);

  if (!path) {
    return undefined;
  }

  const route = path.split("/").map(replaceURLSegmentWithParam).join("/");

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

  if (EMAIL.test(segment)) {
    return ":email";
  }

  if (isIP(segment)) {
    return ":ip";
  }

  if (HASH.test(segment)) {
    return ":hash";
  }

  return segment;
}
