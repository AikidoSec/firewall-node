import { Source } from "../../agent/Source";

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
  return (
    source === "headers" &&
    (path === ".host" || path === ".origin" || path === ".referer") &&
    typeof port === "number" &&
    str === `localhost:${port}`
  );
}
