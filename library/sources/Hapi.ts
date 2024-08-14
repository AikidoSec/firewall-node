/* eslint-disable prefer-rest-params */
import type {
  ServerRoute,
  Lifecycle,
  HandlerDecorationMethod,
} from "@hapi/hapi";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapRequestHandler } from "./hapi/wrapRequestHandler";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Hapi implements Wrapper {
  private wrapRouteHandler(args: unknown[], agent: Agent) {
    if (
      args.length < 1 ||
      (!isPlainObject(args[0]) && !Array.isArray(args[0]))
    ) {
      return args;
    }

    const routeOptions = Array.isArray(args[0])
      ? (args[0] as ServerRoute[])
      : ([args[0]] as unknown as ServerRoute[]);

    for (const route of routeOptions) {
      if (typeof route.handler === "function") {
        route.handler = wrapRequestHandler(
          route.handler as Lifecycle.Method,
          agent
        );
      }

      if (
        isPlainObject(route.options) &&
        typeof route.options.handler === "function"
      ) {
        route.options.handler = wrapRequestHandler(
          route.options.handler as Lifecycle.Method,
          agent
        );
      }
    }

    return args;
  }

  private wrapExtensionFunction(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as Lifecycle.Method, agent);
    });
  }

  private wrapDecorateFunction(args: unknown[], agent: Agent) {
    if (
      args.length < 3 ||
      args[0] !== "handler" ||
      typeof args[2] !== "function"
    ) {
      return args;
    }

    const decorator = args[2] as unknown as HandlerDecorationMethod;

    function wrappedDecorator() {
      // @ts-expect-error We don't know the type of this
      const handler = decorator.apply(this, arguments);

      return wrapRequestHandler(handler, agent);
    }

    args[2] = wrappedDecorator;

    return args;
  }

  private wrapServer(server: unknown, pkgInfo: WrapPackageInfo) {
    wrapExport(server, "route", pkgInfo, {
      modifyArgs: (args, agent) => this.wrapRouteHandler(args, agent),
    });
    wrapExport(server, "ext", pkgInfo, {
      modifyArgs: (args, agent) => this.wrapExtensionFunction(args, agent),
    });
    wrapExport(server, "decorate", pkgInfo, {
      modifyArgs: (args, agent) => this.wrapDecorateFunction(args, agent),
    });
  }

  wrap(hooks: Hooks) {
    const hapi = hooks
      .addPackage("@hapi/hapi")
      .withVersion("^21.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "Server", pkgInfo, (server) => {
          this.wrapServer(server, pkgInfo);
        });
        wrapNewInstance(exports, "server", pkgInfo, (server) => {
          this.wrapServer(server, pkgInfo);
        });
      });
  }
}
