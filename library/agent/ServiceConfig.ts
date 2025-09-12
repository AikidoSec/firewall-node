import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import { Context, updateContext } from "./Context";
import type { Endpoint, EndpointConfig } from "./Config";
import { IPList, UserAgentDetails } from "./api/FetchListsAPI";
import { safeCreateRegExp } from "./safeCreateRegExp";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  // IP addresses that are allowed to bypass rate limiting, attack blocking, etc.
  private bypassedIPAddresses: IPMatcher | undefined;
  private nonGraphQLEndpoints: Endpoint[] = [];
  private graphqlFields: Endpoint[] = [];
  private blockedIPAddresses: {
    blocklist: IPMatcher;
    description: string;
    key: string;
  }[] = [];
  private blockedUserAgentRegex: RegExp | undefined;
  // If not empty, only ips in this list are allowed to access the service
  // e.g. for country allowlists
  private allowedIPAddresses: {
    allowlist: IPMatcher;
    description: string;
  }[] = [];
  private monitoredIPAddresses: { list: IPMatcher; key: string }[] = [];
  private monitoredUserAgentRegex: RegExp | undefined;
  private userAgentDetails: { pattern: RegExp; key: string }[] = [];

  constructor(
    endpoints: EndpointConfig[],
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

  private setEndpoints(endpointConfigs: EndpointConfig[]) {
    this.nonGraphQLEndpoints = [];
    this.graphqlFields = [];

    for (const endpoint of endpointConfigs) {
      let allowedIPAddresses = undefined;
      if (
        Array.isArray(endpoint.allowedIPAddresses) &&
        endpoint.allowedIPAddresses.length > 0
      ) {
        allowedIPAddresses = new IPMatcher(endpoint.allowedIPAddresses);
      }

      const endpointConfig = { ...endpoint, allowedIPAddresses };

      if (endpoint.graphql) {
        this.graphqlFields.push(endpointConfig);
      } else {
        this.nonGraphQLEndpoints.push(endpointConfig);
      }
    }
  }

  getEndpoints(context: Context): Endpoint[] {
    if (context.cachedMatchingEndpoints) {
      return context.cachedMatchingEndpoints;
    }
    const endpoints = matchEndpoints(context, this.nonGraphQLEndpoints);
    // Cache the endpoints to avoid re-running the matchEndpoints function
    updateContext(context, "cachedMatchingEndpoints", endpoints);
    return endpoints;
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
        key: source.key,
        blocklist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateBlockedIPAddresses(blockedIPAddresses: IPList[]) {
    this.setBlockedIPAddresses(blockedIPAddresses);
  }

  updateMonitoredIPAddresses(monitoredIPAddresses: IPList[]) {
    this.monitoredIPAddresses = [];

    for (const source of monitoredIPAddresses) {
      this.monitoredIPAddresses.push({
        key: source.key,
        list: new IPMatcher(source.ips),
      });
    }
  }

  updateBlockedUserAgents(blockedUserAgents: string) {
    if (!blockedUserAgents) {
      // If an empty string is passed, we want to set the regex to undefined
      // e.g. new RegExp("").test("abc") == true
      this.blockedUserAgentRegex = undefined;
      return;
    }
    this.blockedUserAgentRegex = safeCreateRegExp(blockedUserAgents, "i");
  }

  isUserAgentBlocked(ua: string): { blocked: boolean } {
    if (this.blockedUserAgentRegex) {
      return { blocked: this.blockedUserAgentRegex.test(ua) };
    }
    return { blocked: false };
  }

  updateUserAgentDetails(userAgentDetails: UserAgentDetails[]) {
    this.userAgentDetails = [];
    for (const detail of userAgentDetails) {
      const regex = safeCreateRegExp(detail.pattern, "i");
      if (regex) {
        this.userAgentDetails.push({
          key: detail.key,
          pattern: regex,
        });
      }
    }
  }

  updateMonitoredUserAgents(monitoredUserAgent: string) {
    if (!monitoredUserAgent) {
      // If an empty string is passed, we want to set the regex to undefined
      // e.g. new RegExp("").test("abc") == true
      this.monitoredUserAgentRegex = undefined;
      return;
    }

    this.monitoredUserAgentRegex = safeCreateRegExp(monitoredUserAgent, "i");
  }

  isMonitoredUserAgent(ua: string): boolean {
    if (this.monitoredUserAgentRegex) {
      return this.monitoredUserAgentRegex.test(ua);
    }
    return false;
  }

  getMatchingUserAgentKeys(ua: string): string[] {
    return this.userAgentDetails
      .filter((details) => details.pattern.test(ua))
      .map((details) => details.key);
  }

  getMatchingBlockedIPListKeys(ip: string): string[] {
    return this.blockedIPAddresses
      .filter((list) => list.blocklist.has(ip))
      .map((list) => list.key);
  }

  getMatchingMonitoredIPListKeys(ip: string): string[] {
    return this.monitoredIPAddresses
      .filter((list) => list.list.has(ip))
      .map((list) => list.key);
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
    endpoints: EndpointConfig[],
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
