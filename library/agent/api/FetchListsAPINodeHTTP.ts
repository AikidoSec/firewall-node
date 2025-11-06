import { fetch } from "../../helpers/fetch";
import { getAPIURL } from "../getAPIURL";
import { FetchListsAPI, FetchListsAPIResponse } from "./FetchListsAPI";
import type { Token } from "./Token";

export class FetchListsAPINodeHTTP implements FetchListsAPI {
  constructor(private baseUrl = getAPIURL()) {}

  async getLists(token: Token): Promise<FetchListsAPIResponse> {
    const { body, statusCode } = await fetch({
      url: new URL(`${this.baseUrl.toString()}api/runtime/firewall/lists`),
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

    return this.toAPIResponse(body);
  }

  private toAPIResponse(data: string): FetchListsAPIResponse {
    const result = JSON.parse(data);

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
      domains: result && Array.isArray(result.domains) ? result.domains : [],
    };
  }
}
