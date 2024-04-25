/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response } from "express";
import { Agent } from "../agent/Agent";
import { getContext, runWithContext, User } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { METHODS } from "http";

type Middleware = (req: Request, resp: Response, next: NextFunction) => void;

type RequestWithUser = Request & {
  aikido?: { user?: { id?: unknown; name?: unknown } };
};

// eslint-disable-next-line max-lines-per-function
function createMiddleware(agent: Agent): Middleware {
  // eslint-disable-next-line max-lines-per-function
  return (req: RequestWithUser, resp, next) => {
    let route = undefined;
    if (typeof req.route.path === "string") {
      route = req.route.path;
    } else if (req.route.path instanceof RegExp) {
      route = req.route.path.toString();
    }

    if (route) {
      agent.onRouteExecute(req.method, req.route.path);
    }

    let user: User | undefined = undefined;
    if (
      req.aikido &&
      req.aikido.user &&
      typeof req.aikido.user.id === "string"
    ) {
      user = { id: req.aikido.user.id };
      if (typeof req.aikido.user.name === "string") {
        user.name = req.aikido.user.name;
      }
    }

    runWithContext(
      {
        method: req.method,
        remoteAddress: req.ip,
        body: req.body ? req.body : undefined,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
        headers: req.headers,
        routeParams: req.params,
        query: req.query,
        /* c8 ignore next */
        cookies: req.cookies ? req.cookies : {},
        source: "express",
        route: route,
        user: user,
      },
      () => {
        try {
          // Run the user's middleware
          // Regardless of whether the middleware throws an error or not
          // We want to count the request
          next();
        } finally {
          const context = getContext();
          if (context) {
            agent.getInspectionStatistics().onRequest({
              blocked: agent.shouldBlock(),
              attackDetected: !!context.attackDetected,
            });
          }
        }
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
  //
  // app.get("/path", json(), (req, res) => { ... }))
  // we will inject our middleware ^ here
  // app.get("/path", json(), middleware(), (req, res) => { ... }))
  //
  // Without having to change the user's code
  private addMiddleware(args: unknown[], agent: Agent) {
    const handler = args.pop();
    args.push(createMiddleware(agent));
    args.push(handler);

    return args;
  }

  wrap(hooks: Hooks) {
    const express = hooks.addPackage("express").withVersion("^4.0.0");

    const route = express.addSubject((exports) => exports.Route.prototype);

    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    expressMethodNames.forEach((method) => {
      route.modifyArguments(method, (args, subject, agent) =>
        this.addMiddleware(args, agent)
      );
    });
  }
}
