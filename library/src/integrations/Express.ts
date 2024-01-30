/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response, Application } from "express";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Aikido } from "../Aikido";
import { runWithContext } from "../RequestContext";
import { Integration } from "./Integration";

type Middleware = (req: Request, resp: Response, next: NextFunction) => void;

function createMiddleware(aikido: Aikido): Middleware {
  return (req, resp, next) => {
    runWithContext(
      {
        aikido: aikido,
        request: {
          method: req.method,
          remoteAddress: req.ip,
          body: req.body ? req.body : undefined,
          url: req.protocol + "://" + req.get("host") + req.originalUrl,
          headers: req.headers,
          query: req.query,
          cookies: req.cookies ? req.cookies : {},
        },
      },
      () => {
        next();
      }
    );
  };
}

const METHODS = ["get", "post", "put", "delete"] as const;
type Method = (typeof METHODS)[number];

// TODO: Support wildcard routes registered with app.all, app.route, app.use etc
// And methods like OPTIONS, HEAD, TRACE, CONNECT, PATCH
export class Express implements Integration {
  constructor(private readonly aikido: Aikido) {}

  setup(): void {
    new Hook(["express"], (exports) => {
      const aikido = this.aikido;

      for (const method of METHODS) {
        wrap<Application, Method>(
          // @ts-expect-error Exports are not typed properly
          exports.application,
          method,
          function (original) {
            return function (this: Application) {
              const args = Array.from(arguments);

              // If it's a single argument being a string, ignore it
              // e.g. app.get("title") should not be wrapped
              if (
                method === "get" &&
                args.length === 1 &&
                typeof args[0] === "string"
              ) {
                // @ts-expect-error Argument length cannot be checked properly
                return original.apply(this, args);
              }

              const handler = args.pop();
              args.push(createMiddleware(aikido));
              args.push(handler);
              aikido.installed();

              // @ts-expect-error Argument length cannot be checked properly
              return original.apply(this, args);
            };
          }
        );
      }

      return exports;
    });
  }
}
