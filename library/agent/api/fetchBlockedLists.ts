import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type IPList = {
  key: string;
  source: string;
  description: string;
  ips: string[];
};

export type AgentBlockList = {
  key: string;
  pattern: string; // e.g. "Googlebot|Bingbot"
};

export type Response = {
  blockedIPAddresses: IPList[];
  allowedIPAddresses: IPList[];
  blockedUserAgentsV2: AgentBlockList[];
};

export async function fetchBlockedLists(token: Token): Promise<{
  blockedIPAddresses: IPList[];
  allowedIPAddresses: IPList[];
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
    if (statusCode === 401) {
      throw new Error(
        `Unable to access the Aikido platform, please check your token.`
      );
    }
    throw new Error(`Failed to fetch blocked lists: ${statusCode}`);
  }

  const result: Response = JSON.parse(body);

  return {
    blockedIPAddresses:
      result && Array.isArray(result.blockedIPAddresses)
        ? result.blockedIPAddresses
        : [],
    allowedIPAddresses:
      result && Array.isArray(result.allowedIPAddresses)
        ? result.allowedIPAddresses
        : [],
    blockedUserAgents:
      result && Array.isArray(result.blockedUserAgentsV2)
        ? result.blockedUserAgentsV2
        : [],
  };
}
