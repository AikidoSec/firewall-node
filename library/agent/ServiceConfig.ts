import { BlockList, isIPv4, isIPv6 } from "net";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { Endpoint } from "./Config";
import { addIPAddressToBlocklist } from "../helpers/addIPAddressToBlocklist";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();
  private nonGraphQLEndpoints: Endpoint[] = [];
  private graphqlFields: Endpoint[] = [];
  private blockedIPAddresses = new BlockList();

  constructor(
    endpoints: Endpoint[],
    private lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[],
    private receivedAnyStats: boolean,
    blockedIPAddresses: string[]
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

  isIPAddressBlocked(ip: string) {
    if (isIPv4(ip)) {
      return this.blockedIPAddresses.check(ip, "ipv4");
    }
    if (isIPv6(ip)) {
      return this.blockedIPAddresses.check(ip, "ipv6");
    }
    return false;
  }

  private setBlockedIPAddresses(blockedIPAddresses: string[]) {
    this.blockedIPAddresses = new BlockList();
    blockedIPAddresses.forEach((ip) => {
      addIPAddressToBlocklist(ip, this.blockedIPAddresses);
    });
  }

  updateBlockedIPAddresses(blockedIPAddresses: string[]) {
    this.setBlockedIPAddresses(blockedIPAddresses);
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
