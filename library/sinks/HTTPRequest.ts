import { lookup } from "dns";
import type { RequestOptions } from "http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { getPortFromHTTPRequestOptions } from "./http-request/getPortFromRequest";

export class HTTPRequest implements Wrapper {
  private inspectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined,
    module: "http" | "https"
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
      operation: `${module}.request`,
      context: context,
      port: port,
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private inspectHttpRequest(
    args: unknown[],
    agent: Agent,
    module: "http" | "https"
  ) {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        try {
          const url = new URL(args[0]);
          if (url.hostname.length > 0) {
            const attack = this.inspectHostname(
              agent,
              url.hostname,
              getPortFromHTTPRequestOptions(args, module),
              module
            );
            if (attack) {
              return attack;
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      if (args[0] instanceof URL && args[0].hostname.length > 0) {
        const attack = this.inspectHostname(
          agent,
          args[0].hostname,
          getPortFromURL(args[0]),
          module
        );
        if (attack) {
          return attack;
        }
      }

      let options;

      if (
        isPlainObject(args[0]) &&
        typeof args[0].hostname === "string" &&
        args[0].hostname.length > 0
      ) {
        options = args[0];
      } else if (
        args.length > 1 &&
        isPlainObject(args[1]) &&
        typeof args[1].hostname === "string" &&
        args[1].hostname.length > 0
      ) {
        options = args[1];
      }

      if (options) {
        const attack = this.inspectHostname(
          agent,
          options.hostname as string,
          getPortFromHTTPRequestOptions(args, module),
          module
        );
        if (attack) {
          return attack;
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

    const port = getPortFromHTTPRequestOptions(args);

    if (!optionObj) {
      return args.concat([
        {
          lookup: inspectDNSLookupCalls(
            lookup,
            agent,
            module,
            `${module}.request`,
            port
          ),
        },
      ]);
    }

    if (optionObj.lookup) {
      optionObj.lookup = inspectDNSLookupCalls(
        optionObj.lookup,
        agent,
        module,
        `${module}.request`,
        port
      ) as RequestOptions["lookup"];
    } else {
      optionObj.lookup = inspectDNSLookupCalls(
        lookup,
        agent,
        module,
        `${module}.request`,
        port
      ) as RequestOptions["lookup"];
    }

    return args;
  }

  wrap(hooks: Hooks) {
    const modules = ["http", "https"] as const;

    modules.forEach((module) => {
      hooks
        .addBuiltinModule(module)
        .addSubject((exports) => exports)
        // Whenever a request is made, we'll check the hostname whether it's a private IP
        .inspect("request", (args, subject, agent) =>
          this.inspectHttpRequest(args, agent, module)
        )
        .inspect("get", (args, subject, agent) =>
          this.inspectHttpRequest(args, agent, module)
        )
        // Whenever a request is made, we'll modify the options to pass a custom lookup function
        // that will inspect resolved IP address (and thus preventing TOCTOU attacks)
        .modifyArguments("request", (args, subject, agent) =>
          this.monitorDNSLookups(args, agent, module)
        )
        .modifyArguments("get", (args, subject, agent) =>
          this.monitorDNSLookups(args, agent, module)
        );
    });
  }
}
