/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response } from "express";
import { runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
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
  //
  // app.get("/path", json(), (req, res) => { ... }))
  // we will inject our middleware ^ here
  // app.get("/path", json(), middleware(), (req, res) => { ... }))
  //
  // Without having to change the user's code
  private addMiddleware(args: unknown[]) {
    const handler = args.pop();
    args.push(createMiddleware());
    args.push(handler);

    return args;
  }

  wrap(hooks: Hooks) {
    const express = hooks.addPackage("express").withVersion("^4.0.0");

    const route = express.addSubject((exports) => exports.Route.prototype);

    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    expressMethodNames.forEach((method) => {
      route.modifyArguments(method, (args) => this.addMiddleware(args));
    });
  }
}
