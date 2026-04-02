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

  #getWildcardMatch(hostname: string): Domain["mode"] | undefined {
    const parts = hostname.split(".");
    if (parts.length <= 2) {
      return undefined; // Only check for wildcard matches if there are at least 3 parts (e.g., sub.example.com)
    }

    const wildcardMatch = parts
      .slice(1, -1)
      .map((_, index) =>
        this.#wildcardDomains.get(parts.slice(index + 1).join("."))
      )
      .find((mode) => mode !== undefined);

    return wildcardMatch;
  }

  shouldBlockOutgoingRequest(hostname: string): boolean {
    const wildcardMode = this.#getWildcardMatch(hostname);
    if (wildcardMode !== undefined) {
      return wildcardMode === "block";
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
