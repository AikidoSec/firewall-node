import { lookup } from "dns";
import { type RequestOptions } from "http";
import { ClientRequest as HttpClientRequest } from "node:http";
import { ClientRequest as HttpsClientRequest } from "node:https";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { isRedirectToPrivateIP } from "../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { getUrlFromHTTPRequestArgs } from "./http-request/getUrlFromHTTPRequestArgs";
import { wrapResponseHandler } from "./http-request/wrapResponseHandler";
import { isOptionsObject } from "./http-request/isOptionsObject";
import { wrap } from "../helpers/wrap";

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

    // Check if the hostname is inside the context
    const foundDirectSSRF = checkContextForSSRF({
      hostname: url.hostname,
      operation: `${module}.request`,
      context: context,
      port: port,
    });
    if (foundDirectSSRF) {
      return foundDirectSSRF;
    }

    // Check if the hostname is a private IP and if it's a redirect that was initiated by user input
    const foundSSRFRedirect = isRedirectToPrivateIP(url, context);
    if (foundSSRFRedirect) {
      return {
        operation: `${module}.request`,
        kind: "ssrf",
        source: foundSSRFRedirect.source,
        pathToPayload: foundSSRFRedirect.pathToPayload,
        metadata: {},
        payload: foundSSRFRedirect.payload,
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
      isOptionsObject(arg)
    );

    const url = getUrlFromHTTPRequestArgs(args, module);

    if (!optionObj) {
      const newOpts = {
        lookup: inspectDNSLookupCalls(
          lookup,
          agent,
          module,
          `${module}.request`,
          url
        ),
      };

      // You can also pass on response event handler as a callback as the second argument
      // But if the options object is added at the third position, it will be ignored
      if (args.length === 2 && typeof args[1] === "function") {
        return [args[0], newOpts, args[1]];
      }

      return args.concat(newOpts);
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

  wrapResponseHandler(args: unknown[], module: "http" | "https") {
    return args.map((arg) => {
      if (typeof arg === "function") {
        return wrapResponseHandler(args, module, arg);
      }

      return arg;
    });
  }

  wrapOnResponse(
    requestArgs: unknown[],
    module: "http" | "https",
    returnVal: unknown
  ) {
    if (
      returnVal instanceof HttpClientRequest ||
      returnVal instanceof HttpsClientRequest
    ) {
      wrap(returnVal, "on", function createWrappedOn(original) {
        return function wrappedOn(
          this: HttpClientRequest | HttpsClientRequest
        ) {
          // eslint-disable-next-line prefer-rest-params
          const args = Array.from(arguments);

          if (
            args.length === 2 &&
            args[0] === "response" &&
            typeof args[1] === "function"
          ) {
            const responseHandler = args[1];
            args[1] = wrapResponseHandler(requestArgs, module, responseHandler);

            return original.apply(this, args);
          }

          // eslint-disable-next-line prefer-rest-params
          return original.apply(this, arguments);
        };
      });
    }
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
        .modifyArguments("request", (args, subject, agent) => {
          return this.wrapResponseHandler(
            this.monitorDNSLookups(args, agent, module),
            module
          );
        })
        .modifyArguments("get", (args, subject, agent) => {
          return this.wrapResponseHandler(
            this.monitorDNSLookups(args, agent, module),
            module
          );
        })
        .inspectResult("request", (args, result, subject, agent) =>
          this.wrapOnResponse(args, module, result)
        )
        .inspectResult("get", (args, result, subject, agent) =>
          this.wrapOnResponse(args, module, result)
        );
    });
  }
}
