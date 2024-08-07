import { LimitedContext, matchEndpoints } from "../helpers/matchEndpoints";
import { Endpoint } from "./Config";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();
  private readonly nonGraphQLEndpoints: Endpoint[];
  private readonly graphqlFields: Endpoint[];

  constructor(
    endpoints: Endpoint[],
    private readonly lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[]
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

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  }
}
