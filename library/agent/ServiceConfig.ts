import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { Endpoint } from "./Config";
import { IPList } from "./api/fetchBlockedLists";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  // IP addresses that are allowed to bypass rate limiting, attack blocking, etc.
  private bypassedIPAddresses: Set<string> = new Set();
  private nonGraphQLEndpoints: Endpoint[] = [];
  private graphqlFields: Endpoint[] = [];
  private blockedIPAddresses: { blocklist: IPMatcher; description: string }[] =
    [];
  private blockedUserAgentRegex: RegExp | undefined;
  // If not empty, only ips in this list are allowed to access the service
  // e.g. for country allowlists
  private onlyAllowedIPAddresses: {
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
    onlyAllowedIPAddresses: IPList[]
  ) {
    this.setBlockedUserIds(blockedUserIds);
    this.setBypassedIPAddresses(bypassedIPAddresses);
    this.setEndpoints(endpoints);
    this.setBlockedIPAddresses(blockedIPAddresses);
    this.setOnlyAllowedIPAddresses(onlyAllowedIPAddresses);
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
    this.bypassedIPAddresses = new Set();
    ipAddresses.forEach((ip) => {
      this.bypassedIPAddresses.add(ip);
    });
  }

  isBypassedIP(ip: string) {
    return this.bypassedIPAddresses.has(ip);
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
  ): { blocked: true; reason: string } | { blocked: false } {
    const blocklist = this.blockedIPAddresses.find((blocklist) =>
      blocklist.blocklist.has(ip)
    );

    if (blocklist) {
      return { blocked: true, reason: blocklist.description };
    }

    return { blocked: false };
  }

  private setBlockedIPAddresses(blockedIPAddresses: IPList[]) {
    this.blockedIPAddresses = [];

    for (const source of blockedIPAddresses) {
      this.blockedIPAddresses.push({
        blocklist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateBlockedIPAddresses(blockedIPAddresses: IPList[]) {
    this.setBlockedIPAddresses(blockedIPAddresses);
  }

  updateBlockedUserAgents(blockedUserAgents: string) {
    if (!blockedUserAgents) {
      this.blockedUserAgentRegex = undefined;
      return;
    }
    this.blockedUserAgentRegex = new RegExp(blockedUserAgents, "i");
  }

  isUserAgentBlocked(ua: string): { blocked: boolean } {
    if (this.blockedUserAgentRegex) {
      return { blocked: this.blockedUserAgentRegex.test(ua) };
    }
    return { blocked: false };
  }

  private setOnlyAllowedIPAddresses(ipAddresses: IPList[]) {
    this.onlyAllowedIPAddresses = [];

    for (const source of ipAddresses) {
      // Skip empty allowlists
      if (source.ips.length === 0) {
        continue;
      }
      this.onlyAllowedIPAddresses.push({
        allowlist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateOnlyAllowedIPAddresses(ipAddresses: IPList[]) {
    this.setOnlyAllowedIPAddresses(ipAddresses);
  }

  /**
   * Returns true if only some IP addresses are allowed to access the service, e.g. if a geoip country allowlist is set.
   */
  shouldOnlyAllowSomeIPAddresses() {
    return this.onlyAllowedIPAddresses.length > 0;
  }

  isOnlyAllowedIPAddress(ip: string): { allowed: boolean } {
    const allowlist = this.onlyAllowedIPAddresses.find((list) =>
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
