import type { NextFunction, Request, Response } from "express";
import { Hook } from "require-in-the-middle";
import { massWrap, wrap } from "shimmer";
import { Aikido } from "../Aikido";
import { runWithContext } from "../requestContext";
import { Integration } from "./Integration";

type Middleware = (req: Request, resp: Response, next: NextFunction) => void;

function createMiddleware(aikido: Aikido): Middleware {
  // Ensure that middleware has a name, don't inline this function
  const aikidoMiddleware = (req, resp, next) => {
    runWithContext(
      {
        aikido: aikido,
        request: {
          method: req.method,
          remoteAddress: req.socket.remoteAddress
            ? req.socket.remoteAddress
            : undefined,
          body: req.body ? req.body : undefined,
          url: new URL(
            req.protocol + "://" + req.get("host") + req.originalUrl
          ),
          headers: req.headers,
          query: req.query,
        },
      },
      () => {
        next();
      }
    );
  };

  return aikidoMiddleware;
}

// TODO: Support wildcard routes registered with app.all, app.route, app.use etc
// And methods like OPTIONS, HEAD, TRACE, CONNECT, PATCH
export class Express implements Integration {
  constructor(private readonly aikido: Aikido) {}

  setup(): void {
    new Hook(["express"], (exports) => {
      const aikido = this.aikido;

      massWrap(
        exports.application,
        ["post", "put", "delete"],
        function (original) {
          return function () {
            // When a route is registered, we want to push our middleware as last middleware (just before the handler itself)
            // Keep in mind that you can push multiple middlewares to a route, so we need to find the last one
            const args = Array.from(arguments);
            const handler = args.pop();
            args.push(createMiddleware(aikido));
            args.push(handler);

            return original.apply(this, args);
          };
        }
      );

      wrap(exports.application, "get", function (original) {
        return function () {
          // Same as POST, PUT and DELETE
          // However, if it's a single argument being a string, ignore it
          // e.g. app.get("title") should not be wrapped
          const args = Array.from(arguments);

          if (args.length === 1 && typeof args[0] === "string") {
            return original.apply(this, args);
          }

          const handler = args.pop();
          args.push(createMiddleware(aikido));
          args.push(handler);

          return original.apply(this, args);
        };
      });

      return exports;
    });
  }
}
