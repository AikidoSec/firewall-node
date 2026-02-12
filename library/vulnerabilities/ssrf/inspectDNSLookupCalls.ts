import { isIP, type LookupFunction } from "net";
import { LookupAddress } from "dns";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { getContext } from "../../agent/Context";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { escapeHTML } from "../../helpers/escapeHTML";
import { isPlainObject } from "../../helpers/isPlainObject";
import { getMetadataForSSRFAttack } from "./getMetadataForSSRFAttack";
import { isPrivateIP } from "./isPrivateIP";
import { isIMDSIPAddress, isTrustedHostname } from "./imds";
import { RequestContextStorage } from "../../sinks/undici/RequestContextStorage";
import { findHostnameInContext } from "./findHostnameInContext";
import { getRedirectOrigin } from "./getRedirectOrigin";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { getLibraryRoot } from "../../helpers/getLibraryRoot";
import { cleanError } from "../../helpers/cleanError";

export function inspectDNSLookupCalls(
  lookup: Function,
  agent: Agent,
  module: string,
  operation: string,
  url?: URL,
  stackTraceCallingLocation?: Error
): LookupFunction {
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
            url,
            stackTraceCallingLocation
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
            url,
            stackTraceCallingLocation
          ),
        ];

    lookup(...argsToApply);
  };
}

function wrapDNSLookupCallback(
  callback: Function,
  hostname: string,
  module: string,
  agent: Agent,
  operation: string,
  urlArg?: URL,
  callingLocationStackTrace?: Error
): Function {
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
      const matches = agent.getConfig().getEndpoints(context);

      if (matches.find((endpoint) => endpoint.forceProtectionOff)) {
        // User disabled protection for this endpoint, we don't need to inspect the resolved IPs
        // Just call the original callback to allow the DNS lookup
        return callback(err, addresses, family);
      }
    }

    const resolvedIPAddresses = getResolvedIPAddresses(addresses);

    const imdsIpResult = resolvesToIMDSIP(resolvedIPAddresses, hostname);
    if (!context && imdsIpResult.isIMDS) {
      reportStoredImdsIpSSRF({
        agent,
        module,
        operation,
        hostname,
        privateIp: imdsIpResult.ip,
        callingLocationStackTrace,
      });

      // Block stored SSRF attack that target IMDS IP addresses
      // An attacker could have stored a hostname in a database that points to an IMDS IP address
      // We don't check if the user input contains the hostname because there's no context
      if (agent.shouldBlock()) {
        return callback(
          new Error(
            `Zen has blocked ${attackKindHumanName("stored_ssrf")}: ${operation}(...) originating from unknown source`
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

    if (urlArg) {
      port = getPortFromURL(urlArg);
    } else if (requestContext) {
      port = requestContext.port;
    }

    const privateIP = resolvedIPAddresses.find(isPrivateIP);

    if (!privateIP) {
      // If the hostname doesn't resolve to a private IP address, it's not an SSRF attack
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    let found = findHostnameInContext(hostname, context, port);

    // The hostname is not found in the context, check if it's a redirect
    if (!found && context.outgoingRequestRedirects) {
      let url: URL | undefined;
      // Url arg is passed when wrapping node:http(s), but not for undici / fetch because of the way they are wrapped
      // For undici / fetch we need to get the url from the request context, which is an additional async context for outgoing requests,
      // not to be confused with the "normal" context used in wide parts of this library
      if (urlArg) {
        url = urlArg;
      } else if (requestContext) {
        url = new URL(requestContext.url);
      }

      if (url) {
        // Get the origin of the redirect chain (the first URL in the chain), if the URL is the result of a redirect
        const redirectOrigin = getRedirectOrigin(
          context.outgoingRequestRedirects,
          url
        );

        // If the URL is the result of a redirect, get the origin of the redirect chain for reporting the attack source
        if (redirectOrigin) {
          found = findHostnameInContext(
            redirectOrigin.hostname,
            context,
            getPortFromURL(redirectOrigin)
          );
        }
      }
    }

    const isBypassedIP =
      context &&
      context.remoteAddress &&
      agent.getConfig().isBypassedIP(context.remoteAddress);

    if (isBypassedIP) {
      // If the IP address is allowed, we don't need to block the request
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    if (!found) {
      if (imdsIpResult.isIMDS) {
        // Stored SSRF attack executed during another request (context set)
        reportStoredImdsIpSSRF({
          agent,
          module,
          operation,
          hostname,
          privateIp: imdsIpResult.ip,
          callingLocationStackTrace,
        });

        // Block stored SSRF attack that target IMDS IP addresses
        // An attacker could have stored a hostname in a database that points to an IMDS IP address
        if (agent.shouldBlock()) {
          return callback(
            new Error(
              `Zen has blocked ${attackKindHumanName("stored_ssrf")}: ${operation}(...) originating from unknown source`
            )
          );
        }
      }

      // If we can't find the hostname in the context, it's not an SSRF attack
      // Just call the original callback to allow the DNS lookup
      return callback(err, addresses, family);
    }

    // Used to get the stack trace of the calling location
    // We don't throw the error, we just use it to get the stack trace
    const stackTraceError = callingLocationStackTrace || new Error();

    agent.onDetectedAttack({
      module: module,
      operation: operation,
      kind: "ssrf",
      source: found.source,
      blocked: agent.shouldBlock(),
      stack: cleanupStackTrace(stackTraceError.stack!, getLibraryRoot()),
      paths: found.pathsToPayload,
      metadata: getMetadataForSSRFAttack({ hostname, port, privateIP }),
      request: context,
      payload: found.payload,
    });

    if (agent.shouldBlock()) {
      return callback(
        cleanError(
          new Error(
            `Zen has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${found.source}${escapeHTML((found.pathsToPayload || []).join())}`
          )
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
): { isIMDS: false } | { isIMDS: true; ip: string } {
  // Allow access to Google Cloud metadata service as you need to set specific headers to access it
  // We don't want to block legitimate requests
  if (isTrustedHostname(hostname)) {
    return {
      isIMDS: false,
    };
  }

  const matchingIp = resolvedIPAddresses.find((ip) => isIMDSIPAddress(ip));
  if (matchingIp) {
    return {
      isIMDS: true,
      ip: matchingIp,
    };
  }

  return {
    isIMDS: false,
  };
}

function reportStoredImdsIpSSRF({
  agent,
  callingLocationStackTrace,
  module,
  operation,
  hostname,
  privateIp,
}: {
  agent: Agent;
  callingLocationStackTrace?: Error;
  module: string;
  operation: string;
  hostname: string;
  privateIp: string;
}) {
  const stackTraceError = callingLocationStackTrace || new Error();
  agent.onDetectedAttack({
    module: module,
    operation: operation,
    kind: "stored_ssrf",
    source: undefined,
    blocked: agent.shouldBlock(),
    stack: cleanupStackTrace(stackTraceError.stack!, getLibraryRoot()),
    paths: [],
    metadata: getMetadataForSSRFAttack({
      hostname,
      port: undefined,
      privateIP: privateIp,
    }),
    request: undefined,
    payload: undefined,
  });
}
