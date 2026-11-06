export function isProxyDispatcher(dispatcher: unknown): boolean {
  if (!dispatcher || typeof dispatcher !== "object") {
    return false;
  }

  switch (dispatcher.constructor?.name) {
    case "ProxyAgent":
    case "EnvHttpProxyAgent":
    case "Socks5ProxyAgent":
      return true;
    default:
      return false;
  }
}
