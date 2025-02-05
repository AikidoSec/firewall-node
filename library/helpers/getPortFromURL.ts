export function getPortFromURL(url: URL): number | undefined {
  const port = parseInt(url.port, 10);

  if (Number.isInteger(port)) {
    return port;
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
