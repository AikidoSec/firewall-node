import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { Endpoint } from "./Config";
import {
  IPBlocklist as BlocklistType,
  AgentBlockList,
} from "./api/fetchBlockedLists";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();
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

  constructor(
    endpoints: Endpoint[],
    private lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[],
    private receivedAnyStats: boolean,
    blockedIPAddresses: BlocklistType[]
  ) {
    this.setBlockedUserIds(blockedUserIds);
    this.setAllowedIPAddresses(allowedIPAddresses);
    this.setEndpoints(endpoints);
    this.setBlockedIPAddresses(blockedIPAddresses);
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

  private setAllowedIPAddresses(allowedIPAddresses: string[]) {
    this.allowedIPAddresses = new Map();
    allowedIPAddresses.forEach((ip) => {
      this.allowedIPAddresses.set(ip, ip);
    });
  }

  isAllowedIP(ip: string) {
    return this.allowedIPAddresses.has(ip);
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

  private setBlockedIPAddresses(blockedIPAddresses: BlocklistType[]) {
    this.blockedIPAddresses = [];

    for (const source of blockedIPAddresses) {
      this.blockedIPAddresses.push({
        key: source.key,
        blocklist: new IPMatcher(source.ips),
        description: source.description,
      });
    }
  }

  updateBlockedIPAddresses(blockedIPAddresses: BlocklistType[]) {
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

  updateConfig(
    endpoints: Endpoint[],
    lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[],
    hasReceivedAnyStats: boolean
  ) {
    this.setEndpoints(endpoints);
    this.setBlockedUserIds(blockedUserIds);
    this.setAllowedIPAddresses(allowedIPAddresses);
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
