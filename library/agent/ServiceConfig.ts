import { addIPv4MappedAddresses } from "../helpers/addIPv4MappedAddresses";
import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import type { Endpoint, EndpointConfig, Domain } from "./Config";
import type { IPList, UserAgentDetails } from "./api/FetchListsAPI";
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

  private blockNewOutgoingRequests = false;
  private domains = new Map<string, Domain["mode"]>();

  constructor(
    endpoints: EndpointConfig[],
    private lastUpdatedAt: number,
    blockedUserIds: string[],
    bypassedIPAddresses: string[],
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
      let allowedIPAddresses: IPMatcher | undefined = undefined;
      if (
        Array.isArray(endpoint.allowedIPAddresses) &&
        endpoint.allowedIPAddresses.length > 0
      ) {
        // Small list, frequently accessed: add IPv4-mapped versions at creation time for fast lookups
        const matcher = new IPMatcher();
        for (const ip of addIPv4MappedAddresses(endpoint.allowedIPAddresses)) {
          matcher.add(ip);
        }
        allowedIPAddresses = matcher;
      }

      const endpointConfig = { ...endpoint, allowedIPAddresses };

      if (endpoint.graphql) {
        this.graphqlFields.push(endpointConfig);
      } else {
        this.nonGraphQLEndpoints.push(endpointConfig);
      }
    }
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
    // Small list, frequently accessed: add IPv4-mapped versions at creation time for fast lookups
    const matcher = new IPMatcher();
    for (const ip of addIPv4MappedAddresses(ipAddresses)) {
      matcher.add(ip);
    }
    this.bypassedIPAddresses = matcher;
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
    const blocklist = this.blockedIPAddresses.find((list) =>
      list.blocklist.hasWithMappedCheck(ip)
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
        // Large list: IPv4-mapped checked at lookup time to save memory
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
        // Large list: IPv4-mapped checked at lookup time to save memory
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
      .filter((list) => list.blocklist.hasWithMappedCheck(ip))
      .map((list) => list.key);
  }

  getMatchingMonitoredIPListKeys(ip: string): string[] {
    return this.monitoredIPAddresses
      .filter((list) => list.list.hasWithMappedCheck(ip))
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
        // Large list: IPv4-mapped checked at lookup time to save memory
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
      list.allowlist.hasWithMappedCheck(ip)
    );

    return { allowed: !!allowlist };
  }

  updateConfig(
    endpoints: EndpointConfig[],
    lastUpdatedAt: number,
    blockedUserIds: string[],
    bypassedIPAddresses: string[]
  ) {
    this.setEndpoints(endpoints);
    this.setBlockedUserIds(blockedUserIds);
    this.setBypassedIPAddresses(bypassedIPAddresses);
    this.lastUpdatedAt = lastUpdatedAt;
  }

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  }

  setBlockNewOutgoingRequests(block: boolean) {
    this.blockNewOutgoingRequests = block;
  }

  updateDomains(domains: Domain[]) {
    this.domains = new Map(domains.map((i) => [i.hostname, i.mode]));
  }

  shouldBlockOutgoingRequest(hostname: string): boolean {
    const mode = this.domains.get(hostname);

    if (this.blockNewOutgoingRequests) {
      // Only allow outgoing requests if the mode is "allow"
      // mode is undefined for unknown hostnames, so they get blocked
      return mode !== "allow";
    }

    // Only block outgoing requests if the mode is "block"
    return mode === "block";
  }
}
