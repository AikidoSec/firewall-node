import { Source } from "../../agent/Source";
import { tryParseURL } from "../../helpers/tryParseURL";

export function isRequestToItself({
  str,
  source,
  port,
  path,
}: {
  source: Source;
  path: string;
  port: number | undefined;
  str: string;
}): boolean {
  if (source !== "headers" || typeof port !== "number") {
    return false;
  }

  if (path === ".host") {
    return str === `localhost:${port}`;
  }

  if (path === ".origin" || path === ".referer") {
    const url = tryParseURL(str);
    return !!url && url.host === `localhost:${port}`;
  }

  return false;
}
