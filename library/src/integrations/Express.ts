/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response, Application } from "express";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { runWithContext } from "../agent/Context";
import { Integration } from "./Integration";
import { METHODS } from "node:http";

type Middleware = (req: Request, resp: Response, next: NextFunction) => void;

function createMiddleware(): Middleware {
  return (req, resp, next) => {
    runWithContext(
      {
        method: req.method,
        remoteAddress: req.ip,
        body: req.body ? req.body : undefined,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
        headers: req.headers,
        query: req.query,
        cookies: req.cookies ? req.cookies : {},
      },
      () => {
        next();
      }
    );
  };
}

export class Express implements Integration {
  getPackageName() {
    return "express";
  }

  private wrapRouteMethods(exports: unknown) {
    massWrap(
      // @ts-expect-error This is magic that TypeScript doesn't understand
      exports.Route.prototype,
      // @ts-expect-error This is magic that TypeScript doesn't understand
      METHODS.map((method) => method.toLowerCase()),
      function (original) {
        return function (this: Application) {
          const args = Array.from(arguments);
          const handler = args.pop();
          args.push(createMiddleware());
          args.push(handler);

          // @ts-expect-error This is magic that TypeScript doesn't understand
          return original.apply(this, args);
        };
      }
    );
  }

  private onModuleRequire<T>(exports: T): T {
    this.wrapRouteMethods(exports);

    return exports;
  }

  setup() {
    new Hook(["express"], this.onModuleRequire.bind(this));
  }
}
