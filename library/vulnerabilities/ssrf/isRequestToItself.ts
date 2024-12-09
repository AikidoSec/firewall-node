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

  let ignoredPathsCount = 0;

  for (const path of paths) {
    if (shouldIgnorePath(path, str, port)) {
      ignoredPathsCount++;
    }
  }

  return ignoredPathsCount === paths.length;
}

// Check if the path is a header that is ignored if it's a request to itself using localhost
function shouldIgnorePath(path: string, str: string, port: number) {
  if (path === ".host" && str === `localhost:${port}`) {
    return true;
  }

  if (path === ".origin" || path === ".referer") {
    const url = tryParseURL(str);
    if (url && url.host === `localhost:${port}`) {
      return true;
    }
  }

  return false;
}
