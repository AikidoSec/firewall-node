import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";

export class HTTPRequest implements Wrapper {
  private onConnectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined
  ): InterceptorResult {
    agent.onConnectHostname(hostname, port);

    return undefined;
  }

  inspectHttpRequest(args: unknown[], agent: Agent) {
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
        const result = this.onConnectHostname(
          agent,
          args[0].hostname,
          typeof args[0].port === "number" ? args[0].port : undefined
        );
        if (result) {
          return result;
        }
      }
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addBuiltinModule("http")
      .addSubject((exports) => exports)
      .inspect("request", (args, subject, agent) =>
        this.inspectHttpRequest(args, agent)
      );

    hooks
      .addBuiltinModule("https")
      .addSubject((exports) => exports)
      .inspect("request", (args, subject, agent) =>
        this.inspectHttpRequest(args, agent)
      );
  }
}
