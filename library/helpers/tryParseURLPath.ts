import { tryParseURL } from "./tryParseURL";

export function tryParseURLPath(url: string) {
  const parsed = tryParseURL(
    url.startsWith("/") ? `http://localhost${url}` : url
  );

  if (!parsed) {
    return undefined;
  }

  return parsed.pathname;
}
