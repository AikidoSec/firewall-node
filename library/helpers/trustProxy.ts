import { IPMatcher } from "../helpers/ip-matcher/IPMatcher";
import { envToBool } from "./envToBool";

export type TrustProxyConfig =
  | { type: "boolean"; value: boolean }
  | { type: "cidr"; matcher: IPMatcher }
  | { type: "count"; value: number };

let cached: TrustProxyConfig | undefined;

export function clearTrustProxyCache(): void {
  cached = undefined;
}

export function getTrustProxyConfig(): TrustProxyConfig {
  if (cached !== undefined) {
    return cached;
  }
  cached = parseTrustProxy(process.env.AIKIDO_TRUST_PROXY);
  return cached;
}

export function trustProxy(): boolean {
  const config = getTrustProxyConfig();
  return config.type !== "boolean" || config.value;
}

function parseTrustProxy(value: string | undefined): TrustProxyConfig {
  if (!value) {
    // Default to true if not set
    return { type: "boolean", value: true };
  }

  if (/^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    if (n > 0) {
      return { type: "count", value: n };
    }
  }

  // We know that the value is set, so we can check for truthy values
  if (envToBool(value)) {
    return { type: "boolean", value: true };
  }

  // Looks like it contains IP addresses
  if (value.includes(".") || value.includes(":")) {
    const ranges = value
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    return { type: "cidr", matcher: new IPMatcher(ranges) };
  }

  return { type: "boolean", value: false };
}
