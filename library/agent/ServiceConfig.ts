import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import { Endpoint } from "./Config";
import { IPList, AgentBlockList } from "./api/fetchBlockedLists";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  // IP addresses that are allowed to bypass rate limiting, attack blocking, etc.
  private bypassedIPAddresses: IPMatcher | undefined;
  private nonGraphQLEndpoints: Endpoint[] = [];
  private graphqlFields: Endpoint[] = [];
  private blockedIPAddresses: {
    key: string;
    blocklist: IPMatcher;
    description: string;
  }[] = [];
  private blockedUserAgentRegex: {
    key: string;
    pattern: RegExp;
  }[] = [];
  // If not empty, only ips in this list are allowed to access the service
  // e.g. for country allowlists
  private allowedIPAddresses: {
    allowlist: IPMatcher;
    description: string;
  }[] = [];

  constructor(
    endpoints: Endpoint[],
    private lastUpdatedAt: number,
    blockedUserIds: string[],
    bypassedIPAddresses: string[],
    private receivedAnyStats: boolean,
    blockedIPAddresses: IPList[],
    allowedIPAddresses: IPList[]
  ) {
    this.setBlockedUserIds(blockedUserIds);
    this.setBypassedIPAddresses(bypassedIPAddresses);
    this.setEndpoints(endpoints);
    this.setBlockedIPAddresses(blockedIPAddresses);
    this.setAllowedIPAddresses(allowedIPAddresses);
  }

  private setEndpoints(endpoints: Endpoint[]) {
    this.nonGraphQLEndpoints = endpoints.filter(
      (endpoint) => !endpoint.graphql
    );
    this.graphqlFields = endpoints.filter((endpoint) =>
      endpoint.graphql ? true : false
    );
  }

  getEndpoints(context: LimitedContext) {
    return matchEndpoints(context, this.nonGraphQLEndpoints);
  }

  getGraphQLField(
    context: LimitedContext,
    name: string,
    operationType: string
  ) {
    const endpoints = matchEndpoints(
      context,
      this.graphqlFields.filter((field) => {
        if (!field.graphql) {
          return false;
        }

        return (
          field.graphql.name === name && field.graphql.type === operationType
        );
      })
    );

    return endpoints.length > 0 ? endpoints[0] : undefined;
  }

  private setBypassedIPAddresses(ipAddresses: string[]) {
    if (ipAddresses.length === 0) {
      this.bypassedIPAddresses = undefined;
      return;
    }
    this.bypassedIPAddresses = new IPMatcher(ipAddresses);
  }

  isBypassedIP(ip: string) {
    return this.bypassedIPAddresses ? this.bypassedIPAddresses.has(ip) : false;
  }

  private setBlockedUserIds(blockedUserIds: string[]) {
    this.blockedUserIds = new Map();
    blockedUserIds.forEach((userId) => {
      this.blockedUserIds.set(userId, userId);
    });
  }

  isUserBlocked(userId: string) {
    return this.blockedUserIds.has(userId);
  }

  isIPAddressBlocked(
    ip: string
  ): { blocked: true; reason: string; key: string } | { blocked: false } {
    const blocklist = this.blockedIPAddresses.find((blocklist) =>
      blocklist.blocklist.has(ip)
    );

    if (blocklist) {
      return {
        blocked: true,
        reason: blocklist.description,
        key: blocklist.key,
      };
    }

    return { blocked: false };
  }

  private setBlockedIPAddresses(blockedIPAddresses: IPList[]) {
    this.blockedIPAddresses = [];

    for (const source of blockedIPAddresses) {
      this.blockedIPAddresses.push({
        key: source.key,
        blocklist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateBlockedIPAddresses(blockedIPAddresses: IPList[]) {
    this.setBlockedIPAddresses(blockedIPAddresses);
  }

  private setBlockedUserAgents(blockedUserAgents: AgentBlockList[]) {
    this.blockedUserAgentRegex = blockedUserAgents
      .filter(
        (list) => typeof list.pattern === "string" && list.pattern.length > 0
      )
      .map((list) => {
        return {
          key: list.key,
          pattern: new RegExp(list.pattern, "i"),
        };
      });
  }

  updateBlockedUserAgents(blockedUserAgents: AgentBlockList[]) {
    this.setBlockedUserAgents(blockedUserAgents);
  }

  isUserAgentBlocked(
    ua: string
  ): { blocked: false } | { blocked: true; key: string } {
    for (const blocklist of this.blockedUserAgentRegex) {
      if (blocklist.pattern.test(ua)) {
        return { blocked: true, key: blocklist.key };
      }
    }

    return { blocked: false };
  }

  private setAllowedIPAddresses(ipAddresses: IPList[]) {
    this.allowedIPAddresses = [];

    for (const source of ipAddresses) {
      // Skip empty allowlists
      if (source.ips.length === 0) {
        continue;
      }
      this.allowedIPAddresses.push({
        allowlist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateAllowedIPAddresses(ipAddresses: IPList[]) {
    this.setAllowedIPAddresses(ipAddresses);
  }

  isAllowedIPAddress(ip: string): { allowed: boolean } {
    if (this.allowedIPAddresses.length < 1) {
      return { allowed: true };
    }

    // Always allow access from local IP addresses
    if (isPrivateIP(ip)) {
      return { allowed: true };
    }

    const allowlist = this.allowedIPAddresses.find((list) =>
      list.allowlist.has(ip)
    );

    return { allowed: !!allowlist };
  }

  updateConfig(
    endpoints: Endpoint[],
    lastUpdatedAt: number,
    blockedUserIds: string[],
    bypassedIPAddresses: string[],
    hasReceivedAnyStats: boolean
  ) {
    this.setEndpoints(endpoints);
    this.setBlockedUserIds(blockedUserIds);
    this.setBypassedIPAddresses(bypassedIPAddresses);
    this.lastUpdatedAt = lastUpdatedAt;
    this.receivedAnyStats = hasReceivedAnyStats;
  }

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  }

  hasReceivedAnyStats() {
    return this.receivedAnyStats;
  }
}
