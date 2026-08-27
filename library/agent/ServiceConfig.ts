import { addIPv4MappedAddresses } from "../helpers/addIPv4MappedAddresses";
import { hostnameToUnicode } from "../helpers/hostnameToUnicode";
import { IPMatcher as JavaScriptIPMatcher } from "../helpers/ip-matcher/IPMatcher";
import {
  createIPMatcher,
  type IPMatcher,
} from "../helpers/ip-matcher/createIPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { normalizeHostname } from "../helpers/normalizeHostname";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import type { Endpoint, EndpointConfig, Domain } from "./Config";
import type {
  FetchListsAPIResponse,
  UserAgentDetails,
} from "./api/FetchListsAPI";
import { safeCreateRegExp } from "./safeCreateRegExp";
import type { Context } from "./Context";

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

  private excludedUserIdsFromRateLimiting = new Set<string>();

  private enabledFeatures = new Set<string>();

  constructor(
    endpoints: EndpointConfig[],
    private lastUpdatedAt: number,
    blockedUserIds: string[],
    bypassedIPAddresses: string[]
  ) {
    this.setBlockedUserIds(blockedUserIds);
    this.setBypassedIPAddresses(bypassedIPAddresses);
    this.setEndpoints(endpoints);
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
        allowedIPAddresses = new JavaScriptIPMatcher(
          addIPv4MappedAddresses(endpoint.allowedIPAddresses)
        );
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
    this.bypassedIPAddresses = new JavaScriptIPMatcher(
      addIPv4MappedAddresses(ipAddresses)
    );
  }

  isBypassedRequest(context: Context | undefined): boolean {
    if (!context) {
      return false;
    }

    if (context.bypassRequest) {
      return true;
    }

    if (!context.remoteAddress) {
      return false;
    }

    return this.isBypassedIP(context.remoteAddress);
  }

  isBypassedIP(ip: string): boolean {
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

  async updateFirewallLists({
    blockedIPAddresses,
    blockedUserAgents,
    allowedIPAddresses,
    monitoredIPAddresses,
    monitoredUserAgents,
    userAgentDetails,
  }: FetchListsAPIResponse): Promise<void> {
    const nextBlockedIPAddresses: {
      blocklist: IPMatcher;
      description: string;
      key: string;
    }[] = [];
    for (const source of blockedIPAddresses) {
      nextBlockedIPAddresses.push({
        key: source.key,
        blocklist: await createIPMatcher(source.ips),
        description: source.description,
      });
    }

    const nextAllowedIPAddresses: {
      allowlist: IPMatcher;
      description: string;
    }[] = [];
    for (const source of allowedIPAddresses) {
      if (source.ips.length === 0) {
        continue;
      }
      nextAllowedIPAddresses.push({
        allowlist: await createIPMatcher(source.ips),
        description: source.description,
      });
    }

    const nextMonitoredIPAddresses: {
      list: IPMatcher;
      key: string;
    }[] = [];
    for (const source of monitoredIPAddresses) {
      nextMonitoredIPAddresses.push({
        key: source.key,
        list: await createIPMatcher(source.ips),
      });
    }

    const nextBlockedUserAgentRegex = blockedUserAgents
      ? safeCreateRegExp(blockedUserAgents, "i")
      : undefined;
    const nextMonitoredUserAgentRegex = monitoredUserAgents
      ? safeCreateRegExp(monitoredUserAgents, "i")
      : undefined;
    const nextUserAgentDetails: { pattern: RegExp; key: string }[] = [];
    for (const detail of userAgentDetails) {
      const regex = safeCreateRegExp(detail.pattern, "i");
      if (regex) {
        nextUserAgentDetails.push({
          key: detail.key,
          pattern: regex,
        });
      }
    }

    this.blockedIPAddresses = nextBlockedIPAddresses;
    this.allowedIPAddresses = nextAllowedIPAddresses;
    this.monitoredIPAddresses = nextMonitoredIPAddresses;
    this.blockedUserAgentRegex = nextBlockedUserAgentRegex;
    this.monitoredUserAgentRegex = nextMonitoredUserAgentRegex;
    this.userAgentDetails = nextUserAgentDetails;
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
    const mode = this.domains.get(
      hostnameToUnicode(normalizeHostname(hostname))
    );

    if (this.blockNewOutgoingRequests) {
      // Only allow outgoing requests if the mode is "allow"
      // mode is undefined for unknown hostnames, so they get blocked
      return mode !== "allow";
    }

    // Only block outgoing requests if the mode is "block"
    return mode === "block";
  }

  updateUsersExcludedFromRateLimiting(userIds: string[]) {
    this.excludedUserIdsFromRateLimiting = new Set(userIds);
  }

  isUserExcludedFromRateLimiting(userId: string): boolean {
    return this.excludedUserIdsFromRateLimiting.has(userId);
  }

  updateEnabledFeatures(features: string[]) {
    this.enabledFeatures = new Set(features);
  }

  isRealtimeUpdatesEnabled(): boolean {
    return this.enabledFeatures.has("realtime_updates");
  }
}
