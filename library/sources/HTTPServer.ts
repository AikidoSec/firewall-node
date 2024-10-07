import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { Wrapper } from "../agent/Wrapper";
import { isPackageInstalled } from "../helpers/isPackageInstalled";
import { createRequestListener } from "./http-server/createRequestListener";
import { createStreamListener } from "./http-server/http2/createStreamListener";

export class HTTPServer implements Wrapper {
  private wrapRequestListener(args: unknown[], module: string, agent: Agent) {
    // Parse body only if next is installed
    // We can only read the body stream once
    // This is tricky, see replaceRequestBody(...)
    // e.g. Hono uses web requests and web streams
    // (uses Readable.toWeb(req) to convert to a web stream)
    const parseBody = isPackageInstalled("next") || isPackageInstalled("micro");

    // Without options
    // http(s).createServer(listener)
    if (args.length > 0 && typeof args[0] === "function") {
      return [createRequestListener(args[0], module, agent, parseBody)];
    }

    // With options
    // http(s).createServer({ ... }, listener)
    if (args.length > 1 && typeof args[1] === "function") {
      return [
        args[0],
        createRequestListener(args[1], module, agent, parseBody),
      ];
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

    return args;
  }

  wrap(hooks: Hooks) {
    ["http", "https", "http2"].forEach((module) => {
      hooks.addBuiltinModule(module).onRequire((exports, pkgInfo) => {
        // Server classes are not exported in the http2 module
        if (module !== "http2") {
          wrapExport(exports, "Server", pkgInfo, {
            modifyArgs: (args, agent) => {
              return this.wrapRequestListener(args, module, agent);
            },
          });
        }

        wrapExport(exports, "createServer", pkgInfo, {
          modifyArgs: (args, agent) => {
            return this.wrapRequestListener(args, module, agent);
          },
        });

        wrapNewInstance(exports, "createServer", pkgInfo, (instance) => {
          wrapExport(instance, "on", pkgInfo, {
            modifyArgs: (args, agent) => {
              return this.wrapOn(args, module, agent);
            },
          });
        });

        if (module === "http2") {
          wrapExport(exports, "createSecureServer", pkgInfo, {
            modifyArgs: (args, agent) => {
              return this.wrapRequestListener(args, module, agent);
            },
          });

          wrapNewInstance(
            exports,
            "createSecureServer",
            pkgInfo,
            (instance) => {
              wrapExport(instance, "on", pkgInfo, {
                modifyArgs: (args, agent) => {
                  return this.wrapOn(args, module, agent);
                },
              });
            }
          );
        }
      });
    });
  }
}
