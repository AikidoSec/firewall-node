import { safeCreateRegExp } from "../agent/safeCreateRegExp";
import { escapeStringRegexp } from "./escapeStringRegexp";
import { looksLikeASecret } from "./looksLikeASecret";
import { safeDecodeURIComponent } from "./safeDecodeURIComponent";
import { tryParseURLPath } from "./tryParseURLPath";
import { isIP } from "net";

const UUID =
  /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const NUMBER = /^\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}$/;
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const HASH = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{128})$/i;
const HASH_LENGTHS = [32, 40, 64, 128];
const NUMBER_ARRAY = /^\d+(?:,\d+)*$/;

export function buildRouteFromURL(url: string, custom: RegExp[]) {
  let path = tryParseURLPath(url);

  if (!path) {
    return undefined;
  }

  if (path.includes("%") && path.length >= 3) {
    const decoded = safeDecodeURIComponent(path);
    if (decoded) {
      path = decoded;
    }
  }

  const route = path
    .split("/")
    .map((segment) => replaceURLSegmentWithParam(segment, custom))
    .join("/");

  if (route === "/") {
    return "/";
  }

  if (route.endsWith("/")) {
    return route.slice(0, -1);
  }

  return route;
}

export function compileCustomPattern(pattern: string) {
  if (!pattern.includes("{") || !pattern.includes("}")) {
    return undefined;
  }

  const supported: Record<string, string> = {
    "{digits}": `\\d+`,
    "{alpha}": "[a-zA-Z]+",
  };

  const placeholderRegex = /(\{[a-zA-Z]+})/g;
  const parts = pattern.split(placeholderRegex);
  const regexParts = parts.map((part) => {
    if (supported[part]) {
      return supported[part];
    }

    return escapeStringRegexp(part);
  });

  return safeCreateRegExp(`^${regexParts.join("")}$`, "");
}

function replaceURLSegmentWithParam(segment: string, customPatterns: RegExp[]) {
  const charCode = segment.charCodeAt(0);
  const startsWithNumber = charCode >= 48 && charCode <= 57; // ASCII codes for '0' to '9'

  if (startsWithNumber && NUMBER.test(segment)) {
    return ":number";
  }

  if (segment.length === 36 && UUID.test(segment)) {
    return ":uuid";
  }

  if (segment.length === 26 && ULID.test(segment)) {
    return ":ulid";
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

  if (startsWithNumber && NUMBER_ARRAY.test(segment)) {
    return ":array(number)";
  }

  if (looksLikeASecret(segment)) {
    return ":secret";
  }

  for (const pattern of customPatterns) {
    if (pattern.test(segment)) {
      return `:custom`;
    }
  }

  return segment;
}
