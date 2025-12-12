import { tryParseURL } from "../../helpers/tryParseURL";

// The real type is not exported by undici
export type UndiciRequest = {
  origin?: string | URL;
  method?: string;
  path?: string;
  headers?: string[] | Record<string, string>;
};

export function getUrlFromRequest(req: UndiciRequest): URL | undefined {
  if (typeof req.origin === "string") {
    if (typeof req.path === "string") {
      return tryParseURL(req.origin + req.path);
    }
    return tryParseURL(req.origin);
  }

  if (req.origin instanceof URL) {
    if (typeof req.path === "string") {
      return tryParseURL(req.origin.href + req.path);
    }
    return req.origin;
  }

  return undefined;
}
