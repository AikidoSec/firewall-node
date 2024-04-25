import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";

export class Fetch implements Wrapper {
  private onConnectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined
  ): InterceptorResult {
    agent.onConnectHostname(hostname, port);
    const context = getContext();

    if (!context) {
      return undefined;
    }

    return checkContextForSSRF({
      hostname: hostname,
      operation: "fetch",
      context: context,
    });
  }

  inspectFetch(args: unknown[], agent: Agent): InterceptorResult {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        const url = tryParseURL(args[0]);
        if (url) {
          const result = this.onConnectHostname(
            agent,
            url.hostname,
            getPortFromURL(url)
          );
          if (result) {
            return result;
          }
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
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addGlobal("fetch")
      .inspect((args, subject, agent) => this.inspectFetch(args, agent));
  }
}
