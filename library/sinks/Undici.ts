import { lookup } from "dns";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectLookupCalls } from "../vulnerabilities/ssrf/inspectLookupCalls";

const methods = [
  "request",
  "stream",
  "pipeline",
  "connect",
  "fetch",
  "upgrade",
];

export class Undici implements Wrapper {
  private patchedGlobalDispatcher = false;

  private inspectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined,
    method: string
  ): InterceptorResult {
    agent.onConnectHostname(hostname, port);
    const context = getContext();

    if (!context) {
      return undefined;
    }

    return checkContextForSSRF({
      hostname: hostname,
      operation: `undici.${method}`,
      context,
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private inspect(
    args: unknown[],
    agent: Agent,
    method: string
  ): InterceptorResult {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        const url = tryParseURL(args[0]);
        if (url) {
          const attack = this.inspectHostname(
            agent,
            url.hostname,
            getPortFromURL(url),
            method
          );
          if (attack) {
            return attack;
          }
        }
      }

      if (args[0] instanceof URL && args[0].hostname.length > 0) {
        const attack = this.inspectHostname(
          agent,
          args[0].hostname,
          getPortFromURL(args[0]),
          method
        );
        if (attack) {
          return attack;
        }
      }

      if (
        isPlainObject(args[0]) &&
        typeof args[0].hostname === "string" &&
        args[0].hostname.length > 0
      ) {
        let port = 80;
        if (typeof args[0].protocol === "string") {
          port = args[0].protocol === "https:" ? 443 : 80;
        }
        if (typeof args[0].port === "number") {
          port = args[0].port;
        } else if (
          typeof args[0].port === "string" &&
          Number.isInteger(parseInt(args[0].port, 10))
        ) {
          port = parseInt(args[0].port, 10);
        }

        const attack = this.inspectHostname(
          agent,
          args[0].hostname,
          port,
          method
        );
        if (attack) {
          return attack;
        }
      }
    }

    return undefined;
  }

  private patchGlobalDispatcher(agent: Agent) {
    const undici = require("undici");

    undici.setGlobalDispatcher(
      new undici.Agent({
        connect: {
          lookup: inspectLookupCalls(
            lookup,
            agent,
            "undici",
            // We don't know the method here, so we just use "undici.[method]"
            "undici.[method]"
          ),
        },
      })
    );
  }

  wrap(hooks: Hooks) {
    const undici = hooks
      .addPackage("undici")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0")
      .addSubject((exports) => exports);

    undici.inspect("setGlobalDispatcher", (args, subject, agent) => {
      if (this.patchedGlobalDispatcher) {
        agent.log(
          `undici.setGlobalDispatcher was called, we can't provide protection!`
        );
      }
    });

    methods.forEach((method) => {
      undici
        .inspect(method, (args, subject, agent) =>
          this.inspect(args, agent, method)
        )
        .modifyArguments(method, (args, subject, agent) => {
          if (!this.patchedGlobalDispatcher) {
            this.patchGlobalDispatcher(agent);
            this.patchedGlobalDispatcher = true;
          }

          return args;
        });
    });
  }
}
