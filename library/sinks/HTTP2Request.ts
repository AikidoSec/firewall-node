import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { getUrlFromHTTPRequestArgs } from "./http-request/getUrlFromHTTPRequestArgs";
import { getHostFromHTTP2RequestArgs } from "./http2-request/getHostFromHTTP2RequestArgs";

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

  wrap(hooks: Hooks) {
    hooks
      .addBuiltinModule("http2")
      .addSubject((exports) => exports)
      .inspect("connect", (args, subject, agent) =>
        this.inspectHttp2Connect(args, agent)
      );
  }
}
