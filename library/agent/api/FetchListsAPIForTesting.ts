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
      domains: [],
    }
  ) {}

  // oxlint-disable-next-line require-await
  async getLists(_token: Token): Promise<FetchListsAPIResponse> {
    return this.response;
  }
}
