import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type Blocklist = {
  source: string;
  description: string;
  ips: string[];
};

export async function fetchBlockedLists(token: Token): Promise<{
  blockedIPAddresses: Blocklist[];
  blockedUserAgents: string;
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

  const result: {
    blockedIPAddresses: Blocklist[];
    blockedUserAgents: string;
  } = JSON.parse(body);

  return {
    blockedIPAddresses:
      result && Array.isArray(result.blockedIPAddresses)
        ? result.blockedIPAddresses
        : [],
    // Blocked user agents are stored as a string pattern for usage in a regex (e.g. "Googlebot|Bingbot")
    blockedUserAgents:
      result && typeof result.blockedUserAgents === "string"
        ? result.blockedUserAgents
        : "",
  };
}
