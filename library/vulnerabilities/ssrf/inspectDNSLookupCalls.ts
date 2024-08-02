import { isIP } from "net";
import { LookupAddress } from "dns";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { getContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { isPlainObject } from "../../helpers/isPlainObject";
import { isPrivateIP } from "./isPrivateIP";
import { isIMDSIPAddress, isTrustedHostname } from "./imds";
import { RequestContextStorage } from "../../sinks/undici/RequestContextStorage";
import { findHostnameInContext } from "./findHostnameInContext";
import { getRedirectOrigin } from "./getRedirectOrigin";

export function inspectDNSLookupCalls(
  lookup: Function,
  agent: Agent,
  module: string,
  operation: string,
  port?: number
): Function {
  return function inspectDNSLookup(...args: unknown[]) {
    const hostname =
      args.length > 0 && typeof args[0] === "string" ? args[0] : undefined;
    const callback = args.find((arg) => typeof arg === "function");

    // If the hostname is an IP address, or if the callback is missing, we don't need to inspect the resolved IPs
    if (!hostname || isIP(hostname) || !callback) {
      return lookup(...args);
    }

    const options = args.find((arg) => isPlainObject(arg)) as
      | Record<string, unknown>
      | undefined;

    const argsToApply = options
      ? [
          hostname,
          options,
          wrapDNSLookupCallback(
            callback as Function,
            hostname,
            module,
            agent,
            operation,
            port
          ),
        ]
      : [
          hostname,
          wrapDNSLookupCallback(
            callback as Function,
            hostname,
            module,
            agent,
            operation,
            port
          ),
        ];

    lookup(...argsToApply);
  };
}

// eslint-disable-next-line max-lines-per-function
function wrapDNSLookupCallback(
  callback: Function,
  hostname: string,
  module: string,
  agent: Agent,
  operation: string,
  portArg?: number
): Function {
  // eslint-disable-next-line max-lines-per-function
  return function wrappedDNSLookupCallback(
    err: Error,
    addresses: string | LookupAddress[],
    family: number
  ) {
    if (err) {
      return callback(err);
    }

    const context = getContext();

    if (context) {
      const endpoint = agent.getConfig().getEndpoint(context);

      if (endpoint && endpoint.endpoint.forceProtectionOff) {
        // User disabled protection for this endpoint, we don't need to inspect the resolved IPs
        // Just call the original callback to allow the DNS lookup
        return callback(err, addresses, family);
      }
    }

    const resolvedIPAddresses = getResolvedIPAddresses(addresses);

    if (resolvesToIMDSIP(resolvedIPAddresses, hostname)) {
      // Block stored SSRF attack that target IMDS IP addresses
      // An attacker could have stored a hostname in a database that points to an IMDS IP address
      // We don't check if the user input contains the hostname because there's no context
      if (agent.shouldBlock()) {
        return callback(
          new Error(
            `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from unknown source`
          )
        );
      }
    }

    if (!context) {
      // If there's no context, we can't check if the hostname is in the context
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    // This is set if this resolve is part of an outgoing request that we are inspecting
    const requestContext = RequestContextStorage.getStore();

    let port: number | undefined;

    if (portArg) {
      port = portArg;
    } else {
      if (requestContext) {
        port = requestContext.port;
      }
    }

    const privateIP = resolvedIPAddresses.find(isPrivateIP);

    if (!privateIP) {
      // If the hostname doesn't resolve to a private IP address, it's not an SSRF attack
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    let found = findHostnameInContext(hostname, context, port);

    if (!found && requestContext && context.outgoingRequestRedirects) {
      const redirectOrigin = getRedirectOrigin(
        context.outgoingRequestRedirects,
        requestContext.url
      );

      if (redirectOrigin) {
        found = findHostnameInContext(
          redirectOrigin.hostname,
          context,
          parseInt(redirectOrigin.port, 10)
        );
      }
    }

    if (!found) {
      // If we can't find the hostname in the context, it's not an SSRF attack
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    agent.onDetectedAttack({
      module: module,
      operation: operation,
      kind: "ssrf",
      source: found.source,
      blocked: agent.shouldBlock(),
      stack: new Error().stack!,
      path: found.pathToPayload,
      metadata: {},
      request: context,
      payload: found.payload,
    });

    if (agent.shouldBlock()) {
      return callback(
        new Error(
          `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${found.source}${escapeHTML(found.pathToPayload)}`
        )
      );
    }

    // If the attack should not be blocked
    // Just call the original callback to allow the DNS lookup
    return callback(err, addresses, family);
  };
}

function getResolvedIPAddresses(addresses: string | LookupAddress[]): string[] {
  const resolvedIPAddresses: string[] = [];
  for (const address of Array.isArray(addresses) ? addresses : [addresses]) {
    if (typeof address === "string") {
      resolvedIPAddresses.push(address);
      continue;
    }

    if (isPlainObject(address) && address.address) {
      resolvedIPAddresses.push(address.address);
    }
  }

  return resolvedIPAddresses;
}

function resolvesToIMDSIP(
  resolvedIPAddresses: string[],
  hostname: string
): boolean {
  // Allow access to Google Cloud metadata service as you need to set specific headers to access it
  // We don't want to block legitimate requests
  if (isTrustedHostname(hostname)) {
    return false;
  }

  return resolvedIPAddresses.some((ip) => isIMDSIPAddress(ip));
}
