// See https://github.com/nodejs/node/blob/2aad7789408a5b4a18342da11880e0dce3b404f0/lib/internal/modules/esm/get_format.js#L40-L57
const JS_DATA_URL_MIME_TYPES = new Set([
  "text/javascript",
  "application/javascript",
]);

export function isJsDataUrl(url: URL): boolean {
  const commaIndex = url.pathname.indexOf(",");
  if (commaIndex === -1) {
    return false;
  }

  const meta = url.pathname.slice(0, commaIndex);
  const mime = meta.split(";")[0].trim().toLowerCase();

  return JS_DATA_URL_MIME_TYPES.has(mime);
}

export function decodeDataUrl(url: URL): string | undefined {
  try {
    const commaIndex = url.pathname.indexOf(",");
    if (commaIndex === -1) {
      return undefined;
    }

    const meta = url.pathname.slice(0, commaIndex);
    const data = url.pathname.slice(commaIndex + 1);

    if (/;\x20*base64$/i.test(meta)) {
      return Buffer.from(decodeURIComponent(data), "base64").toString("utf8");
    }

    return decodeURIComponent(data);
  } catch {
    return undefined;
  }
}
