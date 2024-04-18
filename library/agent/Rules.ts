import { Rule } from "./api/API";

export class Rules {
  private optimised: Map<
    string,
    { method: string; route: string; forceProtectionOff: boolean }
  > = new Map();

  constructor(rules: Rule[]) {
    rules.forEach((rule) => {
      this.optimised.set(this.getKey(rule.method, rule.route), {
        method: rule.method,
        route: rule.route,
        forceProtectionOff: rule.forceProtectionOff,
      });
    });
  }

  private getKey(method: string, route: string) {
    return `${method}:${route}`;
  }

  hasChanges(oldRules: Rules): boolean {
    for (const rule of oldRules.optimised.values()) {
      if (!this.optimised.has(this.getKey(rule.method, rule.route))) {
        return true;
      }
    }

    for (const rule of this.optimised.values()) {
      const oldRule = oldRules.optimised.get(
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
    const rule = this.optimised.get(key);

    if (!rule) {
      return false;
    }

    return rule.forceProtectionOff;
  }
}
