/* eslint-disable max-lines-per-function */
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

function wrapCallback(
  callback: Function,
  hostname: string,
  module: string,
  agent: Agent,
  operation: string
): Function {
  return function wrappedLookup(
    err: Error,
    addresses: string | LookupAddress[],
    family: number
  ) {
    if (err) {
      return callback(err);
    }

    const context = getContext();

    const toCheck: string[] = [];
    for (const address of Array.isArray(addresses) ? addresses : [addresses]) {
      if (typeof address === "string") {
        toCheck.push(address);
        continue;
      }

      if (isPlainObject(address) && address.address) {
        toCheck.push(address.address);
      }
    }

    if (!context) {
      // Block stored SSRF attack (e.g. IMDS IP address) with untrusted domain
      const blockedIP = toCheck.find((ip) => isIMDSIPAddress(ip));
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

    const privateIP = toCheck.find(isPrivateIP);

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

export function inspectLookupCalls(
  lookup: Function,
  agent: Agent,
  module: string,
  operation: string
): Function {
  return function inspectDNSLookup(...args: unknown[]) {
    const hostname =
      args.length > 0 && typeof args[0] === "string" ? args[0] : undefined;
    const callback = args.find((arg) => typeof arg === "function");

    if (!hostname || !callback) {
      return lookup(...args);
    }

    const options = args.find((arg) => isPlainObject(arg)) as
      | Record<string, unknown>
      | undefined;

    const argsToApply = options
      ? [
          hostname,
          options,
          wrapCallback(
            callback as Function,
            hostname,
            module,
            agent,
            operation
          ),
        ]
      : [
          hostname,
          wrapCallback(
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
