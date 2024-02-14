/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response, Application } from "express";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { runWithContext } from "../agent/Context";
import { Wrapper } from "../agent/Wrapper";
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

export class Express implements Wrapper {
  // Whenever app.get, app.post, etc. is called, we want to inject our middleware
  // So that runWithContext is called for every request
  // Whenever a MongoDB query is made, we want to inspect the filter
  // And cross-reference it with the user supplied data of the request
  // It's important that our middleware should be the last middleware in the chain
  // So that we have access to the parsed body, cookies, etc.
  private wrapRouteMethods(exports: unknown) {
    massWrap(
      // @ts-expect-error This is magic that TypeScript doesn't understand
      exports.Route.prototype,
      // @ts-expect-error This is magic that TypeScript doesn't understand
      METHODS.map((method) => method.toLowerCase()),
      function wrapRouteMethod(original) {
        return function injectMiddleware(this: Application) {
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

  wrap() {
    new Hook(["express"], this.onModuleRequire.bind(this));
  }
}
