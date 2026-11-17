import { lookup } from "dns";
import {
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
} from "http";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { isRedirectToPrivateIP } from "../vulnerabilities/ssrf/isRedirectToPrivateIP";
import { normalizeHostname } from "../helpers/normalizeHostname";
import {
  getRequestOptions,
  getUrlFromHTTPRequestArgs,
} from "./http-request/getUrlFromHTTPRequestArgs";
import { onHTTPResponse } from "./http-request/onHTTPResponse";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isOptionsObject } from "./http-request/isOptionsObject";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class HTTPRequest implements Wrapper {
  private readonly requestUrls = new WeakMap<object, URL>();

  private inspectHostname(
    agent: Agent,
    url: URL,
    port: number | undefined,
    module: "http" | "https"
  ): InterceptorResult {
    const hostname = normalizeHostname(url.hostname);

    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    if (typeof port === "number" && port > 0) {
      agent.onConnectHostname(hostname, port);
    }

    if (agent.getConfig().shouldBlockOutgoingRequest(hostname)) {
      return {
        hostname: hostname,
        operation: `${module}.request`,
      };
    }

    const context = getContext();

    if (!context) {
      return undefined;
    }

    // Check if the hostname is inside the context
    const foundDirectSSRF = checkContextForSSRF({
      hostname: hostname,
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

  private inspectHttpRequest(
    args: unknown[],
    agent: Agent,
    module: "http" | "https"
  ) {
    if (args.length <= 0) {
      return undefined;
    }

    const options = getRequestOptions(args);
    if (typeof options?.socketPath === "string" && options.socketPath) {
      return this.checkForPathTraversalInSocketPath(args, module);
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

  private checkForPathTraversalInSocketPath(
    args: unknown[],
    module: "http" | "https"
  ): InterceptorResult {
    const options = getRequestOptions(args);
    const context = getContext();

    if (
      !options ||
      typeof options.socketPath !== "string" ||
      options.socketPath.length === 0 ||
      !context
    ) {
      return undefined;
    }

    const foundPathTraversal = checkContextForPathTraversal({
      filename: options.socketPath,
      operation: `${module}.request`,
      context: context,
    });

    if (foundPathTraversal) {
      return foundPathTraversal;
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

  private handleResponseFinish({
    request,
    response,
  }: {
    request: ClientRequest;
    response: IncomingMessage;
  }) {
    const context = getContext();

    if (!context) {
      return;
    }

    const url = this.requestUrls.get(request);
    if (!url) {
      return;
    }

    try {
      // Copy the URL because the hostname gets normalized
      onHTTPResponse(new URL(url.href), response, context);
    } catch {
      // Ignore errors
    }
  }

  private subscribeToResponses() {
    const { subscribe } =
      require("diagnostics_channel") as typeof import("diagnostics_channel");

    // diagnostics_channel.subscribe(...) was added in Node.js 16.17.0 and 18.7.0 (not available in 17.x),
    if (typeof subscribe !== "function") {
      return;
    }

    subscribe("http.client.response.finish", (message) =>
      this.handleResponseFinish(
        message as { request: ClientRequest; response: IncomingMessage }
      )
    );
  }

  private rememberRequestUrl(
    args: unknown[],
    request: unknown,
    module: "http" | "https"
  ) {
    if (typeof request !== "object" || request === null) {
      return request;
    }

    const url = getUrlFromHTTPRequestArgs(args, module);
    if (url) {
      this.requestUrls.set(request, url);
    }

    return request;
  }

  wrap(hooks: Hooks) {
    const modules = ["http", "https"] as const;
    const methods = ["request", "get"] as const;

    this.subscribeToResponses();

    for (const module of modules) {
      hooks.addBuiltinModule(module).onRequire((exports, pkgInfo) => {
        for (const method of methods) {
          wrapExport(exports, method, pkgInfo, {
            kind: "outgoing_http_op",
            // Whenever a request is made, we'll check the hostname whether it's a private IP
            inspectArgs: (args, agent) =>
              this.inspectHttpRequest(args, agent, module),
            // Whenever a request is made, we'll modify the options to pass a custom lookup function
            // that will inspect resolved IP address (and thus preventing TOCTOU attacks)
            modifyArgs: (args, agent) =>
              this.monitorDNSLookups(args, agent, module),
            // Remember where the request is going to, used to detect redirects
            modifyReturnValue: (args, returnValue) =>
              this.rememberRequestUrl(args, returnValue, module),
          });
        }
      });
    }
  }
}
