import { RequestListener } from "http";
import { Agent } from "../agent/Agent";
import { getContext, runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  return function requestListener(req, res) {
    return runWithContext(
      {
        url: req.url,
        method: req.method,
        headers: req.headers,
        route: undefined,
        query: {},
        source: `${module}.createServer`,
        routeParams: {},
        cookies: {},
        body: undefined,
        remoteAddress: undefined,
      },
      () => {
        res.on("finish", () => {
          const context = getContext();
          agent.getInspectionStatistics().onRequest();
          if (context && context.attackDetected) {
            agent.getInspectionStatistics().onDetectedAttack({
              blocked: agent.shouldBlock(),
            });
          }
        });

        return listener(req, res);
      }
    );
  };
}

export class HTTPServer implements Wrapper {
  private wrapRequestListener(args: unknown[], module: string, agent: Agent) {
    // Without options
    // http(s).createServer(listener)
    if (args.length > 0 && typeof args[0] === "function") {
      return [createRequestListener(args[0], module, agent)];
    }

    // With options
    // http(s).createServer({ ... }, listener)
    if (
      args.length > 1 &&
      isPlainObject(args[0]) &&
      typeof args[1] === "function"
    ) {
      return [args[0], createRequestListener(args[1], module, agent)];
    }

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addBuiltinModule("http")
      .addSubject((exports) => exports)
      .modifyArguments("createServer", (args, subject, agent) => {
        return this.wrapRequestListener(args, "http", agent);
      });

    hooks
      .addBuiltinModule("https")
      .addSubject((exports) => exports)
      .modifyArguments("createServer", (args, subject, agent) => {
        return this.wrapRequestListener(args, "https", agent);
      });
  }
}
