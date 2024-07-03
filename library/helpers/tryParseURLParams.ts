import { tryParseURL } from "./tryParseURL";

export function tryParseURLParams(url: string) {
  const parsed = tryParseURL(
    url.startsWith("/") ? `http://localhost${url}` : url
  );

  if (!parsed) {
    return new URLSearchParams();
  }

  return parsed.searchParams;
}
