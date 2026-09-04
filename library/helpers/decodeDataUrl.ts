import { safeDecodeURIComponent } from "./safeDecodeURIComponent";

// See https://github.com/nodejs/node/blob/2aad7789408a5b4a18342da11880e0dce3b404f0/lib/internal/modules/esm/get_format.js#L40-L57
const JS_DATA_URL_MIME_TYPES = new Set([
  "text/javascript",
  "application/javascript",
]);

function getDataUrlPath(url: string | URL): string | undefined {
  if (url instanceof URL) {
    if (url.protocol !== "data:") {
      return undefined;
    }
    return url.pathname;
  }

  // Node always normalizes the scheme to lowercase before we see it
  if (!url.startsWith("data:")) {
    return undefined;
  }

  const questionIndex = url.indexOf("?", 5);
  const hashIndex = url.indexOf("#", 5);
  const stopIndex =
    questionIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? questionIndex
        : Math.min(questionIndex, hashIndex);

  return url.slice(5, stopIndex === -1 ? undefined : stopIndex);
}

export function isJsDataUrl(url: string | URL): boolean {
  const path = getDataUrlPath(url);
  if (path === undefined) {
    return false;
  }

  const commaIndex = path.indexOf(",");
  if (commaIndex === -1) {
    return false;
  }

  const meta = path.slice(0, commaIndex);
  const mime = meta.split(";")[0].trim().toLowerCase();

  return JS_DATA_URL_MIME_TYPES.has(mime);
}

export function decodeDataUrl(url: string | URL): string | undefined {
  const path = getDataUrlPath(url);
  if (path === undefined) {
    return undefined;
  }

  const commaIndex = path.indexOf(",");
  if (commaIndex === -1) {
    return undefined;
  }

  const meta = path.slice(0, commaIndex);
  const data = path.slice(commaIndex + 1);

  // Node decodes data: URL bodies forgivingly, accepting malformed percent-encoding
  const decoded = safeDecodeURIComponent(data) ?? data;

  if (/;\x20*base64$/i.test(meta)) {
    return Buffer.from(decoded, "base64").toString("utf8");
  }

  return decoded;
}
