/* eslint-disable prefer-rest-params */
import type { NextFunction, Request, Response, Application } from "express";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { runWithContext } from "../agent/Context";
import { WrapSelector, Wrapper } from "../agent/Wrapper";
import { METHODS } from "node:http";

type Middleware = (req: Request, resp: Response, next: NextFunction) => void;

const EXPRESS_VERSION_RANGE = "";

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

export class Express extends Wrapper {
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
  constructor() {
    super("express", EXPRESS_VERSION_RANGE, getWrapSelectors());
  }
  static middleware(this: any, args: unknown[], method: string) {
    const handler = args.pop();
    args.push(createMiddleware());
    args.push(handler);

    return args;
  }
}

function getWrapSelectors() {
  const wrapSelectors: Record<string, WrapSelector> = {};
  const methods = METHODS.map((method) => method.toLowerCase());
  for (const method of methods) {
    wrapSelectors[method] = {
      exportsSelector: (exports: any) => exports.Route.prototype,
      middleware: Express.middleware,
    };
  }
  return wrapSelectors;
}
