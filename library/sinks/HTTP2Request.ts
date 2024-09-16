import type { ClientSessionOptions } from "http2";
import type { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import type { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { getHostFromHTTP2RequestArgs } from "./http2-request/getHostFromHTTP2RequestArgs";
import { lookup } from "dns";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { wrapExport } from "../agent/hooks/wrapExport";

export class HTTP2Request implements Wrapper {
  private inspectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined
  ): InterceptorResult {
    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    agent.onConnectHostname(hostname, port);
    const context = getContext();

    if (!context) {
      return undefined;
    }

    // Check if the hostname is inside the context
    const foundDirectSSRF = checkContextForSSRF({
      hostname: hostname,
      operation: `http2.connect`,
      context: context,
      port: port,
    });
    if (foundDirectSSRF) {
      return foundDirectSSRF;
    }
    return undefined;
  }

  private inspectHttp2Connect(args: unknown[], agent: Agent) {
    if (args.length <= 0) {
      return undefined;
    }

    const hostInfo = getHostFromHTTP2RequestArgs(args);
    if (!hostInfo) {
      return undefined;
    }

    const attack = this.inspectHostname(
      agent,
      hostInfo.hostname,
      hostInfo.port
    );
    if (attack) {
      return attack;
    }

    return undefined;
  }

  private monitorDNSLookups(args: unknown[], agent: Agent): unknown[] {
    const context = getContext();

    if (!context) {
      return args;
    }

    let optionObj = undefined;
    if (args.length > 1 && typeof args[1] === "object") {
      optionObj = args[1] as ClientSessionOptions & {
        lookup?: Function;
      };
    }

    if (!optionObj) {
      const newOpts = {
        lookup: inspectDNSLookupCalls(lookup, agent, "http2", "http2.connect"),
      };

      // You can also pass on handler as a callback as the second argument
      // But if the options object is added at the third position, it will be ignored
      if (args.length === 2 && typeof args[1] === "function") {
        return [args[0], newOpts, args[1]];
      }

      return args.concat(newOpts);
    }

    if (typeof optionObj.lookup === "function") {
      optionObj.lookup = inspectDNSLookupCalls(
        optionObj.lookup,
        agent,
        "http2",
        "http2.connect"
      );
    } else {
      optionObj.lookup = inspectDNSLookupCalls(
        lookup,
        agent,
        "http2",
        "http2.connect"
      );
    }

    return args;
  }

  wrap(hooks: Hooks) {
    hooks.addBuiltinModule("http2").onRequire((exports, pkgInfo) => {
      wrapExport(exports, "connect", pkgInfo, {
        inspectArgs: (args, agent) => this.inspectHttp2Connect(args, agent),
        modifyArgs: (args, agent) => this.monitorDNSLookups(args, agent),
        modifyReturnValue: (args, returnValue) => {
          // Next step
          return returnValue;
        },
      });
    });
  }
}
