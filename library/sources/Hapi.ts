/* eslint-disable prefer-rest-params */
import type { ServerRoute, ReqRefDefaults, Lifecycle } from "@hapi/hapi";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapRequestHandler } from "./hapi/wrapRequestHandler";

export class Hapi implements Wrapper {
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
    }

    return args;
  }

  wrap(hooks: Hooks) {
    const hapi = hooks.addPackage("@hapi/hapi").withVersion("^21.0.0");

    hapi
      .addSubject((exports) => exports)
      .inspectNewInstance("server")
      .addSubject((exports) => exports)
      .modifyArguments("route", (args, original, agent) => {
        return this.wrapRoute(args, agent);
      });
  }
}
