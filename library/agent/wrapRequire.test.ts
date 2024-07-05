import * as t from "tap";
import { Agent } from "./Agent";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { Token } from "./api/Token";
import { Hooks } from "./hooks/Hooks";
import { LoggerForTesting } from "./logger/LoggerForTesting";
import { wrapRequire } from "./wrapRequire";
import { ModifyingRequireInterceptor } from "./hooks/ModifyingRequireInterceptor";
import { applyHooks } from "./applyHooks";

function createAgent() {
  const logger = new LoggerForTesting();
  const api = new ReportingAPIForTesting();
  const agent = new Agent(true, logger, api, new Token("123"), undefined);

  return {
    agent,
    logger,
    api,
  };
}

t.test("test ModifyRequireInterceptor", async (t) => {
  t.throws(() => {
    // @ts-expect-error testing invalid arguments
    new ModifyingRequireInterceptor(undefined, undefined);
  }, "Name is required");
});

t.test("test wrapRequire", async (t) => {
  const hooks = new Hooks();
  const requireSubject = hooks
    .addPackage("unknown")
    .withVersion("^1.0.0")
    .addRequireSubject();

  requireSubject.modifyArguments("unknown", (args) => {
    return args;
  });

  const fastifyBefore = require("fastify");
  t.notOk(fastifyBefore.__wrapped);
  t.same(
    fastifyBefore().hasRoute({
      url: "/",
      method: "GET",
    }),
    false
  );

  hooks
    .addPackage("fastify")
    .withVersion("^4.0.0")
    .addRequireSubject()
    .modifyArguments("hasRoute", (args) => {
      // Break the method for testing
      args[0] = null;
      return args;
    });

  const { agent } = createAgent();
  applyHooks(hooks, agent);

  try {
    require("unknown");
  } catch (error) {
    t.ok(error instanceof Error);
    t.match(error.message, /Cannot find module 'unknown'/);
  }

  try {
    require("hono");
  } catch (error) {
    t.ok(error instanceof Error);
    t.match(
      error.message,
      /Module must export a function to be wrapped during require/
    );
  }

  const fastifyAfter = require("fastify");
  t.type(fastifyAfter, "function");
  t.same(fastifyAfter.errorCodes, fastifyBefore.errorCodes);
  t.ok(fastifyAfter.__wrapped);
  try {
    fastifyAfter().hasRoute({
      url: "/",
      method: "GET",
    }),
      t.fail("should throw error");
  } catch (error) {
    t.ok(error instanceof Error);
    t.match(error.message, "Cannot read properties of null (reading 'method')");
  }

  const fastifyCached = require("fastify");
  t.type(fastifyCached, "function");
  t.same(fastifyCached.errorCodes, fastifyBefore.errorCodes);
  t.ok(fastifyCached.__wrapped);
});
