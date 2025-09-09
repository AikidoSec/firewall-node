import { FetchListsAPI, FetchListsAPIResponse } from "./FetchListsAPI";
import type { Token } from "./Token";

export class FetchListsAPIForTesting implements FetchListsAPI {
  constructor(
    private response: FetchListsAPIResponse = {
      blockedIPAddresses: [],
      allowedIPAddresses: [],
      monitoredIPAddresses: [],
      blockedUserAgents: "",
      monitoredUserAgents: "",
      userAgentDetails: [],
    }
  ) {}

  async fetch(_token: Token): Promise<FetchListsAPIResponse> {
    return this.response;
  }
}
