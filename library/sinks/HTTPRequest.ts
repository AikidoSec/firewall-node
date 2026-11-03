import * as dc from "diagnostics_channel";
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
import { wrapResponseHandler } from "./http-request/wrapResponseHandler";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isOptionsObject } from "./http-request/isOptionsObject";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { createAIResponseParser } from "../ai-governance/AIResponseParser";
import { isAIRequestPath } from "../ai-governance/parseAIResponse";
import { isAIProviderTrafficCaptureEnabled } from "../ai-governance/isAIProviderTrafficCaptureEnabled";
import { recordAICall } from "../ai-governance/recordAICall";
import { tapResponseBody } from "./http-request/tapResponseBody";

export class HTTPRequest implements Wrapper {
  private subscribedToResponses = false;
  private readonly requestURLs = new WeakMap<object, URL>();

  private subscribeToResponses() {
    if (!isAIProviderTrafficCaptureEnabled() || this.subscribedToResponses) {
      return;
    }

    this.subscribedToResponses = true;
    dc.subscribe("http.client.response.finish", this.onResponse);
  }

  private rememberRequestURL(
    args: unknown[],
    request: unknown,
    module: "http" | "https"
  ) {
    if (!this.subscribedToResponses) {
      return;
    }

    if (
      !request ||
      typeof request !== "object" ||
      !("method" in request) ||
      request.method !== "POST"
    ) {
      return;
    }

    const url = getUrlFromHTTPRequestArgs(args, module);
    if (url && isAIRequestPath(url.pathname)) {
      this.requestURLs.set(request, url);
    }
  }

  private readonly onResponse = (message: unknown) => {
    try {
      const { request, response } = message as {
        request: ClientRequest;
        response: IncomingMessage;
      };
      const url = this.requestURLs.get(request);
      this.requestURLs.delete(request);
      if (
        !url ||
        !response.statusCode ||
        response.statusCode < 200 ||
        response.statusCode >= 300
      ) {
        return;
      }

      const parser = createAIResponseParser({
        url,
        contentType: response.headers["content-type"],
        contentEncoding: response.headers["content-encoding"],
        onCall: (call) => recordAICall(url, call),
      });
      if (parser) {
        tapResponseBody(response, parser);
      }
    } catch {
      return;
    }
  };

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

  wrapResponseHandler(args: unknown[], module: "http" | "https") {
    if (args.find((arg) => typeof arg === "function")) {
      return args.map((arg) => {
        if (typeof arg === "function") {
          return wrapResponseHandler(args, module, arg);
        }

        return arg;
      });
    }

    return args.concat([wrapResponseHandler(args, module, () => {})]);
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
            modifyReturnValue: (args, returnValue) => {
              this.rememberRequestURL(args, returnValue, module);
              return returnValue;
            },
          });
        }
      });
    }
  }
}
