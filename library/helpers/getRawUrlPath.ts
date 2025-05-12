export function getRawUrlPath(url: string): string {
  // Remove protocol (http://, https://, etc.)
  const pathStart = url.indexOf("://");
  if (pathStart !== -1) url = url.slice(pathStart + 3);

  // Remove hostname and port
  const slashIndex = url.indexOf("/");
  if (slashIndex === -1) return "/"; // only hostname given
  url = url.slice(slashIndex);

  // Remove query and fragment
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");

  let endIndex = url.length;
  if (queryIndex !== -1) endIndex = Math.min(endIndex, queryIndex);
  if (hashIndex !== -1) endIndex = Math.min(endIndex, hashIndex);

  return url.slice(0, endIndex) || "/";
}
