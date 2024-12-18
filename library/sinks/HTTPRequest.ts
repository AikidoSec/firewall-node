import { lookup } from "dns";
import { type RequestOptions, ClientRequest } from "http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { isRedirectToPrivateIP } from "../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { getUrlFromHTTPRequestArgs } from "./http-request/getUrlFromHTTPRequestArgs";
import { wrapResponseHandler } from "./http-request/wrapResponseHandler";
import { wrapExport } from "../agent/hooks/wrapExport";
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
        pathsToPayload: foundSSRFRedirect.pathsToPayload,
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
    const stackTraceCallingLocation = new Error();

    if (!optionObj) {
      const newOpts = {
        lookup: inspectDNSLookupCalls(
          lookup,
          agent,
          module,
          `${module}.request`,
          url,
          stackTraceCallingLocation
        ),
      };

      // You can also pass on response event handler as a callback as the second argument
      // But if the options object is added at the third position, it will be ignored
      if (args.length === 2 && typeof args[1] === "function") {
        return [args[0], newOpts, args[1]];
      }

      return args.concat(newOpts);
    }

    let nativeLookup: NonNullable<RequestOptions["lookup"]> = lookup;
    if ("lookup" in optionObj && typeof optionObj.lookup === "function") {
      // If the user has passed a custom lookup function, we'll use that instead
      nativeLookup = optionObj.lookup;
    }

    optionObj.lookup = inspectDNSLookupCalls(
      nativeLookup,
      agent,
      module,
      `${module}.request`,
      url,
      stackTraceCallingLocation
    ) as NonNullable<RequestOptions["lookup"]>;

    return args;
  }

  wrapResponseHandler(args: unknown[], module: "http" | "https") {
    // Wrap the response handler if there is one
    // so that we can inspect the response for SSRF attacks (using redirects)
    // e.g. http.request("http://example.com", (response) => {})
    return args.map((arg) => {
      if (typeof arg === "function") {
        return wrapResponseHandler(args, module, arg);
      }

      return arg;
    });
  }

  wrapEventListeners(
    requestArgs: unknown[],
    module: "http" | "https",
    returnVal: unknown
  ) {
    if (!(returnVal instanceof ClientRequest)) {
      return;
    }

    // Whenever a response event is added, we'll wrap the handler
    // so that we can inspect the response for SSRF attacks (using redirects)

    // You can add listeners in multiple ways:
    // http.request("http://example.com").on("response", (response) => {})
    // http.request("http://example.com").addListener("response", (response) => {})
    // http.request("http://example.com").once("response", (response) => {})
    // http.request("http://example.com").prependListener("response", (response) => {})
    // http.request("http://example.com").prependOnceListener("response", (response) => {})
    const methods = [
      "on",
      "addListener",
      "once",
      "prependListener",
      "prependOnceListener",
    ];

    for (const method of methods) {
      wrap(returnVal, method, function createWrappedOn(original) {
        return function wrappedOn(this: ClientRequest) {
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
    const methods = ["request", "get"] as const;

    for (const module of modules) {
      hooks.addBuiltinModule(module).onRequire((exports, pkgInfo) => {
        for (const method of methods) {
          wrapExport(exports, method, pkgInfo, {
            // Whenever a request is made, we'll check the hostname whether it's a private IP
            inspectArgs: (args, agent) =>
              this.inspectHttpRequest(args, agent, module),
            // Whenever a request is made, we'll modify the options to pass a custom lookup function
            // that will inspect resolved IP address (and thus preventing TOCTOU attacks)
            modifyArgs: (args, agent) => {
              return this.wrapResponseHandler(
                this.monitorDNSLookups(args, agent, module),
                module
              );
            },
            modifyReturnValue: (args, returnValue, agent) => {
              this.wrapEventListeners(args, module, returnValue);

              return returnValue;
            },
          });
        }
      });
    }
  }
}
