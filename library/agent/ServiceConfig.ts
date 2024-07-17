import {
  LimitedContext,
  matchEndpoint,
  Matcher,
} from "../helpers/matchEndpoint";
import { Endpoint } from "./Config";

export class ServiceConfig {
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();

  constructor(
    private readonly endpoints: Endpoint[],
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
  }

  getEndpoint(context: LimitedContext, matcher: Matcher) {
    return matchEndpoint(context, this.endpoints, matcher);
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
