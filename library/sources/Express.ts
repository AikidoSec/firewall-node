/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response } from "express";
import { Agent } from "../agent/Agent";
import { getContext, runWithContext, User } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { METHODS } from "http";

type RequestWithAikido = Request & {
  // We need to keep track of whether we've counted the request or not
  // We don't want to count the request more than once
  // Since contexts can be nested
  __AIKIDO__?: {
    requestCounted: boolean;
    attackDetected: boolean;
    user?: { id?: unknown; name?: unknown };
  };
};

type Middleware = (
  req: RequestWithAikido,
  resp: Response,
  next: NextFunction
) => void;

// eslint-disable-next-line max-lines-per-function
function createMiddleware(agent: Agent, path: string | undefined): Middleware {
  // eslint-disable-next-line max-lines-per-function
  const middleware: Middleware = (req, resp, next) => {
    let route = path;
    if (typeof req.route?.path === "string") {
      route = req.route.path;
    } else if (req.route?.path instanceof RegExp) {
      route = req.route.path.toString();
    }

    if (route) {
      agent.onRouteExecute(req.method, route);
    }

    let user: User | undefined = undefined;
    if (
      req.__AIKIDO__ &&
      req.__AIKIDO__.user &&
      typeof req.__AIKIDO__.user.id === "string"
    ) {
      user = { id: req.__AIKIDO__.user.id };
      if (typeof req.__AIKIDO__.user.name === "string") {
        user.name = req.__AIKIDO__.user.name;
      }
    }

    if (user) {
      if (agent.getConfig().shouldBlockUser(user.id)) {
        return resp.sendStatus(403);
      }

      agent.getUsers().addUser({
        id: user.id,
        name: user.name,
        lastIpAddress: req.ip,
      });
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
          if (!req.__AIKIDO__) {
            req.__AIKIDO__ = {
              requestCounted: false,
              attackDetected: false,
            };
          }

          if (!req.__AIKIDO__.requestCounted) {
            agent.getInspectionStatistics().onRequest();
            req.__AIKIDO__.requestCounted = true;
          }

          const context = getContext();

          if (
            context &&
            context.attackDetected &&
            !req.__AIKIDO__.attackDetected
          ) {
            agent.getInspectionStatistics().onDetectedAttack({
              blocked: agent.shouldBlock(),
            });
            req.__AIKIDO__.attackDetected = true;
          }
        }
      }
    );
  };

  return middleware;
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
  private addMiddlewareToRoute(args: unknown[], agent: Agent) {
    const handler = args.pop();
    args.push(createMiddleware(agent, undefined));
    args.push(handler);

    return args;
  }

  private addMiddlewareToUse(args: unknown[], agent: Agent) {
    if (args.length > 0 && typeof args[0] === "string") {
      return [args[0], createMiddleware(agent, args[0]), ...args.slice(1)];
    }

    return [createMiddleware(agent, undefined), ...args];
  }

  wrap(hooks: Hooks) {
    const express = hooks.addPackage("express").withVersion("^4.0.0");

    const route = express.addSubject((exports) => exports.Route.prototype);

    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    expressMethodNames.forEach((method) => {
      route.modifyArguments(method, (args, subject, agent) => {
        return this.addMiddlewareToRoute(args, agent);
      });
    });

    express
      .addSubject((exports) => {
        return exports.application;
      })
      .modifyArguments("use", (args, subject, agent) =>
        this.addMiddlewareToUse(args, agent)
      );
  }
}
