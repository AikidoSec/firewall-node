import { lookup } from "dns";
import type { RequestOptions } from "http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { inspectLookupCalls } from "../vulnerabilities/ssrf/inspectLookupCalls";

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

  private monitorDNSLookups(
    args: unknown[],
    agent: Agent,
    module: string
  ): unknown[] {
    const context = getContext();

    if (!context) {
      return args;
    }

    const optionObj = args.find((arg): arg is RequestOptions =>
      isPlainObject(arg)
    );

    if (!optionObj) {
      return args.concat([
        {
          lookup: inspectLookupCalls(
            lookup,
            agent,
            module,
            `${module}.request`
          ),
        },
      ]);
    }

    if (optionObj.lookup) {
      optionObj.lookup = inspectLookupCalls(
        optionObj.lookup,
        agent,
        module,
        `${module}.request`
      ) as RequestOptions["lookup"];
    } else {
      optionObj.lookup = inspectLookupCalls(
        lookup,
        agent,
        module,
        `${module}.request`
      ) as RequestOptions["lookup"];
    }

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
