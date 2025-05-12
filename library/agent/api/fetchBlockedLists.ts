/* eslint-disable max-lines-per-function */
import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { Token } from "./Token";

export type IPList = {
  key: string; // e.g. "tor/exit_nodes"
  source: string;
  description: string;
  ips: string[];
};

export type UserAgentDetails = {
  key: string; // e.g. "claudebot"
  pattern: string; // e.g. "ClaudeBot" (the regex pattern)
};

export type Response = {
  blockedIPAddresses: IPList[];
  allowedIPAddresses: IPList[];
  monitoredIPAddresses: IPList[];
  blockedUserAgents: string;
  monitoredUserAgents: string;
  // `monitoredUserAgents` and `blockedUserAgents` are one big regex pattern
  // If we want to collect stats about the individual user agents,
  // we can loop through the userAgentDetails and match each pattern.
  userAgentDetails: UserAgentDetails[];
};

export async function fetchBlockedLists(token: Token): Promise<Response> {
  const baseUrl = getAPIURL();
  const { body, statusCode } = await fetch({
    url: new URL(`${baseUrl.toString()}api/runtime/firewall/lists`),
    method: "GET",
    headers: {
      // We need to set the Accept-Encoding header to "gzip" to receive the response in gzip format
      "Accept-Encoding": "gzip",
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

  const result: {
    blockedIPAddresses: IPList[];
    allowedIPAddresses: IPList[];
    monitoredIPAddresses: IPList[];
    blockedUserAgents: string;
    monitoredUserAgents: string;
    userAgentDetails: UserAgentDetails[];
  } = JSON.parse(body);

  return {
    blockedIPAddresses:
      result && Array.isArray(result.blockedIPAddresses)
        ? result.blockedIPAddresses
        : [],
    allowedIPAddresses:
      result && Array.isArray(result.allowedIPAddresses)
        ? result.allowedIPAddresses
        : [],
    monitoredIPAddresses:
      result && Array.isArray(result.monitoredIPAddresses)
        ? result.monitoredIPAddresses
        : [],
    // Blocked user agents are stored as a string pattern for usage in a regex (e.g. "Googlebot|Bingbot")
    blockedUserAgents:
      result && typeof result.blockedUserAgents === "string"
        ? result.blockedUserAgents
        : "",
    // Monitored user agents are stored as a string pattern for usage in a regex (e.g. "ClaudeBot|ChatGPTBot")
    monitoredUserAgents:
      result && typeof result.monitoredUserAgents === "string"
        ? result.monitoredUserAgents
        : "",
    userAgentDetails:
      result && Array.isArray(result.userAgentDetails)
        ? result.userAgentDetails
        : [],
  };
}
