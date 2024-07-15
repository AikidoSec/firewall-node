import { lookup } from "dns";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import {
  getMajorNodeVersion,
  getMinorNodeVersion,
} from "../helpers/getNodeVersion";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";

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
    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
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

    // We'll set a global dispatcher that will inspect the resolved IP address (and thus preventing TOCTOU attacks)
    undici.setGlobalDispatcher(
      new undici.Agent({
        connect: {
          lookup: inspectDNSLookupCalls(
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
    const supported =
      getMajorNodeVersion() >= 17 ||
      (getMajorNodeVersion() === 16 && getMinorNodeVersion() >= 8);

    if (!supported) {
      // Undici requires Node.js 16.8+
      // Packages aren't scoped in npm workspaces, we'll try to require undici:
      // ReferenceError: ReadableStream is not defined
      return;
    }

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
        // Whenever a request is made, we'll check the hostname whether it's a private IP
        .inspect(method, (args, subject, agent) =>
          this.inspect(args, agent, method)
        )
        // We're not really modifying the arguments here, but we need to patch the global dispatcher
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
