/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response, Application } from "express";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { runWithContext } from "../Context";
import { Integration } from "./Integration";
import * as methods from "methods";

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

  setup(): boolean {
    new Hook(["express"], (exports) => {
      // @ts-expect-error This is magic that TypeScript doesn't understand
      massWrap(exports.Route.prototype, methods, function (original) {
        return function (this: Application) {
          const args = Array.from(arguments);
          const handler = args.pop();
          args.push(createMiddleware());
          args.push(handler);

          // @ts-expect-error This is magic that TypeScript doesn't understand
          return original.apply(this, args);
        };
      });

      return exports;
    });

    return true;
  }
}
