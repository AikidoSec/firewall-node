/* eslint-disable max-lines-per-function */
import { LookupAddress } from "node:dns";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName, Kind } from "../../agent/Attack";
import { getContext } from "../../agent/Context";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
import { isPlainObject } from "../../helpers/isPlainObject";
import { findHostnameInUserInput } from "./findHostnameInUserInput";
import { isPrivateIP } from "./isPrivateIP";

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

    if (!context) {
      return callback(err, addresses, family);
    }

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

    // Todo: check service config for endpoint protection
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
          `Aikido runtime has blocked a ${attackKindHumanName("ssrf")}: ${operation}(...) originating from ${detected.source}${detected.pathToPayload}`
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
