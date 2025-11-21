import type { Token } from "./Token";

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

export type FetchListsAPIResponse = {
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

export interface FetchListsAPI {
  getLists(token: Token): Promise<FetchListsAPIResponse>;
}
