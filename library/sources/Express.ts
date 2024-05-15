/* eslint-disable prefer-rest-params */
import type { RequestHandler } from "express";
import { METHODS } from "http";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./express/wrapRequestHandler";

export class Express implements Wrapper {
  // Wrap all the functions passed to app.METHOD(...)
  // Examples:
  // app.METHOD(path, handler)
  // app.METHOD(path, middleware, handler)
  // app.METHOD(path, middleware, middleware, ..., handler)
  private wrapRouteArguments(args: unknown[], agent: Agent) {
    return args.map((arg, index) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      // The last argument is the route handler
      const isLast = index === args.length - 1;
      if (isLast) {
        return wrapRequestHandler(arg as RequestHandler, agent, undefined);
      }

      // We grab the first path argument and pass it to the middleware
      // Because middleware doesn't have a path argument, we need to pass it
      let path: string | undefined = undefined;
      if (args.length > 0 && typeof args[0] === "string") {
        path = args[0];
      }

      return wrapRequestHandler(arg as RequestHandler, agent, path);
    });
  }

  // Wrap all the functions passed to app.use(...)
  // Examples:
  // app.use(middleware)
  // app.use(middleware, middleware, ...)
  // app.use(path, middleware)
  // app.use(path, middleware, middleware, ...)
  private wrapUseArguments(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      // We grab the first path argument and pass it to the middleware
      // Because middleware doesn't have a path argument, we need to pass it
      let path: string | undefined = undefined;
      if (args.length > 0 && typeof args[0] === "string") {
        path = args[0];
      }

      return wrapRequestHandler(arg as RequestHandler, agent, path);
    });
  }

  wrap(hooks: Hooks) {
    const express = hooks.addPackage("express").withVersion("^4.0.0");

    const route = express.addSubject((exports) => exports.Route.prototype);

    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    expressMethodNames.forEach((method) => {
      route.modifyArguments(method, (args, subject, agent) => {
        return this.wrapRouteArguments(args, agent);
      });
    });

    express
      .addSubject((exports) => {
        return exports.application;
      })
      .modifyArguments("use", (args, subject, agent) =>
        this.wrapUseArguments(args, agent)
      );
  }
}
