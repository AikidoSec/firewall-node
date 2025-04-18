import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type IPList = {
  key: string;
  source: string;
  description: string;
  ips: string[];
  monitor: boolean;
};

export type BotBlocklist = {
  key: string;
  pattern: string; // e.g. "Googlebot|Bingbot"
  monitor: boolean;
};

export type Response = {
  blockedIPAddresses: IPList[];
  allowedIPAddresses: IPList[];
  blockedUserAgents: BotBlocklist[];
};

export async function fetchBlockedLists(token: Token): Promise<Response> {
  const baseUrl = getAPIURL();
  const { body, statusCode } = await fetch({
    url: new URL(`${baseUrl.toString()}api/runtime/firewall/lists`),
    method: "GET",
    headers: {
      // We need to set the Accept-Encoding header to "gzip" to receive the response in gzip format
      "Accept-Encoding": "gzip",
      // Indicates to the server that this agent supports the new format with monitoring
      "x-supports-monitoring": "true",
      Authorization: token.asString(),
    },
    timeoutInMS: 60 * 1000,
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

  const validResponse =
    Array.isArray(result.blockedIPAddresses) &&
    Array.isArray(result.allowedIPAddresses) &&
    Array.isArray(result.blockedUserAgents);

  if (!validResponse) {
    throw new Error("Invalid response from fetchBlockedLists");
  }

  return result;
}
