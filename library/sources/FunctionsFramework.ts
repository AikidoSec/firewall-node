import { getInstance } from "../agent/AgentSingleton";
import { getContext, runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import type { HttpFunction } from "@google-cloud/functions-framework";

export function createCloudFunctionWrapper(fn: HttpFunction): HttpFunction {
  const agent = getInstance();

  let lastFlushStatsAt: number | undefined = undefined;
  const flushEveryMS = 10 * 60 * 1000;

  return async (req, res) => {
    return await runWithContext(
      {
        method: req.method,
        remoteAddress: req.ip,
        body: req.body ? req.body : undefined,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
        headers: req.headers,
        query: req.query,
        /* c8 ignore next */
        cookies: req.cookies ? req.cookies : {},
        routeParams: {},
        source: "cloud-function/http",
        route: undefined,
      },
      async () => {
        try {
          return await fn(req, res);
        } finally {
          const context = getContext();
          if (agent && context) {
            const stats = agent.getInspectionStatistics();
            stats.onRequest();

            if (
              lastFlushStatsAt === undefined ||
              lastFlushStatsAt + flushEveryMS < performance.now()
            ) {
              await agent.flushStats(1000);
              lastFlushStatsAt = performance.now();
            }
          }
        }
      }
    );
  };
}

export class FunctionsFramework implements Wrapper {
  wrap(hooks: Hooks) {
    hooks
      .addPackage("@google-cloud/functions-framework")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports, "http", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => {
            if (args.length === 2 && typeof args[1] === "function") {
              const httpFunction = args[1] as HttpFunction;
              args[1] = createCloudFunctionWrapper(httpFunction);
            }

            return args;
          },
        });
      });
  }
}
