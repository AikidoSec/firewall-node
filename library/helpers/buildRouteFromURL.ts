import { looksLikeASecret } from "./looksLikeASecret";
import { tryParseURLPath } from "./tryParseURLPath";
import { isIP } from "net";

const UUID =
  /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const NUMBER = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}$/;
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const HASH = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{128})$/i;
const HASH_LENGTHS = [32, 40, 64, 128];

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
  const charCode = segment.charCodeAt(0);
  const startsWithNumber = charCode >= 48 && charCode <= 57; // ASCII codes for '0' to '9'

  if (startsWithNumber && NUMBER.test(segment)) {
    return ":number";
  }

  if (segment.length === 36 && UUID.test(segment)) {
    return ":uuid";
  }

  if (segment.length === 24 && OBJECT_ID.test(segment)) {
    return ":objectId";
  }

  if (startsWithNumber && DATE.test(segment)) {
    return ":date";
  }

  if (segment.includes("@") && EMAIL.test(segment)) {
    return ":email";
  }

  if ((segment.includes(":") || segment.includes(".")) && isIP(segment)) {
    return ":ip";
  }

  if (HASH_LENGTHS.includes(segment.length) && HASH.test(segment)) {
    return ":hash";
  }

  if (looksLikeASecret(segment)) {
    return ":secret";
  }

  return segment;
}
