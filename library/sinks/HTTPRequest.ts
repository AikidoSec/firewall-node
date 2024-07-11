import { lookup } from "node:dns";
import type { RequestOptions } from "node:http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";

export class HTTPRequest implements Wrapper {
  private inspectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined,
    module: string
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
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private inspectHttpRequest(args: unknown[], agent: Agent, module: string) {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        try {
          const url = new URL(args[0]);
          if (url.hostname.length > 0) {
            const attack = this.inspectHostname(
              agent,
              url.hostname,
              getPortFromURL(url),
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

        const attack = this.inspectHostname(
          agent,
          args[0].hostname,
          port,
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

    if (!optionObj) {
      return args.concat([
        {
          lookup: inspectDNSLookupCalls(
            lookup,
            agent,
            module,
            `${module}.request`
          ),
        },
      ]);
    }

    if (optionObj.lookup) {
      optionObj.lookup = inspectDNSLookupCalls(
        optionObj.lookup,
        agent,
        module,
        `${module}.request`
      ) as RequestOptions["lookup"];
    } else {
      optionObj.lookup = inspectDNSLookupCalls(
        lookup,
        agent,
        module,
        `${module}.request`
      ) as RequestOptions["lookup"];
    }

    return args;
  }

  wrap(hooks: Hooks) {
    const modules = ["http", "https"];

    modules.forEach((module) => {
      hooks
        .addBuiltinModule(module)
        .addSubject((exports) => exports)
        // Whenever a request is made, we'll check the hostname whether it's a private IP
        .inspect("request", (args, subject, agent) =>
          this.inspectHttpRequest(args, agent, module)
        )
        // Whenever a request is made, we'll modify the options to pass a custom lookup function
        // that will inspect resolved IP address (and thus preventing TOCTOU attacks)
        .modifyArguments("request", (args, subject, agent) =>
          this.monitorDNSLookups(args, agent, module)
        );
    });
  }
}
