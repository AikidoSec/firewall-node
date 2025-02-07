import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type Blocklist = {
  key: string;
  source: string;
  description: string;
  ips: string[];
};

export type AgentBlockList = {
  key: string;
  pattern: string; // e.g. "Googlebot|Bingbot"
};

export async function fetchBlockedLists(token: Token): Promise<{
  blockedIPAddresses: Blocklist[];
  blockedUserAgents: AgentBlockList[];
}> {
  const baseUrl = getAPIURL();
  const { body, statusCode } = await fetch({
    url: new URL(`${baseUrl.toString()}api/runtime/firewall/lists`),
    method: "GET",
    headers: {
      // We need to set the Accept-Encoding header to "gzip" to receive the response in gzip format
      "Accept-Encoding": "gzip",
      Authorization: token.asString(),
    },
    timeoutInMS: 20000,
  });

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch blocked lists: ${statusCode}`);
  }

  const result: {
    blockedIPAddresses: Blocklist[];
    blockedUserAgentsV2: string;
  } = JSON.parse(body);

  return {
    blockedIPAddresses:
      result && Array.isArray(result.blockedIPAddresses)
        ? result.blockedIPAddresses
        : [],
    blockedUserAgents:
      result && Array.isArray(result.blockedUserAgentsV2)
        ? result.blockedUserAgentsV2
        : [],
  };
}
