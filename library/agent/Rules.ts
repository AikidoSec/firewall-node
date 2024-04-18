import { Rule } from "./api/API";

export class Rules {
  private optimised: Map<
    string,
    { method: string; route: string; forceProtectionOff: boolean }
  > = new Map();

  constructor(rules: Rule[] = []) {
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

  diff(oldRules: Rules): Rule[] {
    const diff: Rule[] = [];
    oldRules.optimised.forEach((rule, key) => {
      if (!this.optimised.has(key)) {
        diff.push(rule);
      }
    });

    this.optimised.forEach((rule, key) => {
      if (!oldRules.optimised.has(key)) {
        diff.push({
          method: rule.method,
          route: rule.route,
          forceProtectionOff: rule.forceProtectionOff,
        });
      } else {
        const oldRule = oldRules.optimised.get(key);

        if (oldRule && oldRule.forceProtectionOff !== rule.forceProtectionOff) {
          diff.push({
            method: rule.method,
            route: rule.route,
            forceProtectionOff: rule.forceProtectionOff,
          });
        }
      }
    });

    return diff;
  }

  shouldIgnore(method: string, route: string | RegExp) {
    const key = this.getKey(
      method,
      typeof route === "string" ? route : route.source
    );
    const rule = this.optimised.get(key);

    if (!rule) {
      return true;
    }

    return rule.forceProtectionOff;
  }
}
