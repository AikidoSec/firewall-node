/* eslint-disable max-lines-per-function */
import { isIP } from "net";
import { LookupAddress } from "node:dns";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { getContext } from "../../agent/Context";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { isPlainObject } from "../../helpers/isPlainObject";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { isPrivateIP } from "./isPrivateIP";
import { isIMDSIPAddress, isTrustedHostname } from "./imds";

function wrapDNSLookupCallback(
  callback: Function,
  hostname: string,
  module: string,
  agent: Agent,
  operation: string
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

    if (!context) {
      // Block stored SSRF attack that target IMDS IP addresses
      // An attacker could have stored a hostname in a database that points to an IMDS IP address
      // isTrustedHostname is used to allow requests to the Google Cloud metadata service (and other services)
      // We don't check if the user input contains the IMDS IP address because there's no context
      const blockedIP = resolvedIPAddresses.find((ip) => isIMDSIPAddress(ip));
      if (blockedIP && !isTrustedHostname(hostname)) {
        if (agent.shouldBlock()) {
          return callback(
            new Error(
              `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from unknown source`
            )
          );
        }
      }

      return callback(err, addresses, family);
    }

    const endpoint = agent.getConfig().getEndpoint(context);

    if (endpoint && endpoint.endpoint.forceProtectionOff) {
      return callback(err, addresses, family);
    }

    const privateIP = resolvedIPAddresses.find(isPrivateIP);

    if (!privateIP) {
      return callback(err, addresses, family);
    }

    let detected:
      | {
          source: Source;
          pathToPayload: string;
          payload: string;
        }
      | undefined = undefined;
    for (const source of [
      "body",
      "query",
      "headers",
      "cookies",
      "routeParams",
      "graphql",
      "xml",
    ] as Source[]) {
      if (context[source]) {
        const userInput = extractStringsFromUserInput(context[source]);
        for (const [str, path] of userInput.entries()) {
          const found = findHostnameInUserInput(str, hostname);
          if (found) {
            detected = {
              source: source,
              pathToPayload: path,
              payload: str,
            };
            break;
          }
        }
      }
    }

    if (!detected) {
      return callback(err, addresses, family);
    }

    agent.onDetectedAttack({
      module: module,
      operation: operation,
      kind: "ssrf",
      source: detected.source,
      blocked: agent.shouldBlock(),
      stack: new Error().stack!,
      path: detected.pathToPayload,
      metadata: {},
      request: context,
      payload: detected.payload,
    });

    if (agent.shouldBlock()) {
      return callback(
        new Error(
          `Aikido firewall has blocked ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${detected.source}${detected.pathToPayload}`
        )
      );
    }

    return callback(err, addresses, family);
  };
}

export function inspectDNSLookupCalls(
  lookup: Function,
  agent: Agent,
  module: string,
  operation: string
): Function {
  return function inspectDNSLookup(...args: unknown[]) {
    const hostname =
      args.length > 0 && typeof args[0] === "string" ? args[0] : undefined;
    const callback = args.find((arg) => typeof arg === "function");

    // If the hostname is an IP address, or if the callback is missing, we don't need to inspect the call
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
            operation
          ),
        ]
      : [
          hostname,
          wrapDNSLookupCallback(
            callback as Function,
            hostname,
            module,
            agent,
            operation
          ),
        ];

    lookup(...argsToApply);
  };
}
