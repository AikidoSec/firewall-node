/* eslint-disable prefer-rest-params */
import type { ServerRoute, ReqRefDefaults, Lifecycle } from "@hapi/hapi";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapRequestHandler } from "./hapi/wrapRequestHandler";

export class Hapi implements Wrapper {
  /**
   * Wrap the route handler function
   */
  private wrapRoute(args: unknown[], agent: Agent) {
    if (
      args.length < 1 ||
      (!isPlainObject(args[0]) && !Array.isArray(args[0]))
    ) {
      return args;
    }

    const routeOptions = Array.isArray(args[0])
      ? (args[0] as ServerRoute<ReqRefDefaults>[])
      : ([args[0]] as unknown as ServerRoute<ReqRefDefaults>[]);

    for (const route of routeOptions) {
      if (typeof route.handler === "function") {
        route.handler = wrapRequestHandler(
          route.handler as Lifecycle.Method<ReqRefDefaults>,
          agent
        );
      }
      if (
        isPlainObject(route.options) &&
        typeof route.options.handler === "function"
      ) {
        route.options.handler = wrapRequestHandler(
          route.options.handler as Lifecycle.Method<ReqRefDefaults>,
          agent
        );
      }
    }

    return args;
  }

  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as Lifecycle.Method<ReqRefDefaults>, agent);
    });
  }

  /**
   * Wrap the decorate function if it's a request handler
   */
  private wrapDecorate(args: unknown[], agent: Agent) {
    if (
      args.length < 3 ||
      typeof args[0] !== "string" ||
      typeof args[2] !== "function" ||
      args[0] !== "handler"
    ) {
      return args;
    }

    // Todo wrap returned function of args[2]

    return args;
  }

  wrap(hooks: Hooks) {
    const hapi = hooks.addPackage("@hapi/hapi").withVersion("^21.0.0");
    const exports = hapi.addSubject((exports) => exports);

    const subjects = [
      exports.inspectNewInstance("server").addSubject((exports) => exports),
      exports.inspectNewInstance("Server").addSubject((exports) => exports),
    ];

    for (const subject of subjects) {
      subject.modifyArguments("route", (args, original, agent) => {
        return this.wrapRoute(args, agent);
      });
      subject.modifyArguments("ext", (args, original, agent) => {
        return this.wrapArgs(args, agent);
      });
      subject.modifyArguments("decorate", (args, original, agent) => {
        return this.wrapDecorate(args, agent);
      });
    }
  }
}
