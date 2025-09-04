import { envToBool } from "./envToBool";

export type TrustProxyResult =
  | { trust: "none" }
  | { trust: "all" }
  | { trust: string[] };

export function trustProxy(): TrustProxyResult {
  if (!process.env.AIKIDO_TRUST_PROXY) {
    // Trust proxy by default
    // Most of the time, the application is behind a reverse proxy
    return { trust: "all" };
  }

  const trustProxyValue = process.env.AIKIDO_TRUST_PROXY;

  // Handle CIDR ranges (e.g., "10.0.0.0/8,172.16.0.0/12")
  if (
    trustProxyValue.includes("/") ||
    trustProxyValue.includes(",") ||
    trustProxyValue.includes(".")
  ) {
    const networks = trustProxyValue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return { trust: networks };
  }

  return envToBool(trustProxyValue) ? { trust: "all" } : { trust: "none" };
}
