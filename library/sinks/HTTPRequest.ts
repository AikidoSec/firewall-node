import { lookup } from "dns";
import { ClientRequest, type RequestOptions } from "http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { onHTTPResponse } from "./http-request/onHTTPResponse";
import { getUrlFromHTTPRequestArgs } from "./http-request/getUrlFromHTTPRequestArgs";
import { isRedirectToPrivateIP } from "../vulnerabilities/ssrf/isRedirectToPrivateIP";

export class HTTPRequest implements Wrapper {
  private inspectHostname(
    agent: Agent,
    url: URL,
    port: number | undefined,
    module: "http" | "https"
  ): InterceptorResult {
    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    agent.onConnectHostname(url.hostname, port);
    const context = getContext();

    if (!context) {
      return undefined;
    }

    const found = checkContextForSSRF({
      hostname: url.hostname,
      operation: `${module}.request`,
      context: context,
      port: port,
    });
    if (found) {
      return found;
    }

    const foundRedirect = isRedirectToPrivateIP(url, context);
    if (foundRedirect) {
      return {
        operation: `${module}.request`,
        kind: "ssrf",
        source: foundRedirect.source,
        pathToPayload: foundRedirect.pathToPayload,
        metadata: {},
        payload: foundRedirect.payload,
      };
    }

    return undefined;
  }

  // eslint-disable-next-line max-lines-per-function
  private inspectHttpRequest(
    args: unknown[],
    agent: Agent,
    module: "http" | "https"
  ) {
    if (args.length <= 0) {
      return undefined;
    }

    const url = getUrlFromHTTPRequestArgs(args, module);
    if (!url) {
      return undefined;
    }

    if (url.hostname.length > 0) {
      const attack = this.inspectHostname(
        agent,
        url,
        getPortFromURL(url),
        module
      );
      if (attack) {
        return attack;
      }
    }

    return undefined;
  }

  private monitorDNSLookups(
    args: unknown[],
    agent: Agent,
    module: "http" | "https"
  ): unknown[] {
    const context = getContext();

    if (!context) {
      return args;
    }

    const optionObj = args.find((arg): arg is RequestOptions =>
      isPlainObject(arg)
    );

    const url = getUrlFromHTTPRequestArgs(args, module);

    if (!optionObj) {
      return args.concat([
        {
          lookup: inspectDNSLookupCalls(
            lookup,
            agent,
            module,
            `${module}.request`,
            url
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
        url
      ) as RequestOptions["lookup"];
    } else {
      optionObj.lookup = inspectDNSLookupCalls(
        lookup,
        agent,
        module,
        `${module}.request`,
        url
      ) as RequestOptions["lookup"];
    }

    return args;
  }

  private wrapResponseEvent(req: unknown) {
    if (!req || !(req instanceof ClientRequest)) {
      return;
    }

    const context = getContext();
    if (!context) {
      return;
    }
    req.prependListener("response", (res) => onHTTPResponse(req, res, context));
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
        )
        // Inspect the response object to get the headers for ssrf redirect protection
        .inspectResult("request", (args, result, subject, agent) => {
          this.wrapResponseEvent(result);
        })
        .inspectResult("get", (args, result, subject, agent) => {
          this.wrapResponseEvent(result);
        });
    });
  }
}
