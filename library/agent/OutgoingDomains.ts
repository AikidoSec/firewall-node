import type { Domain } from "./Config";

export class OutgoingDomains {
  #domains: Map<string, Domain["mode"]> = new Map();
  #wildcardDomains: Map<string, Domain["mode"]> = new Map();
  #blockNewOutgoingRequests = false;

  constructor(
    domains: Domain[] = [],
    blockNewOutgoingRequests: boolean = false
  ) {
    this.#blockNewOutgoingRequests = blockNewOutgoingRequests;

    for (const domain of domains) {
      if (domain.hostname.startsWith("*.")) {
        this.#wildcardDomains.set(domain.hostname.slice(2), domain.mode);
      } else {
        this.#domains.set(domain.hostname, domain.mode);
      }
    }
  }

  getWildcardMatch(
    hostname: string
  ): { domain: string; mode: Domain["mode"] } | undefined {
    const parts = hostname.split(".");
    if (parts.length <= 2) {
      // Only check for wildcard matches if there are at least 3 parts (e.g., sub.example.com)
      return undefined;
    }

    return parts
      .slice(1, -1)
      .map((_, index) => {
        const suffix = parts.slice(index + 1).join(".");
        const mode = this.#wildcardDomains.get(suffix);
        return mode !== undefined ? { domain: "*." + suffix, mode } : undefined;
      })
      .find((match) => match !== undefined);
  }

  shouldBlockOutgoingRequest(hostname: string): boolean {
    const wildcardMatch = this.getWildcardMatch(hostname);
    if (wildcardMatch !== undefined) {
      return wildcardMatch.mode === "block";
    }

    const mode = this.#domains.get(hostname);

    if (this.#blockNewOutgoingRequests) {
      // Only allow outgoing requests if the mode is "allow"
      // mode is undefined for unknown hostnames, so they get blocked
      return mode !== "allow";
    }

    // Only block outgoing requests if the mode is "block"
    return mode === "block";
  }
}
