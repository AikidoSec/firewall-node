import { Endpoint } from "./api/ReportingAPI";

export class ServiceConfig {
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
}
