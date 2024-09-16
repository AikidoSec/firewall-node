import type { ClientHttp2Session } from "http2";
import { tryParseURL } from "../../helpers/tryParseURL";

export function getUrlFromRequest(
  subject: ClientHttp2Session,
  headers: Record<string, string>
) {
  try {
    // Ignore CONNECT requests as they do not have a path and are not relevant for redirect detection
    if (headers[":method"] === "CONNECT") {
      return undefined;
    }

    // We can not access Symbol properties directly, so we need to get them first
    const symbols = Object.getOwnPropertySymbols(subject);
    const getSymbol = (description: string) =>
      symbols.find((s) => s.description === description);
    const getSymbolValue = (description: string) => {
      const symbol = getSymbol(description);
      // @ts-expect-error Not type safe
      return symbol ? subject[symbol] : undefined;
    };

    // https://github.com/nodejs/node/blob/c1afd2c8e3298c28a0ea7a14b5e0761e688e5697/lib/internal/http2/core.js#L1770
    const authority =
      headers[":authority"] || headers["host"] || getSymbolValue("authority");

    const path = headers[":path"] || "/";
    // https://github.com/nodejs/node/blob/c1afd2c8e3298c28a0ea7a14b5e0761e688e5697/lib/internal/http2/core.js#L1773
    const protocol =
      headers[":scheme"] || getSymbolValue("protocol").slice(0, -1);

    const urlStr = `${protocol}://${authority}${path}`;

    return tryParseURL(urlStr);
  } catch {
    return undefined;
  }
}
