/* eslint-disable max-lines-per-function */
import { LookupAddress } from "node:dns";
import { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { getContext } from "../../agent/Context";
import { isPlainObject } from "../../helpers/isPlainObject";
import { checkContextForSSRF } from "./checkContextForSSRF";

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

    for (const ip of toCheck) {
      const detect = checkContextForSSRF({
        hostname: hostname,
        operation: operation,
        ipAddress: ip,
        context: context,
      });

      if (detect) {
        agent.onDetectedAttack({
          module: module,
          operation: detect.operation,
          kind: detect.kind,
          source: detect.source,
          blocked: agent.shouldBlock(),
          stack: new Error().stack!,
          path: detect.pathToPayload,
          metadata: detect.metadata,
          request: context,
          payload: detect.payload,
        });

        if (agent.shouldBlock()) {
          callback(
            new Error(
              `Aikido runtime has blocked a ${attackKindHumanName(detect.kind)}: ${operation}(...) originating from ${detect.source}${detect.pathToPayload}`
            )
          );
          return;
        }
      }
    }

    callback(err, addresses, family);
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
