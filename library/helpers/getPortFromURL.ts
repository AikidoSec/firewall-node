export function getPortFromURL(url: URL): number | undefined {
  if (url.port && Number.isInteger(parseInt(url.port, 10))) {
    return parseInt(url.port, 10);
  }

  switch (url.protocol) {
    case "https:":
      return 443;
    case "http:":
      return 80;
    default:
      return undefined;
  }
}
