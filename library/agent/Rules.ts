import { Rule } from "./api/API";

export class Rules {
  private optimised: Map<
    string,
    { method: string; route: string; force_protection_off: boolean }
  > = new Map();

  constructor(rules: Rule[] = []) {
    rules.forEach((rule) => {
      this.optimised.set(this.getKey(rule.method, rule.route), {
        method: rule.method,
        route: rule.route,
        force_protection_off: rule.force_protection_off,
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
        diff.push(rule);
      } else {
        const oldRule = oldRules.optimised.get(key);

        if (
          oldRule &&
          oldRule.force_protection_off !== rule.force_protection_off
        ) {
          diff.push(rule);
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

    return rule.force_protection_off;
  }
}
