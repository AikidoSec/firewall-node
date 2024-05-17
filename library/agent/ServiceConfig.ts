import { Endpoint } from "./Config";

export class ServiceConfig {
  private endpoints: Map<
    string,
    { method: string; route: string; forceProtectionOff: boolean }
  > = new Map();
  private blockedUserIds: Map<string, string> = new Map();

  constructor(
    endpoints: Endpoint[],
    blockedUserIds: string[],
    private readonly lastUpdatedAt: number
  ) {
    endpoints.forEach((rule) => {
      this.endpoints.set(this.getKey(rule.method, rule.route), {
        method: rule.method,
        route: rule.route,
        forceProtectionOff: rule.forceProtectionOff,
      });
    });

    blockedUserIds.forEach((userId) => {
      this.blockedUserIds.set(userId, userId);
    });
  }

  private getKey(method: string, route: string) {
    return `${method}:${route}`;
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
