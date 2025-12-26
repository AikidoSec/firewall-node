import { lookup } from "dns";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { wrapDispatch } from "./undici/wrapDispatch";
import { wrapExport } from "../agent/hooks/wrapExport";
import { getHostnameAndPortFromArgs } from "./undici/getHostnameAndPortFromArgs";
import type { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import {
  getUrlFromRequest,
  type UndiciRequest,
} from "./undici/getUrlFromRequest";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { createWrappedFunction, wrap } from "../helpers/wrap";
import { isPlainObject } from "../helpers/isPlainObject";

const methods = [
  "request",
  "stream",
  "pipeline",
  "connect",
  "fetch",
  "upgrade",
];

export class Undici implements Wrapper {
  private inspectHostname(
    agent: Agent,
    hostname: string,
    port: number | undefined,
    method: string
  ): InterceptorResult {
    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    if (typeof port === "number" && port > 0) {
      agent.onConnectHostname(hostname, port);
    }

    if (agent.getConfig().shouldBlockOutgoingRequest(hostname)) {
      return {
        operation: `undici.${method}`,
        hostname: hostname,
      };
    }

    const context = getContext();

    if (!context) {
      return undefined;
    }

    return checkContextForSSRF({
      hostname: hostname,
      operation: `undici.${method}`,
      context,
      port,
    });
  }

  private inspect(
    args: unknown[],
    agent: Agent,
    method: string
  ): InterceptorResult {
    const hostnameAndPort = getHostnameAndPortFromArgs(args);
    if (hostnameAndPort) {
      const attack = this.inspectHostname(
        agent,
        hostnameAndPort.hostname,
        hostnameAndPort.port,
        method
      );
      if (attack) {
        return attack;
      }
    }

    return undefined;
  }

  private patchGlobalDispatcher(
    agent: Agent,
    undiciModule: typeof import("undici-v7")
  ) {
    const dispatcher = new undiciModule.Agent({
      connect: {
        lookup: inspectDNSLookupCalls(
          lookup,
          agent,
          "undici",
          // We don't know the method here, so we just use "undici.[method]"
          "undici.[method]"
        ),
      },
    });

    dispatcher.dispatch = wrapDispatch(dispatcher.dispatch, agent);

    // We'll set a global dispatcher that will inspect the resolved IP address (and thus preventing TOCTOU attacks)
    undiciModule.setGlobalDispatcher(dispatcher);
  }

  private patchExports(
    exports: typeof import("undici-v7"),
    pkgInfo: PartialWrapPackageInfo
  ) {
    const agent = getInstance();

    if (!agent) {
      // No agent, we can't do anything
      return;
    }

    // Immediately patch the global dispatcher before returning the module
    // The global dispatcher might be overwritten by the user
    // But at least they have a reference to our dispatcher instead of the original one
    // (In case the user has a custom dispatcher that conditionally calls the original dispatcher)
    this.patchGlobalDispatcher(agent, exports);

    // Print a warning that we can't provide protection if setGlobalDispatcher is called
    wrapExport(exports, "setGlobalDispatcher", pkgInfo, {
      kind: undefined,
      inspectArgs: (_, agent) => {
        agent.log(
          `undici.setGlobalDispatcher(..) was called, we can't guarantee protection!`
        );
      },
    });

    // Wrap all methods that can make requests
    for (const method of methods) {
      wrapExport(exports, method, pkgInfo, {
        kind: "outgoing_http_op",
        // Whenever a request is made, we'll check the hostname whether it's a private IP
        inspectArgs: (args, agent) => {
          return this.inspect(args, agent, method);
        },
      });
    }
  }

  instrumentDiagnosticChannels(exports: any, pkgInfo: PartialWrapPackageInfo) {
    // Undici does not publish to the channels if no subscribers are present
    exports.channels.create.subscribe(() => {});
    exports.channels.headers.subscribe(() => {});

    wrapExport(exports.channels.create, "publish", pkgInfo, {
      kind: undefined,
      inspectArgs: (args, agent) => {
        if (
          args.length === 0 ||
          !args[0] ||
          typeof args[0] !== "object" ||
          !("request" in args[0])
        ) {
          return;
        }
        const url = getUrlFromRequest(args[0].request as UndiciRequest);
        if (!url) {
          return;
        }

        const attack = this.inspectHostname(
          agent,
          url.hostname,
          getPortFromURL(url),
          "[method]"
        );
        if (attack) {
          return attack;
        }
      },
    });

    wrapExport(exports.channels.headers, "publish", pkgInfo, {
      kind: undefined,
      inspectArgs: (args, agent) => {
        // Todo add SSRF redirect protection here!
        //console.error("headers args:", args);
      },
    });

    return exports;
  }

  modifyBuildConnectorArgs(args: unknown[], agent: Agent) {
    if (!isPlainObject(args[0])) {
      return args;
    }

    // Todo: Make more stable, modify if options already have a lookup function

    args[0].lookup = inspectDNSLookupCalls(
      lookup,
      agent,
      "undici",
      // We don't know the method here, so we just use "undici.[method]"
      "undici.[method]"
    );

    return args;
  }

  wrap(hooks: Hooks) {
    if (!isVersionGreaterOrEqual("16.8.0", getSemverNodeVersion())) {
      // Undici requires Node.js 16.8+ (due to web streams)
      return;
    }

    hooks
      .addPackage("undici")
      .withVersion("^6.0.0 || ^7.0.0")
      .onFileRequire("lib/core/diagnostics.js", (exports, pkgInfo) =>
        this.instrumentDiagnosticChannels(exports, pkgInfo)
      )
      .onFileRequire("lib/core/connect.js", (exports, pkgInfo) => {
        return wrapExport(exports, undefined, pkgInfo, {
          kind: undefined,
          modifyArgs: (args, agent) =>
            this.modifyBuildConnectorArgs(args, agent),
        });
      })
      .addFileInstrumentation({
        path: "lib/core/diagnostics.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) =>
            this.instrumentDiagnosticChannels(vars[0], pkgInfo),
        },
      })
      .addFileInstrumentation({
        path: "lib/core/connect.js",
        functions: [
          {
            name: "buildConnector",
            nodeType: "FunctionDeclaration",
            operationKind: undefined,
            modifyArgs: (args, agent) =>
              this.modifyBuildConnectorArgs(args, agent),
          },
        ],
      });

    hooks
      .addPackage("undici")
      .withVersion("^4.0.0 || ^5.0.0")
      .onRequire((exports, pkgInfo) => this.patchExports(exports, pkgInfo))
      .addFileInstrumentation({
        path: "./index.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => this.patchExports(vars[0], pkgInfo),
        },
      });
  }
}
