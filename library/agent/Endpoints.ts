import { Endpoint } from "./api/API";

export class Endpoints {
  private endpoints: Map<
    string,
    { method: string; route: string; forceProtectionOff: boolean }
  > = new Map();

  constructor(endpoints: Endpoint[]) {
    endpoints.forEach((rule) => {
      this.endpoints.set(this.getKey(rule.method, rule.route), {
        method: rule.method,
        route: rule.route,
        forceProtectionOff: rule.forceProtectionOff,
      });
    });
  }

  private getKey(method: string, route: string) {
    return `${method}:${route}`;
  }

  hasChanges(oldEndpoints: Endpoints): boolean {
    for (const rule of oldEndpoints.endpoints.values()) {
      if (!this.endpoints.has(this.getKey(rule.method, rule.route))) {
        return true;
      }
    }

    for (const rule of this.endpoints.values()) {
      const oldRule = oldEndpoints.endpoints.get(
        this.getKey(rule.method, rule.route)
      );

      if (!oldRule) {
        return true;
      }

      if (oldRule.forceProtectionOff !== rule.forceProtectionOff) {
        return true;
      }
    }

    return false;
  }

  shouldIgnore(method: string, route: string | RegExp) {
    const key = this.getKey(
      method,
      typeof route === "string" ? route : route.source
    );
    const rule = this.endpoints.get(key);

    if (!rule) {
      return false;
    }

    return rule.forceProtectionOff;
  }
}
