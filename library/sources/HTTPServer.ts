import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { colorText } from "../helpers/colorText";
import { warnBox } from "../helpers/warnBox";
import { createRequestListener } from "./http-server/createRequestListener";
import { createSessionListener } from "./http-server/http2/createSessionListener";
import { createStreamListener } from "./http-server/http2/createStreamListener";

export class HTTPServer implements Wrapper {
  private warnedAboutMissingSource = false;

  private warnIfNoSourceWrapped(agent: Agent) {
    if (this.warnedAboutMissingSource) {
      return;
    }
    this.warnedAboutMissingSource = true;

    if (!agent.hasWebFrameworkLoaded()) {
      // oxlint-disable-next-line no-console
      console.warn(
        colorText(
          "red",
          warnBox(
            "Zen detected an HTTP server but no supported web framework. If you use a framework like Express or Fastify, it might be bundled (see https://github.com/AikidoSec/firewall-node/blob/main/docs/bundler.md). For the list of supported frameworks, see https://github.com/AikidoSec/firewall-node#web-frameworks"
          )
        )
      );
    }
  }

  private wrapRequestListener(args: unknown[], module: string, agent: Agent) {
    // Without options
    // http(s).createServer(listener)
    if (args.length > 0 && typeof args[0] === "function") {
      return [createRequestListener(args[0], module, agent)];
    }

    // With options
    // http(s).createServer({ ... }, listener)
    if (args.length > 1 && typeof args[1] === "function") {
      return [args[0], createRequestListener(args[1], module, agent)];
    }

    return args;
  }

  private wrapOn(args: unknown[], module: string, agent: Agent) {
    if (
      args.length < 2 ||
      typeof args[0] !== "string" ||
      typeof args[1] !== "function"
    ) {
      return args;
    }

    if (args[0] === "request") {
      return this.wrapRequestListener(args, module, agent);
    }

    if (module === "http2" && args[0] === "stream") {
      return [args[0], createStreamListener(args[1], module, agent)];
    }

    if (module === "http2" && args[0] === "session") {
      return [args[0], createSessionListener(args[1], agent)];
    }

    return args;
  }

  wrap(hooks: Hooks) {
    ["http", "https", "http2"].forEach((module) => {
      hooks.addBuiltinModule(module).onRequire((exports, pkgInfo) => {
        // Server classes are not exported in the http2 module
        if (module !== "http2") {
          wrapExport(exports, "Server", pkgInfo, {
            kind: undefined,
            modifyArgs: (args, agent) => {
              this.warnIfNoSourceWrapped(agent);
              return this.wrapRequestListener(args, module, agent);
            },
          });
        }

        wrapExport(exports, "createServer", pkgInfo, {
          kind: undefined,
          modifyArgs: (args, agent) => {
            this.warnIfNoSourceWrapped(agent);
            return this.wrapRequestListener(args, module, agent);
          },
          modifyReturnValue: (args, instance) => {
            wrapExport(instance, "on", pkgInfo, {
              kind: undefined,
              modifyArgs: (args, agent) => {
                return this.wrapOn(args, module, agent);
              },
            });
            return instance;
          },
        });

        if (module === "http2") {
          wrapExport(exports, "createSecureServer", pkgInfo, {
            kind: undefined,
            modifyArgs: (args, agent) => {
              this.warnIfNoSourceWrapped(agent);
              return this.wrapRequestListener(args, module, agent);
            },
            modifyReturnValue: (args, instance) => {
              wrapExport(instance, "on", pkgInfo, {
                kind: undefined,
                modifyArgs: (args, agent) => {
                  return this.wrapOn(args, module, agent);
                },
              });
              return instance;
            },
          });
        }
      });
    });
  }
}
