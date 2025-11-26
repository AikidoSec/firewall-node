/* eslint-disable max-lines-per-function */
import { getRegisteredRouteParams } from "../agent/addRouteParam";
import { getInstance } from "../agent/AgentSingleton";
import { getContext, runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import type { HttpFunction } from "@google-cloud/functions-framework";
import { buildRouteFromURL } from "../helpers/buildRouteFromURL";
import { shouldDiscoverRoute } from "./http-server/shouldDiscoverRoute";
import { isPlainObject } from "../helpers/isPlainObject";

export function getFlushEveryMS(): number {
  if (process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS) {
    const parsed = parseInt(
      process.env.AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS,
      10
    );
    // Minimum is 1 minute
    if (!isNaN(parsed) && parsed >= 60 * 1000) {
      return parsed;
    }
  }

  return 10 * 60 * 1000; // 10 minutes
}

export function getTimeoutInMS(): number {
  if (process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS) {
    const parsed = parseInt(process.env.AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS, 10);
    // Minimum is 1 second
    if (!isNaN(parsed) && parsed >= 1000) {
      return parsed;
    }
  }

  return 1000; // 1 second
}

export function createCloudFunctionWrapper(fn: HttpFunction): HttpFunction {
  const agent = getInstance();

  let lastFlushStatsAt: number | undefined = undefined;
  let startupEventSent = false;

  return async (req, res) => {
    // Send startup event on first invocation
    if (agent && !startupEventSent) {
      startupEventSent = true;
      try {
        await agent.onStart(getTimeoutInMS());
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error(`Aikido: Failed to start agent: ${err.message}`);
      }
    }

    const url = req.protocol + "://" + req.get("host") + req.originalUrl;

    return await runWithContext(
      {
        method: req.method,
        remoteAddress: req.ip,
        body: req.body ? req.body : undefined,
        url: url,
        headers: req.headers,
        query: req.query,
        /* c8 ignore next */
        cookies: req.cookies ? req.cookies : {},
        routeParams: {},
        source: "cloud-function/http",
        route: buildRouteFromURL(url, getRegisteredRouteParams()),
      },
      async () => {
        try {
          return await fn(req, res);
        } finally {
          const context = getContext();
          if (agent && context) {
            if (
              context.route &&
              context.method &&
              Number.isInteger(res.statusCode)
            ) {
              const shouldDiscover = shouldDiscoverRoute({
                statusCode: res.statusCode,
                method: context.method,
                route: context.route,
              });

              if (shouldDiscover) {
                agent.onRouteExecute(context);
              }
            }

            const stats = agent.getInspectionStatistics();
            stats.onRequest();

            await agent.getPendingEvents().waitUntilSent(getTimeoutInMS());

            if (
              lastFlushStatsAt === undefined ||
              lastFlushStatsAt + getFlushEveryMS() < performance.now()
            ) {
              await agent.flushStats(getTimeoutInMS());
              lastFlushStatsAt = performance.now();
            }
          }
        }
      }
    );
  };
}

export class FunctionsFramework implements Wrapper {
  onRequire(exports: any, pkgInfo: PartialWrapPackageInfo) {
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
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@google-cloud/functions-framework")
      .withVersion("^4.0.0 || ^3.0.0")
      .onRequire((exports, pkgInfo) => {
        this.onRequire(exports, pkgInfo);
      })
      .addFileInstrumentation({
        path: "build/src/function_registry.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => {
            if (vars.length > 0 && isPlainObject(vars[0])) {
              const exports = vars[0];
              this.onRequire(exports, pkgInfo);
            }
          },
        },
      });
  }
}
