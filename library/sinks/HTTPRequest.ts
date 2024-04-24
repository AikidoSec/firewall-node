import { lookup, LookupOptions } from "dns";
import type { RequestOptions } from "http";
import { Agent } from "../agent/Agent";
import { attackKindHumanName } from "../agent/Attack";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";

export class HTTPRequest implements Wrapper {
  private onConnectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined
  ): InterceptorResult {
    agent.onConnectHostname(hostname, port);
  }

  // eslint-disable-next-line max-lines-per-function
  private inspectHttpRequest(args: unknown[], agent: Agent, module: string) {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        try {
          const url = new URL(args[0]);
          if (url.hostname.length > 0) {
            const result = this.onConnectHostname(
              agent,
              url.hostname,
              getPortFromURL(url)
            );
            if (result) {
              return result;
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      if (args[0] instanceof URL && args[0].hostname.length > 0) {
        const result = this.onConnectHostname(
          agent,
          args[0].hostname,
          getPortFromURL(args[0])
        );
        if (result) {
          return result;
        }
      }

      if (
        isPlainObject(args[0]) &&
        typeof args[0].hostname === "string" &&
        args[0].hostname.length > 0
      ) {
        let port = module === "http" ? 80 : 443;
        if (typeof args[0].port === "number") {
          port = args[0].port;
        } else if (
          typeof args[0].port === "string" &&
          Number.isInteger(parseInt(args[0].port, 10))
        ) {
          port = parseInt(args[0].port, 10);
        }

        const result = this.onConnectHostname(agent, args[0].hostname, port);
        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  // eslint-disable-next-line max-lines-per-function
  private monitorDNSLookups(
    args: unknown[],
    agent: Agent,
    module: string
  ): unknown[] {
    const context = getContext();

    if (!context) {
      return args;
    }

    // eslint-disable-next-line max-lines-per-function
    const wrappedLookup = (
      hostname: string,
      options: LookupOptions,
      callback: Function
    ) => {
      lookup(hostname, options, (err, address, family) => {
        if (err) {
          return callback(err);
        }

        const toCheck = (Array.isArray(address) ? address : [address]).map(
          (address) => {
            if (typeof address === "string") {
              return address;
            }

            if (isPlainObject(address) && address.address) {
              return address.address;
            }

            return undefined;
          }
        );

        for (const ip of toCheck) {
          if (!ip) {
            continue;
          }

          const detect = checkContextForSSRF({
            hostname: hostname,
            operation: `${module}.request`,
            ipAddress: ip,
            context: context,
          });

          if (detect) {
            agent.onDetectedAttack({
              module,
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
              const error = new Error(
                `Aikido runtime has blocked a ${attackKindHumanName(detect.kind)}: ${detect.operation}(...) originating from ${detect.source}${detect.pathToPayload}`
              );
              callback(error);
              return;
            }
          }
        }

        callback(err, address, family);
      });
    };

    const optionObj = args.find((arg) => isPlainObject(arg));

    if (!optionObj) {
      return args.concat([
        {
          lookup: wrappedLookup,
        },
      ]);
    }

    // @ts-expect-error We don't know the type of this
    if (optionObj.lookup) {
      // TODO: Use the passed lookup function to wrap it
    }

    (optionObj as RequestOptions).lookup = wrappedLookup;

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addBuiltinModule("http")
      .addSubject((exports) => exports)
      .inspect("request", (args, subject, agent) => {
        this.inspectHttpRequest(args, agent, "http");
      })
      .modifyArguments("request", (args, subject, agent) =>
        this.monitorDNSLookups(args, agent, "http")
      );

    hooks
      .addBuiltinModule("https")
      .addSubject((exports) => exports)
      .inspect("request", (args, subject, agent) =>
        this.inspectHttpRequest(args, agent, "https")
      )
      .modifyArguments("request", (args, subject, agent) =>
        this.monitorDNSLookups(args, agent, "https")
      );
  }
}
