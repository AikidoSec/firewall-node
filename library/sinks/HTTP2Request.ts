import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";

export class HTTP2Request implements Wrapper {
  private inspectHttp2Connect(args: unknown[], agent: Agent) {
    if (args.length <= 0 || !args[0]) {
      return undefined;
    }

    let url: URL | undefined;
    if (typeof args[0] === "string") {
      url = tryParseURL(args[0]);
    } else if (args[0] instanceof URL) {
      url = args[0];
    }

    if (!url) {
      return undefined;
    }

    const port = getPortFromURL(url);

    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    agent.onConnectHostname(url.hostname, port);
    const context = getContext();

    if (!context) {
      return undefined;
    }

    // Check if the hostname is inside the context
    const foundDirectSSRF = checkContextForSSRF({
      hostname: url.hostname,
      operation: `http2.connect`,
      context: context,
      port: port,
    });
    if (foundDirectSSRF) {
      return foundDirectSSRF;
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
