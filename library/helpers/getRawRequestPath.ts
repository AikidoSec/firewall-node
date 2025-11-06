export function getRawRequestPath(url: string): string {
  let partialUrl = url;

  // Remove protocol (http://, https://, etc.)
  const pathStart = partialUrl.indexOf("://");
  if (pathStart !== -1) partialUrl = partialUrl.slice(pathStart + 3);

  // Remove hostname and port
  const slashIndex = partialUrl.indexOf("/");
  if (slashIndex === -1) return "/"; // only hostname given
  partialUrl = partialUrl.slice(slashIndex);

  // Remove query and fragment
  const queryIndex = partialUrl.indexOf("?");
  const hashIndex = partialUrl.indexOf("#");

  let endIndex = partialUrl.length;
  if (queryIndex !== -1) endIndex = Math.min(endIndex, queryIndex);
  if (hashIndex !== -1) endIndex = Math.min(endIndex, hashIndex);

  return partialUrl.slice(0, endIndex) || "/";
}
