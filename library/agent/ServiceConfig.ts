import { Endpoint } from "./Config";

export class ServiceConfig {
  private endpoints: Map<string, Endpoint> = new Map();
  private blockedUserIds: Map<string, string> = new Map();
  private allowedIPAddresses: Map<string, string> = new Map();

  constructor(
    endpoints: Endpoint[],
    private readonly lastUpdatedAt: number,
    blockedUserIds: string[],
    allowedIPAddresses: string[]
  ) {
    endpoints.forEach((rule) => {
      this.endpoints.set(this.getKey(rule.method, rule.route), {
        method: rule.method,
        route: rule.route,
        forceProtectionOff: rule.forceProtectionOff,
        rateLimiting: rule.rateLimiting,
      });
    });

    blockedUserIds.forEach((userId) => {
      this.blockedUserIds.set(userId, userId);
    });

    allowedIPAddresses.forEach((ip) => {
      this.allowedIPAddresses.set(ip, ip);
    });
  }

  private getKey(method: string, route: string) {
    return `${method}:${route}`;
  }

  getRateLimiting(method: string, route: string | RegExp) {
    const key = this.getKey(
      method,
      typeof route === "string" ? route : route.source
    );

    const rule = this.endpoints.get(key);

    if (!rule || !rule.rateLimiting) {
      return undefined;
    }

    return rule.rateLimiting;
  }

  isAllowedIP(ip: string) {
    return this.allowedIPAddresses.has(ip);
  }

  shouldProtectEndpoint(method: string, route: string | RegExp) {
    const key = this.getKey(
      method,
      typeof route === "string" ? route : route.source
    );

    const rule = this.endpoints.get(key);

    if (!rule) {
      return true;
    }

    return !rule.forceProtectionOff;
  }

  isUserBlocked(userId: string) {
    return this.blockedUserIds.has(userId);
  }

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  }
}
