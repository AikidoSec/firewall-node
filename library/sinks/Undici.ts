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
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { wrapDispatch } from "./undici/wrapDispatch";
import { isIP } from "net";
import { getHostnameAndPortFromArgs } from "./undici/getHostnameAndPortFromArgs";

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
    const context = getContext();

    if (!context) {
      // Add to list of hostnames that the application is connecting to
      agent.onConnectHostname(hostname, port);
      return undefined;
    }

    const foundAttack = checkContextForSSRF({
      hostname: hostname,
      operation: `undici.${method}`,
      context,
      port,
    });

    if (foundAttack) {
      return foundAttack;
    }

    if (isIP(hostname)) {
      // Add to list of hostnames that the application is connecting to
      // Don't add domain names to the list yet, as they might be resolved to a private IP
      agent.onConnectHostname(hostname, port);
    }

    return undefined;
  }

  // eslint-disable-next-line max-lines-per-function
  private inspect(
    args: unknown[],
    agent: Agent,
    method: string
  ): InterceptorResult {
    const hostnameAndPort = getHostnameAndPortFromArgs(args);
    if (hostnameAndPort) {
      const attack = this.inspectHostname(
        agent,
        hostnameAndPort.hostname,
        hostnameAndPort.port,
        method
      );
      if (attack) {
        return attack;
      }
    }

    return undefined;
  }

  private patchGlobalDispatcher(agent: Agent) {
    const undici = require("undici");

    const dispatcher = new undici.Agent({
      connect: {
        lookup: inspectDNSLookupCalls(
          lookup,
          agent,
          "undici",
          // We don't know the method here, so we just use "undici.[method]"
          "undici.[method]"
        ),
      },
    });

    dispatcher.dispatch = wrapDispatch(dispatcher.dispatch, agent);

    // We'll set a global dispatcher that will inspect the resolved IP address (and thus preventing TOCTOU attacks)
    undici.setGlobalDispatcher(dispatcher);
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
