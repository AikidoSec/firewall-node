import { BlockList, isIPv4, isIPv6 } from "net";
import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { Endpoint } from "./Config";
import { addIPAddressToBlocklist } from "../helpers/addIPAddressToBlocklist";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();
  private readonly nonGraphQLEndpoints: Endpoint[];
  private readonly graphqlFields: Endpoint[];
  private blockedIPAddresses = new BlockList();

  constructor(
    endpoints: Endpoint[],
    private readonly lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[],
    private readonly receivedAnyStats: boolean,
    blockedIPAddresses: string[]
  ) {
    blockedUserIds.forEach((userId) => {
      this.blockedUserIds.set(userId, userId);
    });

    allowedIPAddresses.forEach((ip) => {
      this.allowedIPAddresses.set(ip, ip);
    });

    this.nonGraphQLEndpoints = endpoints.filter(
      (endpoint) => !endpoint.graphql
    );
    this.graphqlFields = endpoints.filter((endpoint) =>
      endpoint.graphql ? true : false
    );

    blockedIPAddresses.forEach((ip) => {
      addIPAddressToBlocklist(ip, this.blockedIPAddresses);
    });
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

  isAllowedIP(ip: string) {
    return this.allowedIPAddresses.has(ip);
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

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  }

  hasReceivedAnyStats() {
    return this.receivedAnyStats;
  }
}
