import { Agent as HTTPAgent } from "http";
import { Agent as HTTPSAgent } from "https";

export function isProxyAgent(agent: unknown): boolean {
  if (!agent || typeof agent !== "object") {
    return false;
  }

  switch (agent.constructor?.name) {
    case "HttpProxyAgent":
    case "HttpsProxyAgent":
    case "SocksProxyAgent":
      return true;
  }

  if (!(agent instanceof HTTPAgent) && !(agent instanceof HTTPSAgent)) {
    return false;
  }

  if (!("options" in agent)) {
    return false;
  }
  const options = agent.options as
    | { proxyEnv?: Record<string, unknown> }
    | undefined;
  const env = options?.proxyEnv;
  let proxy: unknown;
  if (agent instanceof HTTPSAgent) {
    proxy = env?.https_proxy || env?.HTTPS_PROXY;
  } else {
    proxy = env?.http_proxy || env?.HTTP_PROXY;
  }
  return typeof proxy === "string" && /^https?:\/\//.test(proxy);
}
