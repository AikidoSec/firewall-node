import { lookup } from "dns";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import {
  getMajorNodeVersion,
  getMinorNodeVersion,
} from "../helpers/getNodeVersion";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { wrapDispatch } from "./undici/wrapDispatch";
import { wrapExport } from "../agent/hooks/wrapExport";
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
      port,
    });
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
      .onRequire((exports, pkgInfo) => {
        // Print a warning that we can't provide protection if setGlobalDispatcher is called
        wrapExport(exports, "setGlobalDispatcher", pkgInfo, {
          inspectArgs: (args, agent) => {
            if (this.patchedGlobalDispatcher) {
              agent.log(
                `undici.setGlobalDispatcher was called, we can't provide protection!`
              );
            }
          },
        });
        // Wrap all methods that can make requests
        for (const method of methods) {
          wrapExport(exports, method, pkgInfo, {
            // Whenever a request is made, we'll check the hostname whether it's a private IP
            // If global dispatcher is not patched, we'll patch it
            inspectArgs: (args, agent) => {
              if (!this.patchedGlobalDispatcher) {
                this.patchGlobalDispatcher(agent);
                this.patchedGlobalDispatcher = true;
              }
              return this.inspect(args, agent, method);
            },
          });
        }
      });
  }
}
