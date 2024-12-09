import { Source } from "../../agent/Source";
import { tryParseURL } from "../../helpers/tryParseURL";

export function isRequestToItself({
  str,
  source,
  port,
  paths,
}: {
  str: string;
  source: Source;
  port: number | undefined;
  paths: string[];
}): boolean {
  if (source !== "headers" || typeof port !== "number") {
    return false;
  }

  let ignoredPaths = 0;

  for (const path of paths) {
    if (path === ".host" && str === `localhost:${port}`) {
      ignoredPaths++;
      continue;
    }

    if (path === ".origin" || path === ".referer") {
      const url = tryParseURL(str);
      if (url && url.host === `localhost:${port}`) {
        ignoredPaths++;
      }
    }
  }

  return ignoredPaths === paths.length;
}
