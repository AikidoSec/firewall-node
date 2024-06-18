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
  // Wrap all the functions passed to app.use(...)
  // app.use(middleware)
  // app.use(middleware, middleware, ...)
  // app.use(path, middleware)
  // app.use(path, middleware, middleware, ...)
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as RequestHandler, agent);
    });
  }

  wrap(hooks: Hooks) {
    const express = hooks.addPackage("express").withVersion("^4.0.0");

    const route = express.addSubject((exports) => exports.Route.prototype);

    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    expressMethodNames.forEach((method) => {
      route.modifyArguments(method, (args, subject, agent) => {
        return this.wrapArgs(args, agent);
      });
    });

    express
      .addSubject((exports) => {
        return exports.application;
      })
      .modifyArguments("use", (args, subject, agent) =>
        this.wrapArgs(args, agent)
      );
  }
}
